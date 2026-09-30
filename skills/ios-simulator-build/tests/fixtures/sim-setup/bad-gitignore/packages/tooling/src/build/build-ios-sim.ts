// packages/tooling/src/build/build-ios-sim.ts
// CLI: npm run build:ios:sim -- --app <game-id> [--variant test|store] [--ads off|test|live] [--sim <purpose>]
// Clean prebuild, Release simulator build (no signing, arm64), then install, launch, wait until
// ready and screenshot on the dedicated simulator e07-<purpose>. No Metro: Release embeds the bundle.
// Every step logs to apps/<game>/build/logs/<step>.log; the first failing step stops the run.
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  builtAppPath,
  parseSimBuildArgs,
  PREBUILD_ARGS,
  READY_MAX_ATTEMPTS,
  READY_POLL_MS,
  readyReason,
  schemeOf,
  screenshotPath,
  variantEnv,
  xcodebuildSimArgs,
  type SimBuildOptions,
} from '@e07/tooling/build/sim-build-plan.ts';
import {
  bootForScreenshots,
  createSimctl,
  DEFAULT_DEVICE_TYPE,
  ensureSimulator,
  installAndLaunch,
  type AppOnDisk,
  type Simctl,
} from '@e07/tooling/ios/simulators.ts';
import { selectXcode } from '@e07/tooling/ios/toolchain.ts';

type StepContext = { readonly appDir: string; readonly env: NodeJS.ProcessEnv };
type Command = { readonly file: string; readonly args: readonly string[] };

function tail(file: string, lines: number): string {
  return readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
}

/** Runs one step with its output in build/logs/<step>.log; throws with the log's tail on failure. */
function runStep(name: string, command: Command, context: StepContext): void {
  const logDir = join(context.appDir, 'build', 'logs');
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${name}.log`);
  const fd = openSync(logFile, 'w');
  console.log(`build:ios:sim: ${name} ...`);
  const result = spawnSync(command.file, command.args, {
    cwd: context.appDir,
    env: context.env,
    stdio: ['ignore', fd, fd],
  });
  closeSync(fd);
  if (result.status !== 0) {
    throw new Error(
      `step "${name}" failed (exit ${String(result.status)}), see ${logFile}:\n${tail(logFile, 30)}`,
    );
  }
}

function findWorkspace(appDir: string): string {
  const iosDir = join(appDir, 'ios');
  const found = readdirSync(iosDir).find((entry) => entry.endsWith('.xcworkspace'));
  if (found === undefined) {
    throw new Error(
      `no .xcworkspace in ${iosDir}: prebuild did not finish, see build/logs/prebuild.log`,
    );
  }
  return join('ios', found);
}

function readBundleId(appPath: string): string {
  return execFileSync(
    'plutil',
    ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', join(appPath, 'Info.plist')],
    {
      encoding: 'utf8',
    },
  ).trim();
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** The perf-log payload, or null when the app has no perf log (store builds, early Shells). */
function readPerfLog(simctl: Simctl, udid: string, bundleId: string): string | null {
  const container = simctl(['get_app_container', udid, bundleId, 'data']).trim();
  const database = join(container, 'Documents', 'SQLite', 'save.db');
  if (!existsSync(database)) {
    return null;
  }
  const result = spawnSync('sqlite3', [database, 'SELECT payload FROM perf_log WHERE id = 1'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout : null;
}

/** Polls every 500 ms (never a fixed sleep), then keeps the last screenshot. */
function waitAndScreenshot(
  simctl: Simctl,
  app: AppOnDisk & { readonly udid: string },
  out: string,
): string {
  mkdirSync(dirname(out), { recursive: true });
  let previous = '';
  for (let attempt = 1; attempt <= READY_MAX_ATTEMPTS; attempt += 1) {
    sleep(READY_POLL_MS);
    simctl(['io', app.udid, 'screenshot', out]);
    const current = readFileSync(out).toString('base64');
    const reason = readyReason({
      attempt,
      perfLog: readPerfLog(simctl, app.udid, app.bundleId),
      screenUnchanged: current === previous,
    });
    if (reason !== null) {
      simctl(['io', app.udid, 'screenshot', out]);
      return reason;
    }
    previous = current;
  }
  throw new Error(
    `the app was not ready after ${String((READY_MAX_ATTEMPTS * READY_POLL_MS) / 1000)} s; look at ${out}`,
  );
}

function buildApp(options: SimBuildOptions, context: StepContext, udid: string): AppOnDisk {
  runStep('prebuild', { file: 'npx', args: PREBUILD_ARGS }, context);
  const workspace = findWorkspace(context.appDir);
  const scheme = schemeOf(workspace);
  runStep(
    'xcodebuild',
    { file: 'xcodebuild', args: xcodebuildSimArgs({ workspace, scheme, udid }) },
    context,
  );
  const path = builtAppPath(join('apps', options.game), scheme);
  return { path, bundleId: readBundleId(path) };
}

function main(): number {
  const options = parseSimBuildArgs(process.argv.slice(2));
  const appDir = join('apps', options.game);
  if (!existsSync(join(appDir, 'app.config.ts'))) {
    throw new Error(
      `${appDir}/app.config.ts not found: run from the repo root with an existing game`,
    );
  }
  const env = { ...selectXcode(process.env), ...variantEnv(options.variant) };
  const simctl = createSimctl(env);
  const udid = ensureSimulator(simctl, options.purpose, DEFAULT_DEVICE_TYPE);
  const app = buildApp(options, { appDir, env }, udid);
  bootForScreenshots(simctl, udid);
  installAndLaunch(simctl, udid, app);
  const out = screenshotPath(options);
  const reason = waitAndScreenshot(simctl, { ...app, udid }, out);
  console.log(
    `build:ios:sim: ${options.variant.appVariant}/${options.variant.adsMode} app ${app.path}`,
  );
  console.log(
    `build:ios:sim: ready (${reason}) on e07-${options.purpose} ${udid}; screenshot ${out}`,
  );
  console.log(
    'build:ios:sim: open the screenshot and look at it: white or black means the app failed.',
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error: unknown) {
  console.error(`build:ios:sim: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
