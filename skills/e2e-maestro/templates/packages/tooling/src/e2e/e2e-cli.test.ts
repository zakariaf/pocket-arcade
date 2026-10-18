// packages/tooling/src/e2e/e2e-cli.test.ts
// The e2e:ios command line: --help prints every option and runs nothing, a bad command line is a
// usage error (exit 2, the usage line, no stack), and the runner's options are read out of the
// Maestro test options it passes on.
import { driverPortOf, E2E_USAGE, parseE2eCli, readOptions } from './e2e-cli.ts';

describe('parseE2eCli', () => {
  it('asks for the usage on --help or -h, wherever it stands', () => {
    expect(parseE2eCli(['--help'])).toStrictEqual({ kind: 'help' });
    expect(parseE2eCli(['--app', 'line-siege', '-h'])).toStrictEqual({ kind: 'help' });
  });

  it('names every option in the usage', () => {
    for (const option of [
      '--app',
      '--sim',
      '--driver-port',
      '--app-path',
      '--flows-only',
      '--write-perf-baseline',
      '--include-tags',
      '--help',
    ]) {
      expect(E2E_USAGE).toContain(option);
    }
  });

  it("reads the runner's options and passes Maestro's tag filter on", () => {
    expect(
      parseE2eCli([
        '--app',
        'line-siege',
        '--sim',
        'r5-e2e-native',
        '--driver-port',
        '7123',
        '--flows-only',
        '--include-tags',
        'endless',
      ]),
    ).toStrictEqual({
      kind: 'run',
      options: {
        game: 'line-siege',
        sim: 'r5-e2e-native',
        driverPort: 7123,
        appPath: undefined,
        isFlowsOnly: true,
        isWritingBaseline: false,
        maestroArgs: ['--include-tags', 'endless'],
      },
    });
  });

  it.each([
    [[], 'missing --app <game-id>'],
    [['--app'], '--app needs a value'],
    [['--app', 'line-siege', '--retry'], 'unknown option --retry'],
    [['--app', 'line-siege', '--driver-port', 'auto'], '--driver-port auto is not a port number'],
    [['--app', 'line-siege', 'extra'], 'unexpected argument extra'],
  ])('refuses %j as a usage error: %s', (argv, message) => {
    expect(parseE2eCli(argv)).toStrictEqual({ kind: 'error', message });
  });

  it('refuses a --sim that names no e07- simulator while parsing, before Maestro is installed', () => {
    expect(parseE2eCli(['--app', 'line-siege', '--sim', 'My Phone'])).toStrictEqual({
      kind: 'error',
      message:
        '--sim My Phone: pass a kebab-case purpose such as --sim r3-e2e (the simulator is e07-<purpose>)',
    });
    expect(parseE2eCli(['--app', 'line-siege', '--sim', 'e07-e16-e2e']).kind).toBe('run');
  });
});

describe('driverPortOf (e2e:ios and screenshots:ios)', () => {
  it('takes the ports maestroGlobalArgs accepts and nothing else, before any simulator starts', () => {
    expect(driverPortOf(undefined)).toBeUndefined();
    expect([driverPortOf('1024'), driverPortOf('65535')]).toStrictEqual([1024, 65_535]);
    expect(driverPortOf('80')).toBe('--driver-port 80 is not a port from 1024 to 65535');
    expect(driverPortOf('70000')).toBe('--driver-port 70000 is not a port from 1024 to 65535');
    expect(driverPortOf('7e3')).toBe('--driver-port 7e3 is not a port number');
  });
});

describe('readOptions (the token loop of e2e:ios, e2e:android and screenshots:android)', () => {
  const SPEC = { app: { type: 'string' }, update: { type: 'boolean' } } as const;

  it('reads each option with its value and each flag', () => {
    const read = readOptions(['--app', 'line-siege', '--update'], SPEC);
    expect(typeof read === 'string' ? read : [[...read.values], [...read.flags]]).toStrictEqual([
      [['app', 'line-siege']],
      ['update'],
    ]);
  });

  it("names the first problem in the runner's words", () => {
    expect(
      [['--sim', 'x'], ['--app'], ['--app', '--update'], ['line-siege'], ['--', 'x']].map((argv) =>
        readOptions(argv, SPEC),
      ),
    ).toStrictEqual([
      'unknown option --sim',
      '--app needs a value',
      '--app needs a value',
      'unexpected argument line-siege',
      'unexpected argument --',
    ]);
  });
});
