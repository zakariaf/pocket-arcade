// packages/tooling/src/git/commit-message-rules.ts
// The ONE commit-message rule set. The commit-msg hook (check-commit-message.ts) and the
// git-commits-and-reporting skill's check-commits.mjs enforce exactly these rules with these ids,
// and both test suites run commit-message-samples.json (a good message and one per rule), so a
// commit the hook accepts is a commit check-commits accepts, and the other way round.
import { checkTrailers, problem, SPEC_ID, type CommitProblem } from './commit-trailer-rules.ts';

export { isGatedFile, type CommitProblem } from './commit-trailer-rules.ts';

export const COMMIT_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'test',
  'docs',
  'build',
  'ci',
  'chore',
  'style',
  'revert',
] as const;

/** Scopes that are not workspace folders; always allowed. */
export const FIXED_SCOPES = ['repo', 'deps', 'docs', 'ci', 'skills'] as const;
/** Scopes whose feat and fix bodies need not name a spec line. */
const NO_SPEC_SCOPES = new Set<string>(['tooling', ...FIXED_SCOPES]);

export const MAX_HEADER_LENGTH = 72;

export type CommitCheckInput = {
  readonly message: string;
  /** The files the commit changes; null when unknown (the Gate-Change file rules are skipped). */
  readonly files: readonly string[] | null;
  readonly gatedPatterns: readonly string[];
  /** The folders under apps/ and packages/ (FIXED_SCOPES are added). */
  readonly workspaceScopes: readonly string[];
};

type Header = { readonly type: string; readonly scope: string };

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?!?: (?<subject>\S.*)$/u;
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/u;
const TRAILER_LINE = /^(Gate-Change|Spec-Change|Co-Authored-By|Signed-off-by|Refs):\s*(.*)$/iu;
const NOT_IMPERATIVE = new Set(
  (
    'added adds adding fixed fixes fixing updated updates updating changed changes changing ' +
    'removed removes removing created creates creating improved improves improving refactored ' +
    'refactors refactoring implemented implements implementing made makes making moved moves ' +
    'moving renamed renames renaming deleted deletes deleting introduced introduces introducing ' +
    'bumped bumps bumping upgraded upgrades upgrading replaced replaces replacing cleaned cleans ' +
    'cleaning wrote writes writing merged merges merging tested tests testing'
  ).split(' '),
);
const VAGUE =
  /^(wip|misc|stuff|update|updates|changes|change|fix|fixes|tweak|tweaks|cleanup|work|progress|temp|tmp)$/iu;
const SCISSORS = /^# -+ >8 -+$/mu;

/** The message as git stores it: no comment lines, nothing below the scissors, no trailing space. */
export function normalizeMessage(raw: string): string {
  const cut = SCISSORS.exec(raw);
  const kept = cut === null ? raw : raw.slice(0, cut.index);
  return kept
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .replace(/\s+$/u, '');
}

function scopeProblems(scope: string | undefined, allowed: readonly string[]): CommitProblem[] {
  if (scope === undefined || scope === '') {
    return [problem('scope-missing', 1, 'the header has no scope')];
  }
  return allowed.includes(scope)
    ? []
    : [problem('header-scope', 1, `scope "${scope}" is not one of ${allowed.join(', ')}`)];
}

function subjectProblems(subject: string): CommitProblem[] {
  const first = (subject.split(/\s+/u)[0] ?? '').toLowerCase();
  const checks: readonly (readonly [boolean, string, string])[] = [
    [/^[A-Z]/u.test(subject), 'subject-case', `subject "${subject}" starts with a capital letter`],
    [subject.endsWith('.'), 'subject-period', 'the subject ends with a period'],
    [NOT_IMPERATIVE.has(first), 'subject-mood', `subject starts with "${first}"`],
    [VAGUE.test(subject.trim()), 'subject-vague', `subject "${subject}" says nothing`],
  ];
  return checks.filter(([isFailed]) => isFailed).map(([, rule, text]) => problem(rule, 1, text));
}

function checkHeader(
  header: string,
  allowed: readonly string[],
): { readonly problems: readonly CommitProblem[]; readonly parsed: Header | null } {
  const groups = HEADER.exec(header)?.groups;
  if (groups === undefined) {
    const text = `header "${header}" is not "type(scope): subject"`;
    return { problems: [problem('header-format', 1, text)], parsed: null };
  }
  const { type = '', scope, subject = '' } = groups;
  const isKnownType = COMMIT_TYPES.some((known) => known === type);
  const problems = [
    ...(isKnownType ? [] : [problem('header-type', 1, `type "${type}" is unknown`)]),
    ...scopeProblems(scope, allowed),
    ...(header.length > MAX_HEADER_LENGTH
      ? [problem('header-length', 1, `header is ${String(header.length)} characters`)]
      : []),
    ...subjectProblems(subject),
  ];
  return { problems, parsed: { type, scope: scope ?? '' } };
}

/** A feat or fix says why (body-missing) and which spec lines it serves (spec-ref-missing). */
function featFixProblems(lines: readonly string[], parsed: Header): CommitProblem[] {
  const body = lines.slice(1).join('\n').trim();
  const prose = lines
    .slice(1)
    .filter((line) => !TRAILER_LINE.test(line))
    .join('\n')
    .trim();
  const problems: CommitProblem[] = [];
  if (prose === '') {
    problems.push(problem('body-missing', 1, `a ${parsed.type} commit has no body`));
  }
  if (!NO_SPEC_SCOPES.has(parsed.scope) && body !== '' && !SPEC_ID.test(body)) {
    problems.push(problem('spec-ref-missing', 1, 'the body names no spec line'));
  }
  return problems;
}

function checkBody(lines: readonly string[], parsed: Header | null): CommitProblem[] {
  const hasBlankLine = lines.length < 2 || (lines[1] ?? '').trim() === '';
  const blank = hasBlankLine ? [] : [problem('blank-line', 2, 'the second line is not blank')];
  const isFeatOrFix = parsed?.type === 'feat' || parsed?.type === 'fix';
  return parsed !== null && isFeatOrFix ? [...blank, ...featFixProblems(lines, parsed)] : blank;
}

function checkPlaceholders(lines: readonly string[]): CommitProblem[] {
  return lines.flatMap((text, index) => {
    const found = /__[A-Z][A-Z0-9_]*__/u.exec(text);
    return found === null
      ? []
      : [problem('placeholder-left', index + 1, `placeholder ${found[0]} is left`)];
  });
}

/** Every problem with a commit message; an empty list means it may be committed. */
export function checkCommitMessage(input: CommitCheckInput): readonly CommitProblem[] {
  const lines = normalizeMessage(input.message).split('\n');
  const header = lines[0] ?? '';
  if (GIT_GENERATED.test(header)) {
    return [];
  }
  const { problems, parsed } = checkHeader(header, [...input.workspaceScopes, ...FIXED_SCOPES]);
  return [
    ...problems,
    ...checkBody(lines, parsed),
    ...checkTrailers(lines, input.files, input.gatedPatterns),
    ...checkPlaceholders(lines),
  ];
}
