// packages/tooling/src/audit/network-runtime-layer.test.ts
import {
  appPids,
  appProcessPattern,
  appProcessPatterns,
  NEW_SAMPLER_STATUS,
  nextSamplerStatus,
  nonLoopbackConnections,
  pidsOf,
  samplerProblems,
  samplerStatusPath,
  samplerStatusText,
  sampleSockets,
} from './network-runtime-layer.ts';

import type { ExecText } from './network-runtime-layer.ts';

/** A process that exits with `status`, as execFileSync throws it. */
const exitError = (status: number, stderr = ''): Error =>
  Object.assign(new Error(`Command failed (exit ${String(status)})`), { status, stderr });

const HEADER = 'COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME';

describe('nonLoopbackConnections', () => {
  it('keeps only connections whose peer is not loopback', () => {
    const output = [
      HEADER,
      'LineSiege 4242 me   12u  IPv4 0x1      0t0  TCP 127.0.0.1:50000->127.0.0.1:8081 (ESTABLISHED)',
      'LineSiege 4242 me   13u  IPv6 0x2      0t0  TCP [::1]:50001->[::1]:8081 (ESTABLISHED)',
      'LineSiege 4242 me   14u  IPv4 0x3      0t0  TCP 192.168.1.20:50002->142.250.74.46:443 (ESTABLISHED)',
      'LineSiege 4242 me   15u  IPv4 0x4      0t0  UDP *:5353',
    ].join('\n');

    expect(nonLoopbackConnections(output)).toStrictEqual([
      'LineSiege 4242 me   14u  IPv4 0x3      0t0  TCP 192.168.1.20:50002->142.250.74.46:443 (ESTABLISHED)',
    ]);
  });

  it('returns nothing for a process without connected sockets', () => {
    expect(nonLoopbackConnections(`${HEADER}\n`)).toStrictEqual([]);
  });
});

describe('pidsOf', () => {
  it('keeps every pid pgrep printed, so each running copy of the app is sampled', () => {
    expect(pidsOf('4242\n5151\n')).toStrictEqual(['4242', '5151']);
    expect(pidsOf('')).toStrictEqual([]);
  });
});

describe('appProcessPattern', () => {
  const bundle =
    '~/Library/Developer/CoreSimulator/Devices/U1/data/Containers/Bundle/Application/A';
  const matches = (pattern: string, command: string): boolean => new RegExp(pattern).test(command);

  it("finds the app in any bundle folder, Maestro's clearState reinstall included", () => {
    const pattern = appProcessPattern('LineSiege');
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiege`)).toBe(true);
    expect(matches(pattern, `${bundle}/io.applander.linesiege-1790732416578.app/LineSiege`)).toBe(
      true,
    );
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiege -AppleLanguages (fa)`)).toBe(true);
    expect(matches(pattern, `${bundle}/LineSiege.app/LineSiegeHelper`)).toBe(false);
  });

  it("keeps to one simulator's copy when given its udid", () => {
    const pattern = appProcessPattern('LineSiege', 'U1');
    expect(matches(pattern, `${bundle}/io.applander.linesiege-1.app/LineSiege`)).toBe(true);
    expect(matches(pattern, `${bundle.replace('U1', 'U2')}/LineSiege.app/LineSiege`)).toBe(false);
  });
});

describe('appProcessPatterns', () => {
  const copyOn = (udid: string): string =>
    `~/Library/Developer/CoreSimulator/Devices/${udid}/data/Containers/Bundle/Application/A/LineSiege.app/LineSiege`;
  const found = (patterns: readonly string[], command: string): boolean =>
    patterns.some((pattern) => new RegExp(pattern).test(command));

  it("watches only this run's simulators: another session's copy (an ads-on build) is not ours", () => {
    const patterns = appProcessPatterns('LineSiege', ['PHONE-1', 'TABLET-2']);
    expect([found(patterns, copyOn('PHONE-1')), found(patterns, copyOn('TABLET-2'))]).toStrictEqual(
      [true, true],
    );
    expect(found(patterns, copyOn('OTHER-SESSION-3'))).toBe(false);
  });

  it('needs at least one simulator', () => {
    expect(() => appProcessPatterns('LineSiege', [])).toThrow(/udid/);
  });
});

describe('appPids and sampleSockets (layer F evidence: no silent blind spot)', () => {
  const calls: string[] = [];
  const exec =
    (answer: (command: string) => string): ExecText =>
    (command, args) => {
      calls.push([command, ...args].join(' '));
      return answer(command);
    };

  it('reads "no process" (pgrep exit 1) and "no socket" (lsof exit 1) as nothing found', () => {
    const none = exec(() => {
      throw exitError(1);
    });
    expect(appPids('LineSiege', ['PHONE-1'], none)).toStrictEqual([]);
    expect(sampleSockets('4242', none)).toStrictEqual([]);
  });

  it('throws any other failure of pgrep or lsof, so the sampler reports it', () => {
    const broken = exec(() => {
      throw exitError(2, 'pgrep: invalid regular expression');
    });
    expect(() => appPids('LineSiege', ['PHONE-1'], broken)).toThrow('exit 2');
    expect(() => sampleSockets('4242', broken)).toThrow('exit 2');
  });

  it('samples the sockets of every pid it found', () => {
    const lsof = `${HEADER}\nLineSiege 4242 me 14u IPv4 0x3 0t0 TCP 10.0.0.2:5->142.250.74.46:443 (ESTABLISHED)\n`;
    const answer = exec((command) => (command === 'pgrep' ? '4242\n' : lsof));
    expect(appPids('LineSiege', ['PHONE-1'], answer)).toStrictEqual(['4242']);
    expect(sampleSockets('4242', answer)).toHaveLength(1);
  });
});

describe('the sampler status (liveness)', () => {
  it('counts samples, samples that found the app, and errors', () => {
    const first = nextSamplerStatus(NEW_SAMPLER_STATUS, { pids: 0, error: null });
    const second = nextSamplerStatus(first, { pids: 1, error: null });
    const third = nextSamplerStatus(second, { pids: 0, error: new Error('lsof gone') });
    expect(third).toStrictEqual({
      samples: 3,
      appSamples: 1,
      errorCount: 1,
      errors: ['lsof gone'],
    });
  });

  it('keeps the first five error messages and counts the rest', () => {
    let status = NEW_SAMPLER_STATUS;
    for (let at = 1; at <= 7; at += 1) {
      status = nextSamplerStatus(status, { pids: 0, error: new Error(`e${String(at)}`) });
    }
    expect([status.errorCount, status.errors]).toStrictEqual([7, ['e1', 'e2', 'e3', 'e4', 'e5']]);
  });

  it('lives next to the report, one file per sampler, as two-space JSON', () => {
    expect(samplerStatusPath('reports/e2e/line-siege/network.txt', ['PHONE-1'])).toBe(
      'reports/e2e/line-siege/network.txt.sampler-PHONE-1.json',
    );
    expect(samplerStatusText(NEW_SAMPLER_STATUS)).toBe(
      '{\n  "samples": 0,\n  "appSamples": 0,\n  "errorCount": 0,\n  "errors": []\n}\n',
    );
  });
});

describe('samplerProblems (an empty network.txt is N3 evidence only from a live sampler)', () => {
  const alive = { samples: 60, appSamples: 58, errorCount: 0, errors: [] };
  const later = { ...alive, samples: 63, appSamples: 61 };
  const end = (status: unknown, after: unknown = later, exit: string | null = null) => ({
    udid: 'PHONE-1',
    statusText: status === null ? null : JSON.stringify(status),
    laterStatusText: after === null ? null : JSON.stringify(after),
    exit,
  });

  it('accepts a sampler still sampling at the end that saw the app and reported no error', () => {
    expect(samplerProblems(end(alive))).toStrictEqual([]);
  });

  it('refuses a sampler that never started, exited early, failed, stopped sampling or never saw the app', () => {
    expect(samplerProblems(end(null, null))).toStrictEqual([
      'network: the socket sampler on PHONE-1 never started (no status file), so an empty network.txt proves nothing',
    ]);
    expect(samplerProblems(end(alive, alive, 'exit code 1'))).toStrictEqual([
      'network: the socket sampler on PHONE-1 stopped before the run ended (exit code 1)',
    ]);
    expect(
      samplerProblems(end({ ...alive, errorCount: 3, errors: ['lsof: exit 2', 'x', 'y'] })),
    ).toStrictEqual([
      'network: the socket sampler on PHONE-1 failed 3 time(s), first: lsof: exit 2',
    ]);
    expect(samplerProblems(end(alive, alive))).toStrictEqual([
      'network: the socket sampler on PHONE-1 took no new sample at the end of the run (60 samples, then none)',
    ]);
    expect(
      samplerProblems(end({ ...alive, appSamples: 0 }, { ...later, appSamples: 0 })),
    ).toStrictEqual(['network: the socket sampler on PHONE-1 never found the app running there']);
    expect(
      samplerProblems(end({ ...NEW_SAMPLER_STATUS }, { ...NEW_SAMPLER_STATUS })),
    ).toStrictEqual(['network: the socket sampler on PHONE-1 took no sample']);
    expect(samplerProblems({ ...end(alive), statusText: '{' })).toStrictEqual([
      'network: the socket sampler on PHONE-1 wrote no readable status',
    ]);
  });
});
