// packages/tooling/src/git/commit-message-rules.test.ts
import {
  checkCommitMessage,
  isGatedFile,
  normalizeMessage,
  type CommitCheckInput,
} from './commit-message-rules.ts';
import SAMPLES from './commit-message-samples.json';
import { DIRECTED_SWAP_TRAILERS } from './commit-trailer-rules.ts';

// Paths inside the skill library, built from parts: the library's own checks read a literal
// skills-folder path as a reference to another skill.
const SKILL_SNAPSHOT = [
  'skills',
  'demo',
  'templates',
  '__snapshots__',
  'a.golden.test.ts.snap',
].join('/');
const LINKED_TSCONFIG = ['.claude', 'skills', 'demo', 'templates', 'tsconfig.json'].join('/');

const rulesOf = (input: CommitCheckInput): readonly string[] =>
  [...new Set(checkCommitMessage(input).map((problem) => problem.rule))].sort();

describe('checkCommitMessage', () => {
  // The same list check-commits.mjs --samples runs: the hook and the checker cannot drift.
  it.each(SAMPLES.samples.map((sample) => [sample.name, sample] as const))(
    'judges the shared sample %s as the list says',
    (_name, sample) => {
      const input = {
        message: sample.message,
        files: sample.files,
        gatedPatterns: SAMPLES.gatedPaths,
        workspaceScopes: SAMPLES.scopes,
      };
      expect(rulesOf(input)).toStrictEqual([...sample.rules].sort());
    },
  );

  it('covers every rule id with a sample', () => {
    const covered = new Set(SAMPLES.samples.flatMap((sample) => sample.rules));
    expect(covered.size).toBe(18);
  });

  it('accepts a directed swap trailer only letter for letter', () => {
    const swap = (reason: string): readonly string[] =>
      rulesOf({
        message: `build(shell): swap in the final with-shell composer\n\nWhy.\n\nSpec-Change: ${reason}`,
        files: null,
        gatedPatterns: [],
        workspaceScopes: SAMPLES.scopes,
      });
    expect(DIRECTED_SWAP_TRAILERS.map(swap)).toStrictEqual([[]]);
    expect(swap('with-shell final composer, phase 0 replaced')).toStrictEqual([
      'spec-change-format',
    ]);
  });

  it('needs no trailer when only skill files match a wildcard gate', () => {
    const input = {
      message: 'docs(skills): add a skill golden\n\nThe fixture proves the checker.',
      files: [SKILL_SNAPSHOT],
      gatedPatterns: ['**/__snapshots__/*.golden.test.ts.snap'],
      workspaceScopes: [],
    };
    expect(checkCommitMessage(input)).toStrictEqual([]);
  });

  it('names the line of a misplaced trailer', () => {
    const [problem] = checkCommitMessage({
      message: 'chore(repo): tidy\n\nCo-Authored-By: someone\n\nWhy it changed.',
      files: null,
      gatedPatterns: [],
      workspaceScopes: [],
    });
    expect(problem).toMatchObject({ rule: 'trailer-placement', line: 3 });
  });
});

describe('normalizeMessage', () => {
  it('drops comment lines and everything below the scissors', () => {
    const raw =
      'chore(repo): tidy\n# comment\n\nBody.\n# ------------------------ >8 ------------------------\ndiff';
    expect(normalizeMessage(raw)).toBe('chore(repo): tidy\n\nBody.');
  });
});

describe('isGatedFile', () => {
  it('gates a golden snapshot anywhere in the monorepo', () => {
    const snapshot = 'apps/line-siege/src/rules/__snapshots__/replay.golden.test.ts.snap';
    expect(isGatedFile(snapshot, '**/__snapshots__/*.golden.test.ts.snap')).toBe(true);
  });

  it('leaves skill files ungated by a wildcard pattern', () => {
    expect(isGatedFile(SKILL_SNAPSHOT, '**/__snapshots__/*.golden.test.ts.snap')).toBe(false);
  });

  it('leaves linked skills under .claude/ ungated by a wildcard pattern', () => {
    expect(isGatedFile(LINKED_TSCONFIG, '**/tsconfig.json')).toBe(false);
  });

  it('gates .claude/settings.json, which a pattern names directly', () => {
    expect(isGatedFile('.claude/settings.json', '.claude/settings.json')).toBe(true);
  });
});
