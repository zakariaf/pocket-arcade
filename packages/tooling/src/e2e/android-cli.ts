// packages/tooling/src/e2e/android-cli.ts
// The command lines of e2e:android and screenshots:android, pure: --help prints the usage, a bad
// command line is a usage error (the runner prints it with the usage line and exits 2, no stack),
// and --avd <purpose> runs on this session's own emulators e07-android-<purpose> and
// e07-android-<purpose>-tablet instead of the shared defaults. Also the APK's variant check: E2E
// runs only a test build with ADS_MODE=off (requireAdsOffTestApk reads assets/app.config).
import { isLanguage, LANGUAGES } from '@e07/shell/i18n/languages.ts';
import { isAvdPurpose } from '@e07/tooling/android/emulators.ts';

import { driverPortOf, readOptions, type OptionSpec, type ReadOptions } from './e2e-cli.ts';
import { MATRIX_DEVICES, type MatrixDevice } from './screenshots-cli.ts';
import { e2eBuildProblem } from './simulator.ts';

export const ANDROID_E2E_USAGE = [
  'usage: npm run e2e:android -- --app <game-id> [--avd <purpose>] [--driver-port <n>] [--apk <app-release.apk>] [--flows-only] [--write-perf-baseline] [--include-tags <tags>]',
  '  --app                  the game folder under apps/ (kebab-case)',
  "  --avd                  this session's own emulators: e07-android-<purpose> (phone) and",
  '                         e07-android-<purpose>-tablet; default e07-android-e2e-phone and -e2e-tablet',
  '  --driver-port          one Maestro driver port for every run (default: a free port per run)',
  '  --apk                  the APK to test (default: apps/<game-id>/android/app/build/outputs/apk/release/)',
  '  --flows-only           the flows only, for iterating; never the evidence run',
  '  --write-perf-baseline  write perf-baselines/cold-start-emu-<game-id>.json (commit it with Gate-Change:)',
  '  --include-tags         passed to maestro test (while iterating)',
  '  --help, -h             print this and exit',
  'Needs a Release APK of the test variant with ADS_MODE=off:',
  '  npm run build:android:emu -- --app <game-id> --variant test --ads off',
  'Reports: reports/e2e-android/<game-id>/.',
].join('\n');

export const ANDROID_SHOTS_USAGE = [
  'usage: npm run screenshots:android -- --app <game-id> [--update] [--devices phone,tablet] [--langs en,de,fa,ckb] [--font-scale 1.0|2.0] [--avd <purpose>] [--apk <app-release.apk>] [--driver-port <n>]',
  '  --update       write the captures as the new baselines (open every PNG, commit with Gate-Change:)',
  '  --devices      phone, tablet or both (default phone,tablet)',
  '  --langs        the languages (default en,de,fa,ckb)',
  '  --font-scale   1.0 (default) or 2.0 (the 200 % pass)',
  "  --avd          this session's own emulators e07-android-<purpose> and e07-android-<purpose>-tablet",
  '                 (default: the shared e07-android-shots-phone and e07-android-shots-tablet)',
  '  --help, -h     print this and exit',
].join('\n');

export type AndroidE2eOptions = {
  readonly game: string;
  /** AVD purposes: e07-android-<purpose>. */
  readonly phoneAvd: string;
  readonly tabletAvd: string;
  readonly driverPort: number | undefined;
  readonly apk: string | undefined;
  readonly isFlowsOnly: boolean;
  readonly isWritingBaseline: boolean;
  readonly maestroArgs: readonly string[];
};

export type AndroidShotsOptions = {
  readonly game: string;
  readonly apk: string | undefined;
  readonly isUpdate: boolean;
  readonly devices: readonly MatrixDevice[];
  readonly langs: readonly string[];
  readonly fontScale: '1.0' | '2.0';
  readonly driverPort: number | undefined;
  readonly avds: Readonly<Record<MatrixDevice, string>>;
};

export type CliParse<T> =
  | { readonly kind: 'help' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'run'; readonly options: T };

type Read = ReadOptions<string>;

const E2E_SPEC: OptionSpec = {
  app: { type: 'string' },
  avd: { type: 'string' },
  'driver-port': { type: 'string' },
  apk: { type: 'string' },
  'flows-only': { type: 'boolean' },
  'write-perf-baseline': { type: 'boolean' },
  'include-tags': { type: 'string' },
};
const SHOTS_SPEC: OptionSpec = {
  app: { type: 'string' },
  avd: { type: 'string' },
  'driver-port': { type: 'string' },
  apk: { type: 'string' },
  update: { type: 'boolean' },
  devices: { type: 'string' },
  langs: { type: 'string' },
  'font-scale': { type: 'string' },
};
type Common = {
  readonly game: string;
  readonly driverPort: number | undefined;
  readonly avd: string | undefined;
};

/** --app, --driver-port and --avd, which both command lines read alike. */
function commonOf(read: Read): Common | string {
  const game = read.values.get('app');
  if (game === undefined) return 'missing --app <game-id>';
  const driverPort = driverPortOf(read.values.get('driver-port'));
  if (typeof driverPort === 'string') return driverPort;
  const avd = read.values.get('avd');
  if (avd !== undefined && !isAvdPurpose(avd)) {
    return `--avd ${avd}: pass a kebab-case purpose`;
  }
  return { game, driverPort, avd };
}

function parseWith<T>(
  argv: readonly string[],
  spec: OptionSpec,
  build: (read: Read, common: Common) => T | string,
): CliParse<T> {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  const read = readOptions(argv, spec);
  if (typeof read === 'string') return { kind: 'error', message: read };
  const common = commonOf(read);
  if (typeof common === 'string') return { kind: 'error', message: common };
  const options = build(read, common);
  return typeof options === 'string'
    ? { kind: 'error', message: options }
    : { kind: 'run', options };
}

export function parseAndroidE2eCli(argv: readonly string[]): CliParse<AndroidE2eOptions> {
  return parseWith(argv, E2E_SPEC, (read, { game, driverPort, avd }) => {
    const tags = read.values.get('include-tags');
    return {
      game,
      phoneAvd: avd ?? 'e2e-phone',
      tabletAvd: avd === undefined ? 'e2e-tablet' : `${avd}-tablet`,
      driverPort,
      apk: read.values.get('apk'),
      isFlowsOnly: read.flags.has('flows-only'),
      isWritingBaseline: read.flags.has('write-perf-baseline'),
      maestroArgs: tags === undefined ? [] : ['--include-tags', tags],
    };
  });
}

const isDevice = (value: string): value is MatrixDevice =>
  MATRIX_DEVICES.some((device) => device === value);

/** --devices, --langs and --font-scale of screenshots:android, or the problem. */
function matrixOf(
  read: Read,
): Pick<AndroidShotsOptions, 'devices' | 'langs' | 'fontScale'> | string {
  const devicesText = read.values.get('devices') ?? 'phone,tablet';
  const devices = devicesText.split(',');
  if (!devices.every(isDevice))
    return `--devices ${devicesText}: use phone, tablet or phone,tablet`;
  const langsText = read.values.get('langs') ?? LANGUAGES.join(',');
  const langs = langsText.split(',');
  if (!langs.every(isLanguage)) return `--langs ${langsText}: use en, de, fa and ckb only`;
  const fontScale = read.values.get('font-scale') ?? '1.0';
  if (fontScale !== '1.0' && fontScale !== '2.0')
    return `--font-scale ${fontScale}: use 1.0 or 2.0`;
  return { devices, langs, fontScale };
}

export function parseAndroidShotsCli(argv: readonly string[]): CliParse<AndroidShotsOptions> {
  return parseWith(argv, SHOTS_SPEC, (read, { game, driverPort, avd }) => {
    const matrix = matrixOf(read);
    if (typeof matrix === 'string') return matrix;
    return {
      game,
      apk: read.values.get('apk'),
      isUpdate: read.flags.has('update'),
      ...matrix,
      driverPort,
      avds: {
        phone: avd ?? 'shots-phone',
        tablet: avd === undefined ? 'shots-tablet' : `${avd}-tablet`,
      },
    };
  });
}

/**
 * Null for a test build with ADS_MODE=off, else why the APK is refused. `appConfig` is the APK's
 * assets/app.config (expo-constants embeds the resolved config, withShell's extra included): with
 * ads off neither Google's form nor an ad SDK socket can cover a screen or fill network.txt.
 */
export function apkVariantProblem(appConfig: string, game: string): string | null {
  let extra: Readonly<Record<string, unknown>> = {};
  try {
    const parsed = JSON.parse(appConfig) as { readonly extra?: Readonly<Record<string, unknown>> };
    extra = parsed.extra ?? {};
  } catch {
    extra = {};
  }
  const textOf = (value: unknown): string => (typeof value === 'string' ? value : 'unknown');
  const build = { appVariant: textOf(extra['appVariant']), adsMode: textOf(extra['adsMode']) };
  return e2eBuildProblem(build, game, 'android');
}
