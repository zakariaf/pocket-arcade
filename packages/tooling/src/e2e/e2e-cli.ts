// packages/tooling/src/e2e/e2e-cli.ts
// The e2e:ios command line, pure: --help and -h print the usage with every option and run nothing;
// a bad command line is a usage error (run-e2e-ios.ts prints the message and the usage line and
// exits 2, without a stack); the runner's own options are read out, and Maestro's tag filter
// (--include-tags, while iterating) is passed on to maestro test.
import { parseArgs } from 'node:util';

import { simOptionProblem } from './simulator.ts';

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

/** The runner's options as node:util parseArgs reads them (screenshots-cli.ts reads its own alike). */
const OPTIONS = {
  app: { type: 'string' },
  sim: { type: 'string' },
  'driver-port': { type: 'string' },
  'app-path': { type: 'string' },
  'flows-only': { type: 'boolean' },
  'write-perf-baseline': { type: 'boolean' },
  'include-tags': { type: 'string' },
} as const;

/** How node:util parseArgs reads each option of a runner's command line. */
export type OptionSpec = Readonly<Record<string, { readonly type: 'string' | 'boolean' }>>;

/** The options read out of a command line: each value, and each flag that was given. */
export type ReadOptions<TName extends string> = {
  readonly values: ReadonlyMap<TName, string>;
  readonly flags: ReadonlySet<TName>;
};

/**
 * Every option and its value, or the first problem. parseArgs reads the tokens leniently, so this
 * names each problem in the runner's words (an unknown option, a missing value, a stray word).
 * Shared by e2e:ios, e2e:android and screenshots:android (android-cli.ts).
 */
export function readOptions<TSpec extends OptionSpec>(
  argv: readonly string[],
  spec: TSpec,
): ReadOptions<Extract<keyof TSpec, string>> | string {
  type Name = Extract<keyof TSpec, string>;
  const isName = (name: string): name is Name => Object.hasOwn(spec, name);
  const { tokens } = parseArgs({
    args: [...argv],
    options: spec,
    strict: false,
    allowPositionals: true,
    tokens: true,
  });
  const values = new Map<Name, string>();
  const flags = new Set<Name>();
  for (const token of tokens) {
    if (token.kind !== 'option') {
      return `unexpected argument ${token.kind === 'positional' ? token.value : '--'}`;
    }
    if (!isName(token.name)) return `unknown option ${token.rawName}`;
    if (spec[token.name]?.type === 'boolean') {
      flags.add(token.name);
    } else if (token.value === undefined || token.value.startsWith('--')) {
      return `${token.rawName} needs a value`;
    } else {
      values.set(token.name, token.value);
    }
  }
  return { values, flags };
}

/** maestro-args' bound: maestroGlobalArgs refuses any other driver port. */
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

/**
 * --driver-port of e2e:ios and screenshots:ios: undefined without one, the port, or the problem
 * (checked while parsing, before any simulator starts).
 */
export function driverPortOf(text: string | undefined): number | undefined | string {
  if (text === undefined) return undefined;
  if (!/^\d{1,5}$/.test(text)) return `--driver-port ${text} is not a port number`;
  const port = Number(text);
  return port >= MIN_PORT && port <= MAX_PORT
    ? port
    : `--driver-port ${text} is not a port from ${String(MIN_PORT)} to ${String(MAX_PORT)}`;
}

export function parseE2eCli(argv: readonly string[]): E2eCliParse {
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  const read = readOptions(argv, OPTIONS);
  if (typeof read === 'string') return { kind: 'error', message: read };
  const game = read.values.get('app');
  if (game === undefined) return { kind: 'error', message: 'missing --app <game-id>' };
  const driverPort = driverPortOf(read.values.get('driver-port'));
  if (typeof driverPort === 'string') return { kind: 'error', message: driverPort };
  const simProblem = simOptionProblem(read.values.get('sim'));
  if (simProblem !== null) return { kind: 'error', message: simProblem };
  const tags = read.values.get('include-tags');
  return {
    kind: 'run',
    options: {
      game,
      sim: read.values.get('sim'),
      driverPort,
      appPath: read.values.get('app-path'),
      isFlowsOnly: read.flags.has('flows-only'),
      isWritingBaseline: read.flags.has('write-perf-baseline'),
      maestroArgs: tags === undefined ? [] : ['--include-tags', tags],
    },
  };
}
