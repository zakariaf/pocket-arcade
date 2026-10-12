// packages/tooling/src/storekit/storekit-harness.ts
// device-only: covered by check-premium (harness-maestro) and the Tier 2 harness run itself
// Tier-2 Premium purchase tests on a throwaway simulator of your own. Test variant only.
// Usage: node packages/tooling/src/storekit/storekit-harness.ts --app <game-id> --device <udid>
//          [--driver-port <n>] [--metro-port <n>] (node:util parseArgs; any other option stops it)
// Prebuilds a harness project, builds it (Debug) against its own Metro port, starts Metro (its
// output in apps/<game>/build/logs/storekit-metro.log; stopped however the run ends), then
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
import { parseArgs } from 'node:util';

import { isGameId } from '@e07/tooling/build/game-id.ts';
import { findWorkspace, PREBUILD_ARGS, schemeOf } from '@e07/tooling/build/sim-build-plan.ts';
import { driverPortFor, maestroGlobalArgs, maestroRunLine } from '@e07/tooling/e2e/maestro-args.ts';
import { MAESTRO_BIN, maestroEnvOf } from '@e07/tooling/ios/maestro-tool.ts';
import { readUrlScheme } from '@e07/tooling/ios/sim-app.ts';
import { busyNote } from '@e07/tooling/storekit/busy-note.ts';
import { spawnMetro, withMetro } from '@e07/tooling/storekit/metro-session.ts';

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

// Fresh CNG project (test variant) + harness files + target. Never used for shipped builds.
function prepareHarness(appDir: string, udid: string, metroPort: number): Harness {
  run('npx', PREBUILD_ARGS, appDir);
  const ios = join(appDir, 'ios');
  const scheme = schemeOf(findWorkspace(readdirSync(ios)));
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
  return { appDir, udid, metroPort, scheme, bundleId, urlScheme: readUrlScheme(join(ios, scheme)) };
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
  const logFile = join(appDir, 'build', 'logs', 'storekit-metro.log');
  const stop = spawnMetro(spawn, { appDir, port, env, logFile });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await fetch(`http://localhost:${String(port)}/status`).then(
      async (response) => response.text(),
      () => '',
    );
    if (status === 'packager-status:running') return stop;
    await sleep(1000);
  }
  stop();
  throw new Error(`Metro did not start on port ${String(port)} (log: ${logFile})`);
}

// Before the run and after a failed one: is the Mac too busy for StoreKit's test store?
function busyNoteNow(): string | null {
  const [load = 0] = loadavg();
  return busyNote(load, availableParallelism());
}

// One Maestro run: the global --device and its own driver port (a free one for each flow, or the
// port a session passes with --driver-port), the pinned install and Maestro's environment (Java 17
// even when the shell sets no JAVA_HOME, no analytics or update check: maestro-tool.ts).
async function runFlow(h: Harness, givenPort: string | undefined, flow: string): Promise<boolean> {
  const target: MaestroTarget = { udid: h.udid, driverPort: await driverPortFor(givenPort) };
  const file = join(ROOT, 'packages', 'shell', 'e2e', 'storekit', flow);
  const vars = ['-e', `APP_ID=${h.bundleId}`, '-e', `APP_SCHEME=${h.urlScheme}`];
  const command = ['test', file, ...vars];
  console.error(maestroRunLine(target, command));
  const args = [...maestroGlobalArgs(target), ...command];
  const env = maestroEnvOf(process.env);
  return spawnSync(MAESTRO_BIN, args, { stdio: 'inherit', env }).status === 0;
}

const USAGE =
  'usage: storekit-harness.ts --app <game-id> --device <udid> [--driver-port <n>] [--metro-port <n>]';
const OPTIONS = {
  app: { type: 'string' },
  device: { type: 'string' },
  'driver-port': { type: 'string' },
  'metro-port': { type: 'string' },
} as const;

async function main(argv: readonly string[]): Promise<number> {
  const { values } = parseArgs({ args: [...argv], options: OPTIONS });
  const { app: game, device: udid } = values;
  if (!isGameId(game) || udid === undefined) throw new Error(USAGE);
  // Refuse a non-UDID or a bad --driver-port before anything is built; each flow then gets its own
  // driver port (runFlow).
  const givenPort = values['driver-port'];
  maestroGlobalArgs({ udid, driverPort: await driverPortFor(givenPort) });
  const metroPort = await driverPortFor(values['metro-port']); // any free port serves Metro too
  const busy = busyNoteNow();
  if (busy !== null) console.error(busy);
  const h = prepareHarness(join(ROOT, 'apps', game), udid, metroPort);
  xcodebuild(h, ['build-for-testing', '-sdk', 'iphonesimulator']);
  const failures = await withMetro(
    () => startMetro(h.appDir, metroPort),
    async () => {
      let failed = 0;
      for (const [test, flow] of SCENARIOS) {
        if (test !== null) arm(h, test);
        if (!(await runFlow(h, givenPort, flow))) failed += 1;
      }
      return failed;
    },
  );
  console.error(`storekit: ${String(failures)} of ${String(SCENARIOS.length)} scenario(s) failed`);
  const busyAtEnd = failures > 0 ? busyNoteNow() : null;
  if (busyAtEnd !== null) console.error(busyAtEnd);
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
