// packages/tooling/src/release/what-to-test.test.ts
import { whatToTest } from './what-to-test.ts';

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
