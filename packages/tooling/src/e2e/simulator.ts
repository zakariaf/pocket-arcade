// packages/tooling/src/e2e/simulator.ts — dedicated, named simulators (never touch other agents' ones)
// and the environment every Maestro run needs, on ios-simulator-build's one simulator layer: simctl
// runs under the pinned Xcode (createSimctl(selectXcode(env)), DEVELOPER_DIR, never xcode-select),
// e07- simulators are found or created by ensureSimulator on toolchain.ts's IOS_RUNTIME, and the
// status bar is statusBarArgs, the same one build:ios:sim pins. Every simctl call names the
// simulator's UDID (never "booted"), and every Maestro run goes through runMaestro: the global
// --device <udid> and a driver port of its own (maestro-args.ts) before the command.
import { execFileSync, spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appProcessPattern } from '@e07/tooling/audit/network-runtime-layer.ts';
import { simProductsDir } from '@e07/tooling/build/sim-build-plan.ts';
import {
  freeDriverPort,
  maestroGlobalArgs,
  maestroRunLine,
} from '@e07/tooling/e2e/maestro-args.ts';
import { debugSetupTestArgs, MAESTRO_BIN, maestroEnvOf } from '@e07/tooling/ios/maestro-tool.ts';
import { readBundleId, readExecutableName, readUrlScheme } from '@e07/tooling/ios/sim-app.ts';
import {
  createSimctl,
  ensureSimulator,
  findSimulator,
  SIMULATOR_PREFIX,
  statusBarArgs,
  type Simctl,
  type SimctlDeviceList,
} from '@e07/tooling/ios/simulators.ts';
import { IOS_RUNTIME, selectXcode, type ToolEnv } from '@e07/tooling/ios/toolchain.ts';

export type { Simctl } from '@e07/tooling/ios/simulators.ts';

/** `name` is the executable (CFBundleExecutable), which the socket sampler looks for. */
export type AppInfo = {
  readonly path: string;
  readonly id: string;
  readonly scheme: string;
  readonly name: string;
};

/**
 * simctl for this run: under the pinned Xcode (selectXcode's DEVELOPER_DIR), as build:ios:sim runs
 * it. Make it once per run and pass it on: selectXcode proves the version with xcodebuild.
 */
export function e2eSimctl(
  base: ToolEnv = process.env,
  select: (env: ToolEnv) => NodeJS.ProcessEnv = selectXcode,
): Simctl {
  return createSimctl(select(base));
}

export function readAppInfo(appPath: string): AppInfo {
  return {
    path: appPath,
    id: readBundleId(appPath),
    scheme: readUrlScheme(appPath),
    name: readExecutableName(appPath),
  };
}

const SIMULATOR_NAME = /^e07-[a-z0-9]+(-[a-z0-9]+)*$/;

const simulatorNameOf = (value: string): string =>
  value.startsWith('e07-') ? value : `e07-${value}`;

/**
 * Why --sim <value> names no simulator of this session, or null (also without --sim). Both command
 * lines (e2e-cli.ts, screenshots-cli.ts) ask while parsing, so a bad value is a usage error (exit 2,
 * no stack) before Maestro is installed or a simulator starts.
 */
export function simOptionProblem(value: string | undefined): string | null {
  if (value === undefined || SIMULATOR_NAME.test(simulatorNameOf(value))) return null;
  return `--sim ${value}: pass a kebab-case purpose such as --sim r3-e2e (the simulator is e07-<purpose>)`;
}

/**
 * --sim <purpose>: the run's phone simulator e07-<purpose> (a value that already starts with e07-
 * is kept), so a session can reuse its own simulator; without it, `fallback`.
 */
export function e2eSimulatorName(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const problem = simOptionProblem(value);
  if (problem !== null) throw new Error(problem);
  return simulatorNameOf(value);
}

/**
 * The iPad of the large-text step: e07-<purpose>-tablet with --sim, so a session never drives
 * another session's iPad either; without it, `fallback`.
 */
export function e2eTabletName(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : e2eSimulatorName(`${value}-tablet`, fallback);
}

/** What to do when simctl cannot boot another simulator (other sessions' simulators fill the Mac). */
export function bootFailureMessage(name: string, errorText: string): string | null {
  if (!/insufficient system resources|maxUserProcs/i.test(errorText)) return null;
  return [
    `simctl could not boot ${name}: the Mac has no room for another simulator (insufficient system resources).`,
    "Shut down this session's own e07-* simulators (xcrun simctl list devices booted, then xcrun simctl shutdown <udid> for each of yours), never another session's,",
    'or reuse one of yours with --sim <purpose>, then run again.',
  ].join(' ');
}

function boot(simctl: Simctl, udid: string, name: string): void {
  try {
    simctl(['boot', udid]);
  } catch (error: unknown) {
    const stderr = (error as { readonly stderr?: unknown }).stderr;
    const detail = typeof stderr === 'string' || Buffer.isBuffer(stderr) ? stderr.toString() : '';
    const text = `${error instanceof Error ? error.message : String(error)} ${detail}`;
    const message = bootFailureMessage(name, text);
    if (message === null) throw error;
    throw new Error(message, { cause: error });
  }
}

/**
 * Finds (or creates) the e07- simulator `name` on IOS_RUNTIME and starts its boot without waiting
 * for it: waitForBoot waits, so another simulator can boot meanwhile. Returns its UDID.
 */
export function startSimulator(simctl: Simctl, name: string, model: string): string {
  if (!name.startsWith(SIMULATOR_PREFIX)) {
    throw new Error(`${name}: e2e runs only on this session's own ${SIMULATOR_PREFIX}* simulators`);
  }
  const udid = ensureSimulator(simctl, name.slice(SIMULATOR_PREFIX.length), model);
  const list = JSON.parse(simctl(['list', 'devices', '--json'])) as SimctlDeviceList;
  if (findSimulator(list, name, IOS_RUNTIME)?.state !== 'Booted') boot(simctl, udid, name);
  return udid;
}

/** One simulator of the run: its UDID and the run's simctl (under the pinned Xcode). */
export type Sim = { readonly simctl: Simctl; readonly udid: string };

/** Waits until the simulator has finished booting. */
export function waitForBoot({ simctl, udid }: Sim): void {
  simctl(['bootstatus', udid, '-b']);
}

/** Installs the app, pins build:ios:sim's status bar (statusBarArgs) and sets the text size. */
export function prepareSimulator(sim: Sim, app: AppInfo, textSize: string): void {
  sim.simctl(['install', sim.udid, app.path]);
  sim.simctl(statusBarArgs(sim.udid));
  setTextSize(sim, textSize);
}

/** Dynamic Type: 'large' (the default) or 'accessibility-extra-extra-extra-large' (200 % text). */
export function setTextSize({ simctl, udid }: Sim, textSize: string): void {
  simctl(['ui', udid, 'content_size', textSize]);
}

/** Stops the app if it runs (not running is fine). */
export function terminateApp({ simctl, udid }: Sim, app: AppInfo): void {
  try {
    simctl(['terminate', udid, app.id]);
  } catch {
    // not running
  }
}

export function launchApp({ simctl, udid }: Sim, app: AppInfo): void {
  simctl(['launch', udid, app.id]);
}

/** The app's data container (Documents/SQLite/save.db lives under it). */
export function appDataDir({ simctl, udid }: Sim, app: AppInfo): string {
  return simctl(['get_app_container', udid, app.id, 'data']).trim();
}

/**
 * The app's process on this simulator only (the same build may run on several simulators), in any
 * bundle folder: Maestro's clearState reinstalls it as <bundle id>-<timestamp>.app.
 */
export function appPidOn(udid: string, appName: string): string | null {
  try {
    const pattern = appProcessPattern(appName, udid);
    return (
      execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' }).trim().split('\n')[0] ?? null
    );
  } catch {
    return null; // not running
  }
}

/**
 * The build every E2E run and every capture uses (--app-path, else the Release simulator build of
 * the game), refused unless it is the test variant with ads off (requireAdsOffTestBuild): one
 * lookup, so no path can run on an ads-on build.
 */
export function findSimulatorBuild(game: string, override: string | undefined): string {
  const built = simProductsDir(join('apps', game));
  const appPath = override ?? globSync(join(built, '*.app'))[0];
  if (appPath === undefined) {
    throw new Error(
      `no simulator build in ${built}: run npm run build:ios:sim -- --app ${game} --variant test --ads off`,
    );
  }
  requireAdsOffTestBuild(appPath, game);
  return appPath;
}

/** The variant a build was made with (withShell's expo.extra, embedded in EXConstants.bundle). */
export type BuildVariantInfo = { readonly appVariant: unknown; readonly adsMode: unknown };

/**
 * E2E runs only a test-variant build with ads off: the debug link and S15 exist, and neither
 * Google's consent form, Apple's tracking prompt nor an ad SDK socket can cover a screen or fill
 * network.txt (ConsentPort never asks with ads mode off). Null when the build fits.
 */
export function e2eBuildProblem(build: BuildVariantInfo, game: string): string | null {
  if (build.appVariant === 'test' && build.adsMode === 'off') return null;
  const found = `${String(build.appVariant)}/${String(build.adsMode)}`;
  return `e2e:ios needs a test build with ADS_MODE=off, this one is ${found}: run npm run build:ios:sim -- --app ${game} --variant test --ads off`;
}

/** Reads EXConstants.bundle/app.config and throws when the build is not test/off. */
export function requireAdsOffTestBuild(appPath: string, game: string): void {
  const config = readFileSync(join(appPath, 'EXConstants.bundle', 'app.config'), 'utf8');
  const extra = (JSON.parse(config) as { extra?: BuildVariantInfo }).extra;
  const problem = e2eBuildProblem(extra ?? { appVariant: null, adsMode: null }, game);
  if (problem !== null) throw new Error(problem);
}

export function setAppearance({ simctl, udid }: Sim, theme: 'light' | 'dark'): void {
  simctl(['ui', udid, 'appearance', theme]);
}

/** Java 17 and no telemetry, update check or analysis prompt (no data leaves the Mac). */
export function maestroEnv(): NodeJS.ProcessEnv {
  return maestroEnvOf(process.env);
}

/** Where a Maestro run goes: the simulator's UDID and, when the session passes its own, a port. */
export type MaestroDevice = {
  readonly udid: string;
  /** --driver-port <n> of the session; without it every run gets a free port of its own. */
  readonly driverPort?: number | undefined;
};

/**
 * `maestro --device <udid> --driver-host-port <port> <args>` with Java 17 and no telemetry; returns
 * Maestro's exit code. A run of its own port never talks to another session's XCTest driver (the
 * default port 7001 answered from another simulator in round 3).
 */
export async function runMaestro(device: MaestroDevice, args: readonly string[]): Promise<number> {
  const target = { udid: device.udid, driverPort: device.driverPort ?? (await freeDriverPort()) };
  console.log(maestroRunLine(target, args));
  const command = [...maestroGlobalArgs(target), ...args];
  return spawnSync(MAESTRO_BIN, command, { stdio: 'inherit', env: maestroEnv() }).status ?? 1;
}

/** The -e values every flow reads: the app's bundle id and URL scheme. */
export function appEnv(app: AppInfo): string[] {
  return ['-e', `APP_ID=${app.id}`, '-e', `APP_SCHEME=${app.scheme}`];
}

export type DebugSetupRun = {
  readonly app: AppInfo;
  /** The debug link's query, for example 'lang=en&firstRun=0&screen=home'. */
  readonly query: string;
  /** The testID that proves the link's screen is shown. */
  readonly waitFor: string;
  readonly outDir: string;
};

/**
 * `maestro test` arguments that apply one debug link to the running app through the shared setup
 * sub-flow (never `simctl openurl`: iOS answers a custom scheme opened from outside with an "Open in
 * <app>?" prompt that only the sub-flow accepts) and wait for waitFor; run them with runMaestro,
 * which puts the device and the driver port first.
 */
export function debugSetupArgs(run: DebugSetupRun): string[] {
  const { app, query, waitFor, outDir } = run;
  return debugSetupTestArgs({ appId: app.id, scheme: app.scheme, query, waitFor, outDir });
}
