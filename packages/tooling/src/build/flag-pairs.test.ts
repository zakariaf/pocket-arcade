// packages/tooling/src/build/flag-pairs.test.ts
import { readFlagPairs } from './flag-pairs.ts';

describe('readFlagPairs (build:ios:sim, build:android:emu and release:android)', () => {
  const FLAGS = new Set(['--app', '--ads']);

  it('reads each known flag with its value', () => {
    expect([
      ...readFlagPairs(['--app', 'line-siege', '--ads', 'off'], FLAGS, 'usage: x'),
    ]).toStrictEqual([
      ['--app', 'line-siege'],
      ['--ads', 'off'],
    ]);
  });

  it('refuses an unknown flag, a flag without a value and a flag as a value, with the usage', () => {
    for (const argv of [['--sim', 'smoke'], ['--app'], ['--app', '--ads', 'off']]) {
      expect(() => readFlagPairs(argv, FLAGS, 'usage: x')).toThrow(
        `unexpected argument "${argv[0] ?? ''}". usage: x`,
      );
    }
  });
});
