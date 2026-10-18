// packages/tooling/src/e2e/run-e2e-ios.ts —
// `npm run e2e:ios -- --app <game-id> [--sim <purpose>] [--driver-port <n>] [--app-path <App.app>] [--flows-only] [--write-perf-baseline] [--include-tags <tags>]`
// (--help prints every option; a bad command line prints the usage line and exits 2, e2e-cli.ts)
// --sim runs the phone steps on this session's own simulator e07-<purpose> (default e07-e2e-phone)
// and the iPad steps on e07-<purpose>-tablet (default e07-e2e-tablet; it boots while the flows run).
// Every Maestro run names its simulator's UDID and a driver port of its own (one free port per
// simulator for the whole run, or --driver-port for the whole session) before the command, so no
// run reaches another session's simulator.
// Needs a Release simulator build of the test variant with ADS_MODE=off and refuses any other
// (findSimulatorBuild, the one build lookup e2e:ios and screenshots:ios share): with ads off ConsentPort asks neither Google's form nor Apple's tracking
// prompt, so no system prompt covers a screen and no ad SDK opens a socket. While the layer-F
// socket sampler watches the app's sockets on this run's own simulators (one sampler per simulator:
// other sessions run the same app on theirs), on those dedicated simulators it runs:
// 1. flows: every Shell and game flow (a11y-tagged flows wait for step 4), then the Shell's
//    smoke/04-debug-performance in a call of its own, whose S15 save benchmark is kept in
//    save-benchmark.json right after it (its test case joins junit.xml);
// 2. cold start: 6 launches into Home, the median of the last 5 against the committed
//    perf-baselines/cold-start-sim-<game-id>.json x coldStartSimRegressionFactor (sim-perf-steps.ts);
// 3. memory: the game's smoke flows again, the feedback the level asked for (feedback.json: the
//    win sound and the success haptic from the perf log), then the app's phys_footprint;
// 4. large text: the a11y-tagged flows at 200 % text in en and fa, on the phone and the iPad.
// Writes reports/e2e/<game-id>/{junit.xml, network.txt, save-benchmark.json, perf.json, feedback.json, memory/, large-text/<device>-<lang>/}
// and reports/perf/sim-perf-log.json. --flows-only (while iterating) runs step 1 only; it is never
// the evidence run.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { SAMPLER_PROOF_WAIT_MS } from '@e07/tooling/audit/network-runtime-layer.ts';
import { E2E_USAGE, parseE2eCli } from '@e07/tooling/e2e/e2e-cli.ts';
import {
  allFlows,
  largeTextFlows,
  mergeJunitInto,
  reportArgs,
} from '@e07/tooling/e2e/flow-files.ts';
import { freeDriverPort } from '@e07/tooling/e2e/maestro-args.ts';
import {
  proveSamplersAlive,
  trackSampler,
  type RunningSampler,
} from '@e07/tooling/e2e/sampler-evidence.ts';
import { flowCallsOf } from '@e07/tooling/e2e/save-benchmark-evidence.ts';
import { recordSaveBenchmark, runPerfSteps } from '@e07/tooling/e2e/sim-perf-steps.ts';
import {
  appEnv,
  e2eSimctl,
  e2eSimulatorName,
  e2eTabletName,
  findSimulatorBuild,
  prepareSimulator,
  readAppInfo,
  runMaestro,
  setAppearance,
  setTextSize,
  startSimulator,
  terminateApp,
  waitForBoot,
  type AppInfo,
  type MaestroDevice,
  type Simctl,
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
  /** simctl under the pinned Xcode, for every simulator of the run. */
  readonly simctl: Simctl;
  readonly udid: string;
  /** The phone and the one driver port all its Maestro runs use (--driver-port, else one free port). */
  readonly phone: MaestroDevice;
  /** The iPad of step 4, booting since the run started (null: no step 4 in this run). */
  readonly tablet: string | null;
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

/** A simulator of the run with its one driver port: the session's own, else one free port. */
async function deviceOf(cli: Cli, udid: string): Promise<MaestroDevice> {
  return { udid, driverPort: cli.driverPort ?? (await freeDriverPort()) };
}

/** One `maestro test` call of the flows step, reported into `dir`; its exit code. */
function testFlows(run: E2eRun, flows: readonly string[], dir: string): Promise<number> {
  const { cli, phone, app } = run;
  return runMaestro(phone, [
    'test',
    ...flows,
    ...[...reportArgs(dir), '--exclude-tags', 'quarantine,a11y'],
    ...appEnv(app),
    ...cli.rest,
  ]);
}

/**
 * Step 1: every flow of the Shell and the game, except quarantined and a11y (step 4) ones; S15's
 * save benchmark flow in a call of its own after the others, its perf-log entry kept right after it
 * (save-benchmark.json) and its test case added to junit.xml.
 */
async function runFlows(run: E2eRun): Promise<string[]> {
  const { cli, simctl, udid, app, out } = run;
  // Maestro does not recurse into sub-folders: allFlows lists the <area>/<nn>-<name>.yaml files.
  const { others, benchmark } = flowCallsOf(allFlows(cli.game), cli.rest);
  const statuses = others.length === 0 ? [] : [await testFlows(run, others, out)];
  let mergeFailure: string | null = null;
  if (benchmark !== null) {
    const dir = join(out, 'save-benchmark-flow');
    statuses.push(await testFlows(run, [benchmark], dir));
    recordSaveBenchmark({ sim: { simctl, udid }, app, out }, [benchmark]);
    mergeFailure = mergeJunitInto(out, dir);
  }
  const failed = statuses.filter((status) => status !== 0);
  return [
    ...failed.map((status) => `flows: maestro test exited ${String(status)}, see ${out}`),
    ...(mergeFailure === null ? [] : [mergeFailure]),
  ];
}

/** Step 4: the a11y flows at 200 % text, in en and fa, on the phone and the iPad. */
async function runLargeText(run: E2eRun): Promise<string[]> {
  const { cli, simctl, udid, app, out, watchSockets } = run;
  const flows = largeTextFlows(cli.game);
  if (flows.length === 0) {
    console.log('e2e:ios: large text: no flows/a11y/ flow to run');
    return [];
  }
  const failures: string[] = [];
  for (const device of [PHONE, TABLET]) {
    const target =
      device.key === 'phone'
        ? udid
        : (run.tablet ?? startSimulator(simctl, cli.tablet, device.model));
    const sim = { simctl, udid: target };
    const maestroDevice = device.key === 'phone' ? run.phone : await deviceOf(cli, target);
    if (device.key === 'tablet') {
      waitForBoot(sim);
      // The socket sampler follows one running copy of the app: stop the phone's first.
      terminateApp({ simctl, udid }, app);
      watchSockets(target);
      prepareSimulator(sim, app, LARGE_TEXT);
      setAppearance(sim, 'light');
    }
    setTextSize(sim, LARGE_TEXT);
    for (const lang of LARGE_TEXT_LANGS) {
      const dir = join(out, 'large-text', `${device.key}-${lang}`);
      mkdirSync(dir, { recursive: true });
      const status = await runMaestro(maestroDevice, [
        'test',
        ...flows,
        ...[...reportArgs(dir), '--include-tags', 'a11y'],
        ...['--exclude-tags', 'quarantine', ...appEnv(app), '-e', `LANG=${lang}`],
      ]);
      if (status !== 0) failures.push(`large text: ${device.key} ${lang} failed, see ${dir}`);
    }
    setTextSize(sim, 'large');
    if (device.key === 'tablet') terminateApp(sim, app);
  }
  return failures;
}

/**
 * Installs Maestro, prepares the phone simulator, starts the iPad's boot for step 4 (it boots while
 * the flows run; step 4 waits for it) and empties reports/e2e/<game-id>/.
 */
async function startRun(cli: Cli): Promise<Omit<E2eRun, 'watchSockets'>> {
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  // Ads off, always (findSimulatorBuild refuses any other build): no Google form, no tracking
  // prompt and no ad socket in any E2E run.
  const appPath = findSimulatorBuild(cli.game, cli.appPath);
  const app = readAppInfo(appPath);
  const simctl = e2eSimctl();
  const udid = startSimulator(simctl, cli.phone, PHONE.model);
  const hasLargeText = !cli.isFlowsOnly && largeTextFlows(cli.game).length > 0;
  const tablet = hasLargeText ? startSimulator(simctl, cli.tablet, TABLET.model) : null;
  const sim = { simctl, udid };
  waitForBoot(sim);
  prepareSimulator(sim, app, 'large');
  setAppearance(sim, 'light');
  const out = join('reports', 'e2e', cli.game);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  console.log(`e2e:ios: phone ${cli.phone} ${udid}; every Maestro run names this UDID`);
  return { cli, simctl, udid, phone: await deviceOf(cli, udid), tablet, app, out };
}

/**
 * Layer F: one socket sampler per simulator of this run, each naming its UDID
 * (sample-sockets.ts <App> <report> <udid>), all writing to the same network.txt, each with its
 * own status file. stop() kills them only after proving each one alive until the end
 * (sampler-evidence.ts); its failure lines fail the run, so a dead sampler is never an N3 pass.
 */
function socketSamplers(
  appName: string,
  network: string,
): { readonly watch: (udid: string) => void; readonly stop: () => Promise<string[]> } {
  const samplers: RunningSampler[] = [];
  return {
    watch: (udid) => {
      const args = [SOCKET_SAMPLER, appName, network, udid];
      samplers.push(trackSampler(udid, spawn(process.execPath, args, { stdio: 'inherit' })));
    },
    stop: () => proveSamplersAlive(samplers, network, () => delay(SAMPLER_PROOF_WAIT_MS)),
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
  const started = await startRun(cliOf(parsed.options));
  const { cli, simctl, udid, phone, app, out } = started;
  // An empty network.txt is the evidence, from samplers proven alive through every step (stop()).
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
      const input = { game, device: phone, simctl, app, out, isWritingBaseline };
      failures.push(...(await runPerfSteps(input)));
      failures.push(...(await runLargeText(run)));
    }
  } finally {
    // Every sampler proven alive until here, or the run fails: no N3 pass from a dead sampler.
    failures.push(...(await sockets.stop()));
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
