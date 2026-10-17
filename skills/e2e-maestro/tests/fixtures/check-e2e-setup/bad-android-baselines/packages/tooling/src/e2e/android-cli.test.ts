// packages/tooling/src/e2e/android-cli.test.ts
import {
  ANDROID_E2E_USAGE,
  ANDROID_SHOTS_USAGE,
  apkVariantProblem,
  parseAndroidE2eCli,
  parseAndroidShotsCli,
} from './android-cli.ts';

const appConfig = (appVariant: string, adsMode: string): string =>
  JSON.stringify({ name: 'Line Siege', extra: { appVariant, adsMode } });

describe('parseAndroidE2eCli', () => {
  it('reads the game and runs on the shared e2e emulators by default', () => {
    expect(parseAndroidE2eCli(['--app', 'line-siege'])).toStrictEqual({
      kind: 'run',
      options: {
        game: 'line-siege',
        phoneAvd: 'e2e-phone',
        tabletAvd: 'e2e-tablet',
        driverPort: undefined,
        apk: undefined,
        isFlowsOnly: false,
        isWritingBaseline: false,
        maestroArgs: [],
      },
    });
  });

  it("runs on this session's own e07-android-<purpose> emulators with --avd", () => {
    const parsed = parseAndroidE2eCli([
      '--app',
      'line-siege',
      '--avd',
      'r1-e2e',
      '--driver-port',
      '61234',
    ]);
    expect(
      parsed.kind === 'run' && [parsed.options.phoneAvd, parsed.options.tabletAvd],
    ).toStrictEqual(['r1-e2e', 'r1-e2e-tablet']);
    expect(parsed.kind === 'run' && parsed.options.driverPort).toBe(61_234);
  });

  it('passes the tag filter on to maestro test', () => {
    const parsed = parseAndroidE2eCli([
      '--app',
      'line-siege',
      '--flows-only',
      '--include-tags',
      'smoke',
    ]);
    expect(parsed.kind === 'run' && parsed.options.maestroArgs).toStrictEqual([
      '--include-tags',
      'smoke',
    ]);
  });

  it('prints the help for --help and -h', () => {
    expect(parseAndroidE2eCli(['-h'])).toStrictEqual({ kind: 'help' });
    expect(ANDROID_E2E_USAGE).toContain('npm run e2e:android -- --app <game-id>');
  });

  it('names each bad command line as a usage error', () => {
    const cases: readonly [readonly string[], string][] = [
      [[], 'missing --app <game-id>'],
      [['--app', 'line-siege', '--sim', 'x'], 'unknown option --sim'],
      [['--app', 'line-siege', 'extra'], 'unexpected argument extra'],
      [['--app', 'line-siege', '--avd', 'Pixel 8'], '--avd Pixel 8: pass a kebab-case purpose'],
      [
        ['--app', 'line-siege', '--driver-port', '80'],
        '--driver-port 80 is not a port from 1024 to 65535',
      ],
      [['--app'], '--app needs a value'],
    ];
    for (const [argv, message] of cases) {
      expect(parseAndroidE2eCli(argv)).toStrictEqual({ kind: 'error', message });
    }
  });
});

describe('parseAndroidShotsCli', () => {
  it('captures every device and language at font scale 1.0 on the shared shots emulators by default', () => {
    expect(parseAndroidShotsCli(['--app', 'line-siege'])).toStrictEqual({
      kind: 'run',
      options: {
        game: 'line-siege',
        apk: undefined,
        isUpdate: false,
        devices: ['phone', 'tablet'],
        langs: ['en', 'de', 'fa', 'ckb'],
        fontScale: '1.0',
        driverPort: undefined,
        avds: { phone: 'shots-phone', tablet: 'shots-tablet' },
      },
    });
  });

  it('narrows the update to the devices and languages asked for, at 200 % text', () => {
    const argv = [
      '--app',
      'line-siege',
      '--update',
      '--devices',
      'phone',
      '--langs',
      'fa',
      '--font-scale',
      '2.0',
    ];
    const parsed = parseAndroidShotsCli(argv);
    expect(parsed.kind === 'run' && parsed.options).toMatchObject({
      isUpdate: true,
      devices: ['phone'],
      langs: ['fa'],
      fontScale: '2.0',
    });
  });

  it('refuses a device, a language or a font scale the matrix does not have', () => {
    expect(parseAndroidShotsCli(['--app', 'a', '--devices', 'watch'])).toStrictEqual({
      kind: 'error',
      message: '--devices watch: use phone, tablet or phone,tablet',
    });
    expect(parseAndroidShotsCli(['--app', 'a', '--langs', 'it'])).toStrictEqual({
      kind: 'error',
      message: '--langs it: use en, de, fa and ckb only',
    });
    expect(parseAndroidShotsCli(['--app', 'a', '--font-scale', '1.5'])).toStrictEqual({
      kind: 'error',
      message: '--font-scale 1.5: use 1.0 or 2.0',
    });
    expect(ANDROID_SHOTS_USAGE).toContain('npm run screenshots:android -- --app <game-id>');
  });
});

describe('apkVariantProblem', () => {
  it('accepts only a test build with ADS_MODE=off', () => {
    expect(apkVariantProblem(appConfig('test', 'off'), 'line-siege')).toBeNull();
    expect(apkVariantProblem(appConfig('store', 'off'), 'line-siege')).toBe(
      'e2e:android needs a test build with ADS_MODE=off, this one is store/off: run npm run build:android:emu -- --app line-siege --variant test --ads off',
    );
    expect(apkVariantProblem(appConfig('test', 'test'), 'line-siege')).toContain(
      'this one is test/test',
    );
  });

  it('refuses an APK whose assets/app.config is not JSON', () => {
    expect(apkVariantProblem('', 'line-siege')).toContain('this one is unknown/unknown');
  });
});
