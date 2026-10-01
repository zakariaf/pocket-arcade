// packages/tooling/src/e2e/run-e2e-ios.ts —
// `npm run e2e:ios -- --app <game-id> [--sim <purpose>] [--driver-port <n>] [--app-path <App.app>] [--flows-only] [--write-perf-baseline] [--include-tags <tags>]`
// (--help prints every option; a bad command line prints the usage line and exits 2, e2e-cli.ts)
// --sim runs the phone steps on this session's own simulator e07-<purpose> (default e07-e2e-phone)
// and the iPad steps on e07-<purpose>-tablet (default e07-e2e-tablet). Every Maestro run names its
// simulator's UDID and a driver port of its own (a free one per run, or --driver-port for the whole
// session) before the command, so no run reaches another session's simulator.
// Needs a Release simulator build of the test variant with ADS_MODE=off and refuses any other
// (requireAdsOffTestBuild): with ads off ConsentPort asks neither Google's form nor Apple's tracking
// prompt, so no system prompt covers a screen and no ad SDK opens a socket. While the layer-F
// socket sampler watches the app's sockets on this run's own simulators (one sampler per simulator:
// other sessions run the same app on theirs), on those dedicated simulators it runs:
// 1. flows: every Shell and game flow (a11y-tagged flows wait for step 4), the game's first and the
//    Shell's smoke/04-debug-performance last, whose S15 save benchmark is kept in save-benchmark.json;
// 2. cold start: 6 launches into Home, the median of the last 5 against the committed
//    perf-baselines/cold-start-sim-<game-id>.json x coldStartSimRegressionFactor (sim-perf-steps.ts);
// 3. memory: the game's smoke flows again, the feedback the level asked for (feedback.json: the
//    win sound and the success haptic from the perf log), then the app's phys_footprint;
// 4. large text: the a11y-tagged flows at 200 % text in en and fa, on the phone and the iPad.
// Writes reports/e2e/<game-id>/{junit.xml, network.txt, save-benchmark.json, perf.json, feedback.json, memory/, large-text/<device>-<lang>/}
// and reports/perf/sim-perf-log.json. --flows-only (while iterating) runs step 1 only; it is never
// the evidence run.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { E2E_USAGE, parseE2eCli } from '@e07/tooling/e2e/e2e-cli.ts';
import { recordSaveBenchmark, runPerfSteps } from '@e07/tooling/e2e/sim-perf-steps.ts';
import {
  appEnv,
  e2eSimulatorName,
  e2eTabletName,
  ensureSimulator,
  findSimulatorBuild,
  prepareSimulator,
  readAppInfo,
  requireAdsOffTestBuild,
  runMaestro,
  setAppearance,
  setTextSize,
  terminateApp,
  type AppInfo,
  type MaestroDevice,
} from '@e07/tooling/e2e/simulator.ts';

import type { E2eOptions } from '@e07/tooling/e2e/e2e-cli.ts';

const SOCKET_SAMPLER = join('packages', 'tooling', 'src', 'audit', 'sample-sockets.ts');
const PHONE = { key: 'phone', name: 'e07-e2e-phone', model: 'iPhone 17 Pro Max' } as const;
const TABLET = { key: 'tablet', name: 'e07-e2e-tablet', model: 'iPad Pro 13-inch (M5)' } as const;
const LARGE_TEXT = 'accessibility-extra-extra-extra-large';
const LARGE_TEXT_LANGS = ['en', 'fa'] as const;

type Cli = {
  readonly game: string;
  /** The phone simulator's name (--sim <purpose>, default e07-e2e-phone). */
  readonly phone: string;
  /** The iPad's name for the large-text step (e07-<purpose>-tablet, default e07-e2e-tablet). */
  readonly tablet: string;
  readonly appPath: string | undefined;
  /** --driver-port <n>: this session's own Maestro driver port for every run (else a free one each). */
  readonly driverPort: number | undefined;
  readonly isFlowsOnly: boolean;
  readonly isWritingBaseline: boolean;
  readonly rest: string[];
};
type E2eRun = {
  readonly cli: Cli;
  readonly udid: string;
  readonly app: AppInfo;
  readonly out: string;
  /** Starts the socket sampler on one more simulator of this run (the iPad of step 4). */
  readonly watchSockets: (udid: string) => void;
};

/** The runner's options with this session's simulator names (--sim). */
function cliOf(options: E2eOptions): Cli {
  return {
    game: options.game,
    phone: e2eSimulatorName(options.sim, PHONE.name),
    tablet: e2eTabletName(options.sim, TABLET.name),
    appPath: options.appPath,
    driverPort: options.driverPort,
    isFlowsOnly: options.isFlowsOnly,
    isWritingBaseline: options.isWritingBaseline,
    rest: [...options.maestroArgs],
  };
}

/** JUnit report and per-flow artefacts of one Maestro run into `dir`. */
const reportArgs = (dir: string): string[] => [
  ...['--format', 'JUNIT', '--output', join(dir, 'junit.xml'), '--test-output-dir', dir],
];

/** The simulator a run goes to, with the session's own driver port when it passed one. */
const deviceOf = (cli: Cli, udid: string): MaestroDevice => ({ udid, driverPort: cli.driverPort });

/** Step 1: every flow of the Shell and the game, except quarantined and a11y (step 4) ones. */
async function runFlows({ cli, udid, app, out }: E2eRun): Promise<string[]> {
  // Maestro does not recurse into sub-folders: list the <area>/<nn>-<name>.yaml files explicitly.
  const flows = [
    ...globSync('packages/shell/e2e/flows/*/*.yaml'),
    ...globSync(`apps/${cli.game}/e2e/flows/*/*.yaml`),
  ].sort();
  const status = await runMaestro(deviceOf(cli, udid), [
    'test',
    ...flows,
    ...[...reportArgs(out), '--exclude-tags', 'quarantine,a11y'],
    ...appEnv(app),
    ...cli.rest,
  ]);
  // The Shell's smoke/04-debug-performance ran last (S15's save benchmark): keep its entry now.
  recordSaveBenchmark({ udid, app, out }, flows);
  return status === 0 ? [] : [`flows: maestro test exited ${String(status)}, see ${out}`];
}

/** Step 4: the a11y flows at 200 % text, in en and fa, on the phone and the iPad. */
async function runLargeText({ cli, udid, app, out, watchSockets }: E2eRun): Promise<string[]> {
  const flows = [
    ...globSync('packages/shell/e2e/flows/a11y/*.yaml'),
    ...globSync(`apps/${cli.game}/e2e/flows/a11y/*.yaml`),
  ].sort();
  if (flows.length === 0) {
    console.log('e2e:ios: large text: no flows/a11y/ flow to run');
    return [];
  }
  const failures: string[] = [];
  for (const device of [PHONE, TABLET]) {
    const target = device.key === 'phone' ? udid : ensureSimulator(cli.tablet, device.model);
    if (device.key === 'tablet') {
      // The socket sampler follows one running copy of the app: stop the phone's first.
      terminateApp(udid, app);
      watchSockets(target);
      prepareSimulator(target, app, LARGE_TEXT);
      setAppearance(target, 'light');
    }
    setTextSize(target, LARGE_TEXT);
    for (const lang of LARGE_TEXT_LANGS) {
      const dir = join(out, 'large-text', `${device.key}-${lang}`);
      mkdirSync(dir, { recursive: true });
      const status = await runMaestro(deviceOf(cli, target), [
        'test',
        ...flows,
        ...[...reportArgs(dir), '--include-tags', 'a11y'],
        ...['--exclude-tags', 'quarantine', ...appEnv(app), '-e', `LANG=${lang}`],
      ]);
      if (status !== 0) failures.push(`large text: ${device.key} ${lang} failed, see ${dir}`);
    }
    setTextSize(target, 'large');
    if (device.key === 'tablet') terminateApp(target, app);
  }
  return failures;
}

/** Installs Maestro, prepares the phone simulator and empties reports/e2e/<game-id>/. */
function startRun(cli: Cli): Omit<E2eRun, 'watchSockets'> {
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const appPath = findSimulatorBuild(cli.game, cli.appPath);
  // Ads off, always: no Google form, no tracking prompt and no ad socket in any E2E run.
  requireAdsOffTestBuild(appPath, cli.game);
  const app = readAppInfo(appPath);
  const udid = ensureSimulator(cli.phone, PHONE.model);
  prepareSimulator(udid, app, 'large');
  setAppearance(udid, 'light');
  const out = join('reports', 'e2e', cli.game);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  console.log(`e2e:ios: phone ${cli.phone} ${udid}; every Maestro run names this UDID`);
  return { cli, udid, app, out };
}

/**
 * Layer F: one socket sampler per simulator of this run, each naming its UDID
 * (sample-sockets.ts <App> <report> <udid>), all writing to the same network.txt.
 */
function socketSamplers(
  appName: string,
  network: string,
): { readonly watch: (udid: string) => void; readonly stop: () => void } {
  const samplers: ChildProcess[] = [];
  return {
    watch: (udid) => {
      const args = [SOCKET_SAMPLER, appName, network, udid];
      samplers.push(spawn(process.execPath, args, { stdio: 'inherit' }));
    },
    stop: () => {
      for (const sampler of samplers) sampler.kill();
    },
  };
}

async function main(): Promise<number> {
  const parsed = parseE2eCli(process.argv.slice(2));
  if (parsed.kind === 'help') {
    console.log(E2E_USAGE);
    return 0;
  }
  if (parsed.kind === 'error') {
    console.error(
      `e2e:ios: ${parsed.message}\n${E2E_USAGE.split('\n')[0] ?? ''}\n(--help lists every option)`,
    );
    return 2;
  }
  const started = startRun(cliOf(parsed.options));
  const { cli, udid, app, out } = started;
  // An empty network.txt is the evidence that the samplers ran through every step and saw nothing.
  const network = join(out, 'network.txt');
  writeFileSync(network, '');
  const sockets = socketSamplers(app.name, network);
  sockets.watch(udid);
  const run: E2eRun = { ...started, watchSockets: sockets.watch };
  const failures: string[] = [];
  try {
    failures.push(...(await runFlows(run)));
    if (!cli.isFlowsOnly) {
      const { game, isWritingBaseline } = cli;
      const device = deviceOf(cli, udid);
      failures.push(...(await runPerfSteps({ game, device, app, out, isWritingBaseline })));
      failures.push(...(await runLargeText(run)));
    }
  } finally {
    sockets.stop();
  }
  if (readFileSync(network, 'utf8').trim() !== '') {
    failures.push(`network: the app opened non-loopback sockets (spec N3), see ${network}`);
  }
  for (const failure of failures) console.error(`e2e:ios: ${failure}`);
  return failures.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 2;
  });
