// packages/tooling/src/e2e/screenshots-cli.test.ts
// The screenshots:ios command line: --help, usage errors without a stack, and this session's own
// simulators (--sim <purpose>: e07-<purpose> and e07-<purpose>-tablet) instead of the shared ones.
import { parseScreenshotsCli, SCREENSHOTS_USAGE, shotSimulatorName } from './screenshots-cli.ts';

describe('parseScreenshotsCli', () => {
  it('asks for the usage on --help or -h and names every option in it', () => {
    expect(parseScreenshotsCli(['-h'])).toStrictEqual({ kind: 'help' });
    for (const option of [
      '--app',
      '--update',
      '--devices',
      '--langs',
      '--text-size',
      '--sim',
      '--driver-port',
    ]) {
      expect(SCREENSHOTS_USAGE).toContain(option);
    }
  });

  it('reads the options with the defaults of the full matrix', () => {
    expect(parseScreenshotsCli(['--app', 'line-siege', '--sim', 'r5-e2e-native'])).toStrictEqual({
      kind: 'run',
      options: {
        game: 'line-siege',
        appPath: undefined,
        flow: 'packages/shell/e2e/screenshots/matrix.yaml',
        isUpdate: false,
        devices: ['phone', 'tablet'],
        langs: ['en', 'de', 'fa', 'ckb'],
        textSize: 'large',
        driverPort: undefined,
        sim: 'r5-e2e-native',
      },
    });
  });

  it.each([
    [[], 'missing --app <game-id>'],
    [['--app', 'line-siege', '--devices', 'watch'], 'unknown device watch (phone or tablet)'],
    [['--app', 'line-siege', '--driver-port', 'x'], '--driver-port x is not a port number'],
    [['--app', 'line-siege', '--colour'], "Unknown option '--colour'"],
  ])('refuses %j as a usage error', (argv, message) => {
    const parsed = parseScreenshotsCli(argv);
    expect(parsed.kind).toBe('error');
    expect(parsed.kind === 'error' ? parsed.message : '').toContain(message);
  });
});

describe('shotSimulatorName', () => {
  it("uses the shared capture simulators, or this session's own with --sim", () => {
    expect([
      shotSimulatorName('phone', undefined),
      shotSimulatorName('tablet', undefined),
    ]).toStrictEqual(['e07-shots-phone', 'e07-shots-tablet']);
    expect([
      shotSimulatorName('phone', 'r5-e2e-native'),
      shotSimulatorName('tablet', 'r5-e2e-native'),
    ]).toStrictEqual(['e07-r5-e2e-native', 'e07-r5-e2e-native-tablet']);
  });
});
