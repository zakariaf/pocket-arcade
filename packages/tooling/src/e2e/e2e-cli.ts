// packages/tooling/src/e2e/e2e-cli.ts
// The e2e:ios command line, pure: --help and -h print the usage with every option and run nothing;
// a bad command line is a usage error (run-e2e-ios.ts prints the message and the usage line and
// exits 2, without a stack); the runner's own options are read out, and Maestro's tag filter
// (--include-tags, while iterating) is passed on to maestro test.

export const E2E_USAGE = [
  'usage: npm run e2e:ios -- --app <game-id> [--sim <purpose>] [--driver-port <n>] [--app-path <App.app>] [--flows-only] [--write-perf-baseline] [--include-tags <tags>]',
  '  --app                  the game folder under apps/ (kebab-case)',
  "  --sim                  this session's own simulators: e07-<purpose> (phone) and e07-<purpose>-tablet",
  '                         (the iPad of the large-text step); default e07-e2e-phone and e07-e2e-tablet',
  '  --driver-port          one Maestro driver port for every run of this session (default: a free port',
  '                         per run); every run names its UDID and its port before the command',
  '  --app-path             the .app to test (default: the Release simulator build in',
  '                         apps/<game-id>/build/dd/Build/Products/Release-iphonesimulator/)',
  '  --flows-only           step 1 only (the flows), for iterating; never the evidence run',
  '  --write-perf-baseline  write perf-baselines/cold-start-sim-<game-id>.json from this run (commit it',
  '                         with a Gate-Change: trailer)',
  '  --include-tags         passed to maestro test: only the flows with these tags (while iterating)',
  '  --help, -h             print this and exit',
  'Needs a Release simulator build of the test variant with ADS_MODE=off:',
  '  npm run build:ios:sim -- --app <game-id> --variant test --ads off',
  'The evidence run (no --flows-only, no tag filter): flows, cold start, memory with the feedback',
  'evidence and the S15 save benchmark, large text. Reports: reports/e2e/<game-id>/.',
].join('\n');

export type E2eOptions = {
  readonly game: string;
  /** --sim <purpose>: e07-<purpose> and e07-<purpose>-tablet (undefined: the shared defaults). */
  readonly sim: string | undefined;
  readonly driverPort: number | undefined;
  readonly appPath: string | undefined;
  readonly isFlowsOnly: boolean;
  readonly isWritingBaseline: boolean;
  /** Maestro test options passed on unchanged (--include-tags <tags>). */
  readonly maestroArgs: readonly string[];
};

export type E2eCliParse =
  | { readonly kind: 'help' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'run'; readonly options: E2eOptions };

const APP = '--app';
const DRIVER_PORT = '--driver-port';
const INCLUDE_TAGS = '--include-tags';
const VALUE_OPTIONS = [APP, '--sim', DRIVER_PORT, '--app-path'] as const;
const FLAG_OPTIONS = ['--flows-only', '--write-perf-baseline'] as const;
const MAESTRO_OPTIONS = [INCLUDE_TAGS] as const;
type ValueOption = (typeof VALUE_OPTIONS)[number] | (typeof MAESTRO_OPTIONS)[number];

type Read = {
  readonly values: Map<ValueOption, string>;
  readonly flags: Set<string>;
};

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

/** Every option and its value, or the first problem. */
function readArgs(argv: readonly string[]): Read | string {
  const values = new Map<ValueOption, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    if (isOneOf(FLAG_OPTIONS, arg)) {
      flags.add(arg);
    } else if (isOneOf(VALUE_OPTIONS, arg) || isOneOf(MAESTRO_OPTIONS, arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return `${arg} needs a value`;
      values.set(arg, value);
      index += 1;
    } else {
      return arg.startsWith('-') ? `unknown option ${arg}` : `unexpected argument ${arg}`;
    }
  }
  return { values, flags };
}

function driverPortOf(text: string | undefined): number | undefined | string {
  if (text === undefined) return undefined;
  const port = /^\d{1,5}$/.test(text) ? Number(text) : Number.NaN;
  return port >= 1 && port <= 65_535 ? port : `${DRIVER_PORT} ${text} is not a port number`;
}

export function parseE2eCli(argv: readonly string[]): E2eCliParse {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  const read = readArgs(argv);
  if (typeof read === 'string') return { kind: 'error', message: read };
  const game = read.values.get(APP);
  if (game === undefined) return { kind: 'error', message: 'missing --app <game-id>' };
  const driverPort = driverPortOf(read.values.get(DRIVER_PORT));
  if (typeof driverPort === 'string') return { kind: 'error', message: driverPort };
  const tags = read.values.get(INCLUDE_TAGS);
  return {
    kind: 'run',
    options: {
      game,
      sim: read.values.get('--sim'),
      driverPort,
      appPath: read.values.get('--app-path'),
      isFlowsOnly: read.flags.has('--flows-only'),
      isWritingBaseline: read.flags.has('--write-perf-baseline'),
      maestroArgs: tags === undefined ? [] : [INCLUDE_TAGS, tags],
    },
  };
}
