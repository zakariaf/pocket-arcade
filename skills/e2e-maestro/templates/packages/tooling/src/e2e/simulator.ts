// packages/tooling/src/e2e/simulator.ts — dedicated, named simulators (never touch other agents' ones)
// and the environment every Maestro run needs.
import { execFileSync, spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { join } from 'node:path';

import { appProcessPattern } from '@e07/tooling/audit/network-runtime-layer.ts';

export const IOS_RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5';
const ANDROID_STUDIO_JAVA = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const MAESTRO = join('tools', 'maestro', 'bin', 'maestro');

/** `name` is the executable (CFBundleExecutable), which the socket sampler looks for. */
export type AppInfo = {
  readonly path: string;
  readonly id: string;
  readonly scheme: string;
  readonly name: string;
};

type SimDevice = { readonly name: string; readonly udid: string; readonly state: string };
type SimctlDevices = { readonly devices: Readonly<Record<string, readonly SimDevice[]>> };

function simctl(args: readonly string[]): string {
  return execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' });
}

export function readAppInfo(appPath: string): AppInfo {
  const plist = join(appPath, 'Info.plist');
  const read = (keyPath: string): string =>
    execFileSync('plutil', ['-extract', keyPath, 'raw', '-o', '-', plist], {
      encoding: 'utf8',
    }).trim();
  return {
    path: appPath,
    id: read('CFBundleIdentifier'),
    scheme: read('CFBundleURLTypes.0.CFBundleURLSchemes.0'),
    name: read('CFBundleExecutable'),
  };
}

const SIMULATOR_NAME = /^e07-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * --sim <purpose>: the run's phone simulator e07-<purpose> (a value that already starts with e07-
 * is kept), so a session can reuse its own simulator; without it, `fallback`.
 */
export function e2eSimulatorName(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const name = value.startsWith('e07-') ? value : `e07-${value}`;
  if (!SIMULATOR_NAME.test(name)) {
    throw new Error(
      `--sim ${value}: pass a kebab-case purpose such as --sim r3-e2e (the simulator is e07-<purpose>)`,
    );
  }
  return name;
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

function boot(udid: string, name: string): void {
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

export function ensureSimulator(name: string, model: string): string {
  const list = JSON.parse(simctl(['list', 'devices', '--json'])) as SimctlDevices;
  const existing = (list.devices[IOS_RUNTIME] ?? []).find((device) => device.name === name);
  const udid = existing?.udid ?? simctl(['create', name, model, IOS_RUNTIME]).trim();
  if (existing?.state !== 'Booted') {
    boot(udid, name);
  }
  simctl(['bootstatus', udid, '-b']);
  return udid;
}

export function prepareSimulator(udid: string, app: AppInfo, textSize: string): void {
  simctl(['install', udid, app.path]);
  simctl([
    'status_bar',
    udid,
    'override',
    '--time',
    '9:41',
    '--dataNetwork',
    'wifi',
    '--wifiMode',
    'active',
    '--wifiBars',
    '3',
    '--cellularMode',
    'active',
    '--cellularBars',
    '4',
    '--batteryState',
    'charged',
    '--batteryLevel',
    '100',
  ]);
  setTextSize(udid, textSize);
}

/** Dynamic Type: 'large' (the default) or 'accessibility-extra-extra-extra-large' (200 % text). */
export function setTextSize(udid: string, textSize: string): void {
  simctl(['ui', udid, 'content_size', textSize]);
}

/** Stops the app if it runs (not running is fine). */
export function terminateApp(udid: string, app: AppInfo): void {
  spawnSync('xcrun', ['simctl', 'terminate', udid, app.id], { stdio: 'ignore' });
}

export function launchApp(udid: string, app: AppInfo): void {
  simctl(['launch', udid, app.id]);
}

/** The app's data container (Documents/SQLite/save.db lives under it). */
export function appDataDir(udid: string, app: AppInfo): string {
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

export function findSimulatorBuild(game: string, override: string | undefined): string {
  const built = join('apps', game, 'build', 'dd', 'Build', 'Products', 'Release-iphonesimulator');
  const appPath = override ?? globSync(join(built, '*.app'))[0];
  if (appPath === undefined) {
    throw new Error(
      `no simulator build in ${built}: run npm run build:ios:sim -- --app ${game} --variant test --ads off`,
    );
  }
  return appPath;
}

export function setAppearance(udid: string, theme: 'light' | 'dark'): void {
  simctl(['ui', udid, 'appearance', theme]);
}

function javaHome(): string {
  try {
    return execFileSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' }).trim();
  } catch {
    return ANDROID_STUDIO_JAVA;
  }
}

/** Java 17 and no telemetry, update check or analysis prompt (no data leaves the Mac). */
export function maestroEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    JAVA_HOME: process.env['JAVA_HOME'] ?? javaHome(),
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_DISABLE_UPDATE_CHECK: 'true',
  };
}

/** `maestro test <args>` with Java 17 and no telemetry; returns Maestro's exit code. */
export function runMaestro(args: readonly string[]): number {
  return spawnSync(MAESTRO, args, { stdio: 'inherit', env: maestroEnv() }).status ?? 1;
}

/** The -e values every flow reads: the app's bundle id and URL scheme. */
export function appEnv(app: AppInfo): string[] {
  return ['-e', `APP_ID=${app.id}`, '-e', `APP_SCHEME=${app.scheme}`];
}

/**
 * The shared setup sub-flow. A tool opens the debug link through it, never with `simctl openurl`:
 * iOS answers a custom scheme opened from outside with an "Open in <app>?" prompt that the sub-flow
 * accepts, and `simctl openurl` alone leaves it up, so the app never gets the link (seen on iOS 26.5).
 */
export const DEBUG_SETUP_FLOW = join('packages', 'shell', 'e2e', 'subflows', 'debug-setup.yaml');

export type DebugSetupRun = {
  readonly udid: string;
  readonly app: AppInfo;
  /** The debug link's query, for example 'lang=en&firstRun=0&screen=home'. */
  readonly query: string;
  /** The testID that proves the link's screen is shown. */
  readonly waitFor: string;
  readonly outDir: string;
};

/** `maestro test` arguments that apply one debug link to the running app and wait for waitFor. */
export function debugSetupArgs(run: DebugSetupRun): string[] {
  return [
    ...['test', DEBUG_SETUP_FLOW, '--udid', run.udid, '--test-output-dir', run.outDir],
    ...appEnv(run.app),
    ...['-e', `QUERY=${run.query}`, '-e', `WAIT_FOR=${run.waitFor}`],
  ];
}
