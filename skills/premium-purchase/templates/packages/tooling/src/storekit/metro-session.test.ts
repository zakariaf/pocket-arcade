// packages/tooling/src/storekit/metro-session.test.ts
// The harness's Metro on a stand-in spawn: no Metro or simulator runs here.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { spawnMetro, withMetro } from './metro-session.ts';

import type { SpawnMetro } from './metro-session.ts';

describe('withMetro (premium-purchase Tier 2: the StoreKit harness)', () => {
  it('runs the scenarios with Metro up, then stops it', async () => {
    const calls: string[] = [];
    const result = await withMetro(
      () => {
        calls.push('start');
        return Promise.resolve(() => calls.push('stop'));
      },
      () => {
        calls.push('scenarios');
        return Promise.resolve(0);
      },
    );
    expect([result, calls]).toStrictEqual([0, ['start', 'scenarios', 'stop']]);
  });

  it('stops Metro when a scenario throws, so no Metro is left running', async () => {
    const stop = jest.fn();
    await expect(
      withMetro(
        () => Promise.resolve(stop),
        () => Promise.reject(new Error('xcodebuild test-without-building failed')),
      ),
    ).rejects.toThrow('xcodebuild test-without-building failed');
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('spawnMetro', () => {
  it('writes Metro to its log file instead of a pipe nobody reads, and stops it', () => {
    const logFile = join(
      mkdtempSync(join(tmpdir(), 'metro-session-')),
      'logs',
      'storekit-metro.log',
    );
    const kill = jest.fn(() => true);
    const spawned: Parameters<SpawnMetro>[] = [];
    const spawn: SpawnMetro = (...args) => {
      spawned.push(args);
      return { kill };
    };
    const stop = spawnMetro(spawn, { appDir: 'apps/line-siege', port: 8099, env: {}, logFile });

    const [command, args, options] = spawned[0] ?? [];
    expect([command, args, options?.cwd]).toStrictEqual([
      'npx',
      ['expo', 'start', '--port', '8099'],
      'apps/line-siege',
    ]);
    const [stdin, stdout, stderr] = options?.stdio ?? [];
    expect([stdin, typeof stdout, stdout === stderr]).toStrictEqual(['ignore', 'number', true]);
    expect(existsSync(logFile)).toBe(true);
    stop();
    expect(kill).toHaveBeenCalledTimes(1);
  });
});
