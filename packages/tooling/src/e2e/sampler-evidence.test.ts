// packages/tooling/src/e2e/sampler-evidence.test.ts
// The end of an E2E run: network.txt is N3 evidence only when every socket sampler is proven alive
// (it never exited, its count still grows between two reads, it found the app, no error).
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { proveSamplersAlive, trackSampler } from './sampler-evidence.ts';

const status = (samples: number, appSamples = samples, errors: readonly string[] = []): string =>
  `${JSON.stringify({ samples, appSamples, errorCount: errors.length, errors })}\n`;

describe('proveSamplersAlive', () => {
  let dir = '';
  let network = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sampler-evidence-'));
    network = join(dir, 'network.txt');
    writeFileSync(network, '');
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const statusFile = (udid: string): string => `${network}.sampler-${udid}.json`;

  it('accepts samplers still sampling at the end, kills them and records the evidence', async () => {
    writeFileSync(statusFile('PHONE-1'), status(40));
    const killed: string[] = [];
    const problems = await proveSamplersAlive(
      [{ udid: 'PHONE-1', exit: () => null, kill: () => killed.push('PHONE-1') }],
      network,
      () => {
        writeFileSync(statusFile('PHONE-1'), status(43));
        return Promise.resolve();
      },
    );
    expect([problems, killed]).toStrictEqual([[], ['PHONE-1']]);
    expect(JSON.parse(readFileSync(join(dir, 'network-samplers.json'), 'utf8'))).toStrictEqual([
      { udid: 'PHONE-1', samples: 43, appSamples: 43, problems: [] },
    ]);
  });

  it('fails the run for a sampler that died, went quiet or never started, and for no sampler', async () => {
    writeFileSync(statusFile('PHONE-1'), status(12));
    writeFileSync(statusFile('TABLET-2'), status(30));
    const problems = await proveSamplersAlive(
      [
        { udid: 'PHONE-1', exit: () => 'exit code 1', kill: () => undefined },
        { udid: 'TABLET-2', exit: () => null, kill: () => undefined },
        { udid: 'OTHER-3', exit: () => null, kill: () => undefined },
      ],
      network,
      () => Promise.resolve(),
    );
    expect(problems).toStrictEqual([
      'network: the socket sampler on PHONE-1 stopped before the run ended (exit code 1)',
      'network: the socket sampler on TABLET-2 took no new sample at the end of the run (30 samples, then none)',
      'network: the socket sampler on OTHER-3 never started (no status file), so an empty network.txt proves nothing',
    ]);
    expect(await proveSamplersAlive([], network, () => Promise.resolve())).toStrictEqual([
      `network: no socket sampler ran, see ${join(dir, 'network-samplers.json')}`,
    ]);
  });
});

describe('trackSampler', () => {
  const fakeChild = () => Object.assign(new EventEmitter(), { kill: jest.fn(() => true) });

  it('remembers how a sampler ended before the runner stopped it, and kills it on stop', () => {
    const died = fakeChild();
    const crashed = fakeChild();
    const running = fakeChild();
    const samplers = [
      trackSampler('PHONE-1', died),
      trackSampler('TABLET-2', crashed),
      trackSampler('PHONE-3', running),
    ];
    died.emit('exit', 1, null);
    crashed.emit('error', new Error('spawn node ENOENT'));
    expect(samplers.map((sampler) => sampler.exit())).toStrictEqual([
      'exit code 1',
      'could not start: spawn node ENOENT',
      null,
    ]);
    samplers[2]?.kill();
    expect(running.kill).toHaveBeenCalledTimes(1);
  });
});
