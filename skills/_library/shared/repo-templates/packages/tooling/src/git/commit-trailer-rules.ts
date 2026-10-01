// packages/tooling/src/git/commit-trailer-rules.ts
// The trailer half of the commit-message rules (see commit-message-rules.ts): trailers sit in the
// last paragraph, Gate-Change and Spec-Change give a real reason, Spec-Change names a spec
// section (or is a directed swap's exact trailer), and Gate-Change appears exactly when a changed
// file matches gatedPaths.
import path from 'node:path';

export type CommitProblem = {
  readonly rule: string;
  readonly line: number;
  readonly message: string;
  readonly fix: string;
};

/** The fix printed for each rule id (the same ids check-commits.mjs prints). */
const FIXES: Readonly<Record<string, string>> = {
  'header-format': 'Write "<type>(<scope>): <imperative subject>".',
  'header-type': 'Use feat, fix, perf, refactor, test, docs, build, ci, chore, style or revert.',
  'scope-missing': 'Name the folder the change is in, or repo, deps, docs, ci, skills.',
  'header-scope': 'Use a folder under apps/ or packages/, or repo, deps, docs, ci, skills.',
  'header-length': 'Shorten the subject; the header holds at most 72 characters.',
  'subject-case': 'Start the subject in lowercase.',
  'subject-period': 'Drop the trailing period.',
  'subject-mood': 'Use the imperative, as in a command: "add", "fix", "remove".',
  'subject-vague': 'Say what changes for the player or the code.',
  'blank-line': 'Leave one blank line between the header and the body.',
  'body-missing': 'Add a body that says why the change was made and which spec lines it serves.',
  'spec-ref-missing': 'Name the spec lines the change serves: "Spec S9 and 8.3: ...".',
  'trailer-placement': 'Move every trailer into one final paragraph after a blank line.',
  'trailer-empty': 'Say why in a few words (at least 10 characters).',
  'spec-change-format':
    'Write "Spec-Change: spec <section or ID> <what changed>" (a directed swap: its exact trailer).',
  'gate-change-missing': 'Add a final paragraph "Gate-Change: <why the gate had to change>".',
  'gate-change-unneeded': 'Remove the trailer; the owner finds gate changes by it.',
  'placeholder-left': 'Replace every __PLACEHOLDER__ of the template with real text.',
};

export const problem = (rule: string, line: number, message: string): CommitProblem => ({
  rule,
  line,
  message,
  fix: FIXES[rule] ?? '',
});

type Entry = { readonly text: string; readonly line: number };

const KNOWN_TRAILER = /^(Gate-Change|Spec-Change|Co-Authored-By|Signed-off-by|Refs):\s*(.*)$/iu;
const ANY_TRAILER = /^[A-Za-z-]+:\s/u;
const MOVABLE_TRAILER = /^(Gate-Change|Spec-Change|Co-Authored-By):/iu;
/** A spec line: "spec 8.3", "spec section 5", S9, S11a, N3 or D4. */
export const SPEC_ID =
  /\b(?:spec(?:'s)?\s+(?:sections?\s+)?\d{1,2}(?:\.\d{1,2})?|S\d{1,2}[a-d]?|N\d{1,2}|D\d)\b/iu;
const MIN_REASON_LENGTH = 10;

/**
 * Spec-Change reasons of the directed swaps the build order names letter for letter. Such a swap
 * replaces a phase-0 file and its test on purpose (the test's assertions change) and serves no spec
 * section of its own, so this exact reason needs no spec id; any other wording still does.
 */
export const DIRECTED_SWAP_TRAILERS: readonly string[] = [
  'with-shell final composer (phase 0 placeholder replaced)',
];

const isDirectedSwap = (entry: Entry): boolean =>
  DIRECTED_SWAP_TRAILERS.includes(entry.text.replace(/^[^:]+:\s*/u, '').trim());

// Folders that hold the skill library and Claude Code's own files, not the app. A pattern reaches
// into them only when it starts with the folder itself (".claude/settings.json" stays gated); a
// leading "**/" wildcard never does, so editing a skill's templates or fixtures needs no trailer.
const UNGATED_FOLDERS = ['skills/', '.claude/'] as const;

/** True when a changed file is a quality gate under one of the gatedPaths patterns. */
export function isGatedFile(file: string, pattern: string): boolean {
  const folder = UNGATED_FOLDERS.find((prefix) => file.startsWith(prefix));
  if (folder !== undefined && !pattern.startsWith(folder)) {
    return false;
  }
  return path.matchesGlob(file, pattern);
}

function paragraphs(lines: readonly string[]): readonly (readonly Entry[])[] {
  const out: Entry[][] = [[]];
  lines.forEach((text, index) => {
    if (text.trim() === '') {
      out.push([]);
    } else {
      out.at(-1)?.push({ text, line: index + 1 });
    }
  });
  return out.filter((paragraph) => paragraph.length > 0);
}

const isTrailerLine = (entry: Entry): boolean =>
  KNOWN_TRAILER.test(entry.text) || ANY_TRAILER.test(entry.text);

/** [the trailer paragraph (empty when the last paragraph is prose), the misplaced trailers]. */
function splitTrailers(lines: readonly string[]): readonly (readonly Entry[])[] {
  const paras = paragraphs(lines);
  const last = paras.length > 1 ? (paras.at(-1) ?? []) : [];
  const isTrailers = last.length > 0 && last.every(isTrailerLine);
  const middle = paras.slice(1, isTrailers ? -1 : undefined).flat();
  return [isTrailers ? last : [], middle.filter((entry) => MOVABLE_TRAILER.test(entry.text))];
}

const named = (trailers: readonly Entry[], key: string): readonly Entry[] =>
  trailers.filter((entry) => entry.text.toLowerCase().startsWith(`${key.toLowerCase()}:`));

function reasonProblems(trailers: readonly Entry[]): readonly CommitProblem[] {
  const vague = [...named(trailers, 'Gate-Change'), ...named(trailers, 'Spec-Change')]
    .filter((entry) => entry.text.replace(/^[^:]+:\s*/u, '').trim().length < MIN_REASON_LENGTH)
    .map((entry) => problem('trailer-empty', entry.line, `"${entry.text}" gives no real reason`));
  const unanchored = named(trailers, 'Spec-Change')
    .filter((entry) => !isDirectedSwap(entry))
    .filter((entry) => !SPEC_ID.test(entry.text) && !/\bspec\s+\d/iu.test(entry.text))
    .map((entry) =>
      problem('spec-change-format', entry.line, `"${entry.text}" names no spec section`),
    );
  return [...vague, ...unanchored];
}

function gateProblems(
  trailers: readonly Entry[],
  files: readonly string[],
  gated: readonly string[],
): readonly CommitProblem[] {
  const [first] = named(trailers, 'Gate-Change');
  const gatedFiles = files.filter((file) => gated.some((pattern) => isGatedFile(file, pattern)));
  if (gatedFiles.length > 0 && first === undefined) {
    const list = gatedFiles.slice(0, 4).join(', ');
    return [problem('gate-change-missing', 1, `gated files changed without Gate-Change: ${list}`)];
  }
  if (gatedFiles.length === 0 && first !== undefined) {
    return [problem('gate-change-unneeded', first.line, 'a Gate-Change trailer but no gated file')];
  }
  return [];
}

/** Trailer placement, reasons, Spec-Change format, and (when the files are known) the gate rule. */
export function checkTrailers(
  lines: readonly string[],
  files: readonly string[] | null,
  gated: readonly string[],
): readonly CommitProblem[] {
  const [trailers = [], misplaced = []] = splitTrailers(lines);
  return [
    ...misplaced.map((entry) =>
      problem('trailer-placement', entry.line, `"${entry.text}" is not in the last paragraph`),
    ),
    ...reasonProblems(trailers),
    ...(files === null ? [] : gateProblems(trailers, files, gated)),
  ];
}
