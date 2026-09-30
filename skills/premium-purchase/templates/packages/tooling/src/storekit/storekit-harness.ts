// packages/tooling/src/storekit/storekit-harness.ts
// Tier-2 Premium purchase tests on a throwaway simulator. Test variant only.
// Usage: node packages/tooling/src/storekit/storekit-harness.ts --app <game-id> --udid <udid>
// Prebuilds a harness project, builds it (Debug), starts Metro, then per scenario arms the
// simulator's StoreKit test store and runs one flow from packages/shell/e2e/storekit/.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

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
function prepareHarness(appDir: string, udid: string): Harness {
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
  return { appDir, udid, scheme, bundleId, urlScheme: urlSchemeOf(ios, scheme) };
}

function xcodebuild(h: Harness, action: readonly string[]): void {
  const common = ['-workspace', `${h.scheme}.xcworkspace`, '-scheme', h.scheme];
  const target = ['-configuration', 'Debug', '-destination', `id=${h.udid}`];
  const derived = ['-derivedDataPath', '../build/storekit'];
  run('xcodebuild', [...action, ...common, ...target, ...derived], join(h.appDir, 'ios'));
}

// testArmDefault | testArmAskToBuy | testArmFail | testApproveAll | testRefundAll
function arm(h: Harness, test: string): void {
  xcodebuild(h, ['test-without-building', `-only-testing:StoreKitHarness/ArmTests/${test}`]);
}

// Debug builds load JS from Metro (localhost only; tooling may use fetch).
async function startMetro(appDir: string): Promise<() => void> {
  const env = { ...TEST_ENV, CI: '1', EXPO_NO_TELEMETRY: '1' };
  const metro = spawn('npx', ['expo', 'start', '--port', '8081'], { cwd: appDir, env });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await fetch('http://localhost:8081/status').then(
      async (response) => response.text(),
      () => '',
    );
    if (status === 'packager-status:running') return () => metro.kill();
    await sleep(1000);
  }
  metro.kill();
  throw new Error('Metro did not start on port 8081');
}

function runFlow(h: Harness, flow: string): boolean {
  const maestro = join(ROOT, 'tools', 'maestro', 'bin', 'maestro'); // the pinned Maestro install
  const file = join(ROOT, 'packages', 'shell', 'e2e', 'storekit', flow);
  const vars = ['-e', `APP_ID=${h.bundleId}`, '-e', `APP_SCHEME=${h.urlScheme}`];
  const env = {
    ...process.env, // JAVA_HOME must point at Java 17 (Maestro 2.10)
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_DISABLE_UPDATE_CHECK: 'true',
  };
  return (
    spawnSync(maestro, ['test', file, '--udid', h.udid, ...vars], { stdio: 'inherit', env })
      .status === 0
  );
}

async function main(argv: readonly string[]): Promise<number> {
  const valueOf = (flag: string): string | undefined => argv[argv.indexOf(flag) + 1];
  const game = argv.includes('--app') ? valueOf('--app') : undefined;
  const udid = argv.includes('--udid') ? valueOf('--udid') : undefined;
  if (game === undefined || udid === undefined) {
    throw new Error('usage: storekit-harness.ts --app <game-id> --udid <udid>');
  }
  const h = prepareHarness(join(ROOT, 'apps', game), udid);
  xcodebuild(h, ['build-for-testing', '-sdk', 'iphonesimulator']);
  const stopMetro = await startMetro(h.appDir);
  let failures = 0;
  for (const [test, flow] of SCENARIOS) {
    if (test !== null) arm(h, test);
    if (!runFlow(h, flow)) failures += 1;
  }
  stopMetro();
  console.error(`storekit: ${String(failures)} of ${String(SCENARIOS.length)} scenario(s) failed`);
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
