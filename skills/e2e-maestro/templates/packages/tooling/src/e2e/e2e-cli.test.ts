// packages/tooling/src/e2e/e2e-cli.test.ts
// The e2e:ios command line: --help prints every option and runs nothing, a bad command line is a
// usage error (exit 2, the usage line, no stack), and the runner's options are read out of the
// Maestro test options it passes on.
import { E2E_USAGE, parseE2eCli } from './e2e-cli.ts';

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
});
