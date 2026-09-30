// packages/tooling/src/e2e/run-e2e-ios.ts —
// `npm run e2e:ios -- --app <game-id> [--flows-only] [--write-perf-baseline] [maestro test options]`
// Needs a Release simulator build of the test variant with ADS_MODE=off. While the layer-F socket
// sampler watches the app's sockets, on dedicated simulators it runs:
// 1. flows: every Shell and game flow (a11y-tagged flows wait for step 4);
// 2. cold start: 6 launches into Home, the median of the last 5 against the committed
//    perf-baselines/cold-start-sim-<game-id>.json x coldStartSimRegressionFactor (sim-perf-steps.ts);
// 3. memory: the game's smoke flows again, then the app's phys_footprint (sim-perf-steps.ts);
// 4. large text: the a11y-tagged flows at 200 % text in en and fa, on the phone and the iPad.
// Writes reports/e2e/<game-id>/{junit.xml, network.txt, perf.json, memory/, large-text/<device>-<lang>/}
// and reports/perf/sim-perf-log.json. --flows-only (while iterating) runs step 1 only; it is never
// the evidence run.
import { execFileSync, spawn } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runPerfSteps } from '@e07/tooling/e2e/sim-perf-steps.ts';
import {
  appEnv,
  ensureSimulator,
  findSimulatorBuild,
  prepareSimulator,
  readAppInfo,
  runMaestro,
  setAppearance,
  setTextSize,
  terminateApp,
  type AppInfo,
} from '@e07/tooling/e2e/simulator.ts';

const SOCKET_SAMPLER = join('packages', 'tooling', 'src', 'audit', 'sample-sockets.ts');
const PHONE = { key: 'phone', name: 'e07-e2e-phone', model: 'iPhone 17 Pro Max' } as const;
const TABLET = { key: 'tablet', name: 'e07-e2e-tablet', model: 'iPad Pro 13-inch (M5)' } as const;
const LARGE_TEXT = 'accessibility-extra-extra-extra-large';
const LARGE_TEXT_LANGS = ['en', 'fa'] as const;

type Cli = {
  readonly game: string;
  readonly appPath: string | undefined;
  readonly isFlowsOnly: boolean;
  readonly isWritingBaseline: boolean;
  readonly rest: string[];
};
type E2eRun = {
  readonly cli: Cli;
  readonly udid: string;
  readonly app: AppInfo;
  readonly out: string;
};

function parseCli(argv: readonly string[]): Cli {
  const rest = [...argv];
  const take = (flag: string): string | undefined => {
    const index = rest.indexOf(flag);
    return index === -1 ? undefined : rest.splice(index, 2)[1];
  };
  const has = (flag: string): boolean => {
    const index = rest.indexOf(flag);
    if (index !== -1) rest.splice(index, 1);
    return index !== -1;
  };
  const game = take('--app');
  if (game === undefined) {
    throw new Error(
      'usage: npm run e2e:ios -- --app <game-id> [--flows-only] [--write-perf-baseline] [maestro test options]',
    );
  }
  return {
    game,
    appPath: take('--app-path'),
    isFlowsOnly: has('--flows-only'),
    isWritingBaseline: has('--write-perf-baseline'),
    rest,
  };
}

/** JUnit report and per-flow artefacts of one Maestro run into `dir`. */
const reportArgs = (dir: string): string[] => [
  ...['--format', 'JUNIT', '--output', join(dir, 'junit.xml'), '--test-output-dir', dir],
];

/** Step 1: every flow of the Shell and the game, except quarantined and a11y (step 4) ones. */
function runFlows({ cli, udid, app, out }: E2eRun): string[] {
  // Maestro does not recurse into sub-folders: list the <area>/<nn>-<name>.yaml files explicitly.
  const flows = [
    ...globSync('packages/shell/e2e/flows/*/*.yaml'),
    ...globSync(`apps/${cli.game}/e2e/flows/*/*.yaml`),
  ].sort();
  const status = runMaestro([
    'test',
    ...flows,
    ...['--udid', udid, ...reportArgs(out), '--exclude-tags', 'quarantine'],
    ...appEnv(app),
    ...cli.rest,
  ]);
  return status === 0 ? [] : [`flows: maestro test exited ${String(status)}, see ${out}`];
}

/** Step 4: the a11y flows at 200 % text, in en and fa, on the phone and the iPad. */
function runLargeText({ cli, udid, app, out }: E2eRun): string[] {
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
    const target = device.key === 'phone' ? udid : ensureSimulator(device.name, device.model);
    if (device.key === 'tablet') {
      // The socket sampler follows one running copy of the app: stop the phone's first.
      terminateApp(udid, app);
      prepareSimulator(target, app, LARGE_TEXT);
      setAppearance(target, 'light');
    }
    setTextSize(target, LARGE_TEXT);
    for (const lang of LARGE_TEXT_LANGS) {
      const dir = join(out, 'large-text', `${device.key}-${lang}`);
      mkdirSync(dir, { recursive: true });
      const status = runMaestro([
        'test',
        ...flows,
        ...['--udid', target, ...reportArgs(dir), '--include-tags', 'a11y'],
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
function startRun(cli: Cli): E2eRun {
  execFileSync('bash', [join('packages', 'tooling', 'scripts', 'install-maestro.sh')], {
    stdio: 'ignore',
  });
  const app = readAppInfo(findSimulatorBuild(cli.game, cli.appPath));
  const udid = ensureSimulator(PHONE.name, PHONE.model);
  prepareSimulator(udid, app, 'large');
  setAppearance(udid, 'light');
  const out = join('reports', 'e2e', cli.game);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  return { cli, udid, app, out };
}

async function main(): Promise<number> {
  const run = startRun(parseCli(process.argv.slice(2)));
  const { cli, udid, app, out } = run;
  // An empty network.txt is the evidence that the sampler ran through every step and saw nothing.
  const network = join(out, 'network.txt');
  writeFileSync(network, '');
  const sampler = spawn(process.execPath, [SOCKET_SAMPLER, app.name, network], {
    stdio: 'inherit',
  });
  const failures: string[] = [];
  try {
    failures.push(...runFlows(run));
    if (!cli.isFlowsOnly) {
      const { game, isWritingBaseline } = cli;
      console.log(game, isWritingBaseline);
      failures.push(...runLargeText(run));
    }
  } finally {
    sampler.kill();
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
