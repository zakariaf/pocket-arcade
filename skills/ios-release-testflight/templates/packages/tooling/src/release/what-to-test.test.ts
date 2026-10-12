// packages/tooling/src/release/what-to-test.test.ts
import {
  MAX_CHANGE_LINES,
  purchaseCheckNeeded,
  releaseWhatToTest,
  summarizeChanges,
  whatToTest,
} from './what-to-test.ts';

const INPUT = {
  gameName: 'Line Siege',
  version: '1.0.0',
  buildNumber: 8,
  appVariant: 'store',
  changes: ['feat(line-siege): add pack 3'],
  focus: [],
  knownIssues: [],
  needsPurchaseTest: true,
} as const;

describe('whatToTest', () => {
  it('writes the header, changes, checks and known issues', () => {
    const text = whatToTest(INPUT);
    expect(text.split('\n').slice(0, 3)).toStrictEqual([
      'Line Siege 1.0.0 (8) · store build',
      'What changed',
      '- feat(line-siege): add pack 3',
    ]);
    expect(text).toContain('- Buy Premium, cancel a purchase');
    expect(text.endsWith('Known issues\n- none')).toBe(true);
  });

  it('leaves the purchase check out when purchase code did not change', () => {
    expect(whatToTest({ ...INPUT, needsPurchaseTest: false })).not.toContain('Buy Premium');
  });

  it('refuses text longer than TestFlight accepts', () => {
    const changes = Array.from(
      { length: 200 },
      (_, index) => `fix: change number ${String(index)} with detail`,
    );
    expect(() => whatToTest({ ...INPUT, changes })).toThrow('TestFlight allows 4000');
  });
});

describe('summarizeChanges', () => {
  it('lists nothing on the first build of a game', () => {
    expect(summarizeChanges(['feat(line-siege): a'], true)).toStrictEqual([
      'first TestFlight build of this game: everything is new',
    ]);
  });

  it('caps a long history so the text fits TestFlight', () => {
    const subjects = Array.from(
      { length: 300 },
      (_, index) => `fix(line-siege): bug ${String(index)}`,
    );
    const lines = summarizeChanges(subjects, false);
    expect(lines).toHaveLength(MAX_CHANGE_LINES + 1);
    expect(lines.at(-1)).toBe('and 280 more fixes and features');
    expect(() => whatToTest({ ...INPUT, changes: lines })).not.toThrow();
  });
});

describe('purchaseCheckNeeded', () => {
  const none = {
    isFirstBuild: false,
    changedFiles: ['apps/line-siege/src/rules/moves.ts'],
    notes: [],
  };

  it('is needed on a first build and when purchase code changed', () => {
    expect(purchaseCheckNeeded({ ...none, isFirstBuild: true })).toBe(true);
    const changedFiles = ['packages/shell/src/services/purchase/premium-reducer.ts'];
    expect(purchaseCheckNeeded({ ...none, changedFiles })).toBe(true);
  });

  it('is left out when nothing about purchases changed', () => {
    expect(purchaseCheckNeeded(none)).toBe(false);
  });
});

describe('releaseWhatToTest', () => {
  const RELEASE = {
    gameName: 'Line Siege',
    version: '1.0.0',
    buildNumber: 8,
    appVariant: 'test',
    notes: [],
    knownIssues: [],
    history: { previousTag: '', subjects: [], files: [] },
  } as const;

  it("writes a game's first build as everything new, with the purchase check", () => {
    const lines = releaseWhatToTest(RELEASE).split('\n');
    expect(lines.slice(0, 3)).toStrictEqual([
      'Line Siege 1.0.0 (8) · test build',
      'What changed',
      '- first TestFlight build of this game: everything is new',
    ]);
    expect(lines).toContain(
      '- Buy Premium, cancel a purchase, delete the app, reinstall, then Restore.',
    );
  });

  it("lists the game's fixes and features since its previous build tag", () => {
    const history = {
      previousTag: 'line-siege/v1.0.0+7',
      subjects: ['fix(shell): keep a loss open while its rewarded continue plays'],
      files: ['packages/shell/src/game-host/run-end-policy.ts'],
    };
    const lines = releaseWhatToTest({ ...RELEASE, history }).split('\n');
    expect(lines.slice(1, 3)).toStrictEqual([
      'What changed',
      '- fix(shell): keep a loss open while its rewarded continue plays',
    ]);
    expect(lines.some((line) => line.includes('Restore'))).toBe(false);
  });

  it('stops an over-long --notes with what to do, before anything is built', () => {
    expect(() => releaseWhatToTest({ ...RELEASE, notes: ['x'.repeat(4000)] })).toThrow(
      'What to Test would be 4304 characters; TestFlight allows 4000: shorten --notes or --known-issue, then rerun (nothing was built, committed or uploaded)',
    );
  });
});
