// packages/tooling/src/storekit/storekit-harness.ts
// Tier-2 Premium purchase tests on a throwaway simulator of your own. Test variant only.
// Usage: node packages/tooling/src/storekit/storekit-harness.ts --app <game-id> --device <udid>
//          [--driver-port <n>] [--metro-port <n>]
// Prebuilds a harness project, builds it (Debug) against its own Metro port, starts Metro, then
// per scenario arms the simulator's StoreKit test store and runs one flow from
// packages/shell/e2e/storekit/. Every Maestro call names the simulator and its own XCTest driver
// port (maestro-args.ts: a free port for each flow unless --driver-port is given), so no call can
// reach another session's simulator. Release-day
// order: the E2E evidence run, then this harness, then `xcrun simctl delete <udid>`, then
// `npx expo prebuild --clean` before any Release or store build (they share apps/<id>/ios).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, loadavg } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { driverPortFor, maestroGlobalArgs, maestroRunLine } from '@e07/tooling/e2e/maestro-args.ts';
import { busyNote } from '@e07/tooling/storekit/busy-note.ts';

import type { MaestroTarget } from '@e07/tooling/e2e/maestro-args.ts';

const HERE = import.meta.dirname;
const ROOT = process.cwd();
const TEST_ENV = {
  ...process.env,
  APP_VARIANT: 'test',
  EXPO_PUBLIC_APP_VARIANT: 'test',
  ADS_MODE: 'off',
};
// [arm test or null, flow]. Order matters: refund needs the purchase, approval the pending one.
const SCENARIOS: readonly (readonly [string | null, string])[] = [
  ['testArmDefault', '01-buy.yaml'],
  ['testRefundAll', '02-refund-relaunch.yaml'],
  ['testArmAskToBuy', '03-ask-to-buy.yaml'],
  ['testApproveAll', '04-approval-relaunch.yaml'],
  ['testArmDefault', '05-restore.yaml'],
  ['testArmFail', '06-failure.yaml'],
  [null, '07-store-unavailable.yaml'],
];

type Harness = {
  readonly appDir: string;
  readonly udid: string;
  /** This run's Metro port, built into the Debug app (RCT_METRO_PORT) and passed to expo start. */
  readonly metroPort: number;
  readonly scheme: string; // Xcode scheme = app target name
  readonly bundleId: string;
  readonly urlScheme: string; // for the debug deep link
};

function run(command: string, args: readonly string[], cwd: string): void {
  execFileSync(command, args, { cwd, env: TEST_ENV, stdio: 'inherit' });
}

function bundleIdOf(appDir: string): string {
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
    cwd: appDir,
    env: TEST_ENV,
    encoding: 'utf8',
  });
  const id = (JSON.parse(json) as { ios?: { bundleIdentifier?: string } }).ios?.bundleIdentifier;
  if (id === undefined) throw new Error('no ios.bundleIdentifier');
  return id;
}

function urlSchemeOf(ios: string, scheme: string): string {
  const key = 'CFBundleURLTypes.0.CFBundleURLSchemes.0';
  const plist = join(ios, scheme, 'Info.plist');
  return execFileSync('plutil', ['-extract', key, 'raw', plist], { encoding: 'utf8' }).trim();
}

// Fresh CNG project (test variant) + harness files + target. Never used for shipped builds.
function prepareHarness(appDir: string, udid: string, metroPort: number): Harness {
  run('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean'], appDir);
  const ios = join(appDir, 'ios');
  const scheme = readdirSync(ios)
    .find((f) => f.endsWith('.xcworkspace'))
    ?.replace('.xcworkspace', '');
  if (scheme === undefined) throw new Error('no .xcworkspace after prebuild');
  const bundleId = bundleIdOf(appDir);
  const template = readFileSync(join(HERE, 'Premium.storekit.template'), 'utf8');
  writeFileSync(
    join(ios, 'Premium.storekit'),
    template.replace('__PRODUCT_ID__', `${bundleId}.premium`),
  );
  mkdirSync(join(ios, 'StoreKitHarness'), { recursive: true });
  copyFileSync(join(HERE, 'ArmTests.swift'), join(ios, 'StoreKitHarness', 'ArmTests.swift'));
  copyFileSync(
    join(HERE, 'storekit-harness.entitlements'),
    join(ios, scheme, 'storekit-harness.entitlements'),
  );
  run('ruby', [join(HERE, 'add-harness.rb'), ios, scheme, bundleId], appDir);
  return { appDir, udid, metroPort, scheme, bundleId, urlScheme: urlSchemeOf(ios, scheme) };
}

function xcodebuild(h: Harness, action: readonly string[]): void {
  const common = ['-workspace', `${h.scheme}.xcworkspace`, '-scheme', h.scheme];
  const target = ['-configuration', 'Debug', '-destination', `id=${h.udid}`];
  const derived = ['-derivedDataPath', '../build/storekit'];
  // A Debug app loads its JS from Metro on RCT_METRO_PORT (8081 unless set): this run's own port.
  execFileSync('xcodebuild', [...action, ...common, ...target, ...derived], {
    cwd: join(h.appDir, 'ios'),
    env: { ...TEST_ENV, RCT_METRO_PORT: String(h.metroPort) },
    stdio: 'inherit',
  });
}

// testArmDefault | testArmAskToBuy | testArmFail | testApproveAll | testRefundAll
function arm(h: Harness, test: string): void {
  xcodebuild(h, ['test-without-building', `-only-testing:StoreKitHarness/ArmTests/${test}`]);
}

// Debug builds load JS from Metro (localhost only; tooling may use fetch).
async function startMetro(appDir: string, port: number): Promise<() => void> {
  const env = { ...TEST_ENV, CI: '1', EXPO_NO_TELEMETRY: '1' };
  const metro = spawn('npx', ['expo', 'start', '--port', String(port)], { cwd: appDir, env });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await fetch(`http://localhost:${String(port)}/status`).then(
      async (response) => response.text(),
      () => '',
    );
    if (status === 'packager-status:running') return () => metro.kill();
    await sleep(1000);
  }
  metro.kill();
  throw new Error(`Metro did not start on port ${String(port)}`);
}

// Before the run and after a failed one: is the Mac too busy for StoreKit's test store?
function busyNoteNow(): string | null {
  const [load = 0] = loadavg();
  return busyNote(load, availableParallelism());
}

// One Maestro run: the global --device and its own driver port (a free one for each flow, or the
// port a session passes with --driver-port).
async function runFlow(h: Harness, givenPort: string | undefined, flow: string): Promise<boolean> {
  const target: MaestroTarget = { udid: h.udid, driverPort: await driverPortFor(givenPort) };
  const maestro = join(ROOT, 'tools', 'maestro', 'bin', 'maestro'); // the pinned Maestro install
  const file = join(ROOT, 'packages', 'shell', 'e2e', 'storekit', flow);
  const vars = ['-e', `APP_ID=${h.bundleId}`, '-e', `APP_SCHEME=${h.urlScheme}`];
  const env = {
    ...process.env, // JAVA_HOME must point at Java 17 (Maestro 2.10)
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_DISABLE_UPDATE_CHECK: 'true',
  };
  const command = ['test', file, ...vars];
  console.error(maestroRunLine(target, command));
  const args = [...maestroGlobalArgs(target), ...command];
  return spawnSync(maestro, args, { stdio: 'inherit', env }).status === 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const valueOf = (flag: string): string | undefined =>
    argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;
  const game = valueOf('--app');
  const udid = valueOf('--device');
  if (game === undefined || udid === undefined) {
    throw new Error('usage: storekit-harness.ts --app <game-id> --device <udid>');
  }
  // Refuse a non-UDID or a bad --driver-port before anything is built; each flow then gets its own
  // driver port (runFlow).
  const givenPort = valueOf('--driver-port');
  maestroGlobalArgs({ udid, driverPort: await driverPortFor(givenPort) });
  const metroPort = await driverPortFor(valueOf('--metro-port')); // any free port serves Metro too
  const busy = busyNoteNow();
  if (busy !== null) console.error(busy);
  const h = prepareHarness(join(ROOT, 'apps', game), udid, metroPort);
  xcodebuild(h, ['build-for-testing', '-sdk', 'iphonesimulator']);
  const stopMetro = await startMetro(h.appDir, metroPort);
  let failures = 0;
  for (const [test, flow] of SCENARIOS) {
    if (test !== null) arm(h, test);
    if (!(await runFlow(h, givenPort, flow))) failures += 1;
  }
  stopMetro();
  console.error(`storekit: ${String(failures)} of ${String(SCENARIOS.length)} scenario(s) failed`);
  const busyAtEnd = failures > 0 ? busyNoteNow() : null;
  if (busyAtEnd !== null) console.error(busyAtEnd);
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
