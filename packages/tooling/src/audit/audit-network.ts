// packages/tooling/src/audit/audit-network.ts
// `npm run audit:network`: spec N3 layers B-E for every app (layer A is ESLint, layer F runs in
// E2E) plus the banned-package check. Exports each app as a STORE bundle into
// dist-audit/<game-id>/ (also read by audit:licenses). The config layer runs on every call; the
// pods layer needs `npx expo prebuild` first (ios/Podfile.lock), otherwise a SKIPPED line.
// Android: once apps/<game>/android/ exists, the Gradle layer reads the release runtime classpath
// (`./gradlew :app:dependencies`), and after a Release build the merged manifest is checked
// (permissions on the allowlist, no cleartext); without them, SKIPPED lines.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findBannedPackages, inventoryFromLockfile } from '@e07/tooling/deps/banned-packages.ts';

import { manifestProblems } from './android-manifest-audit.ts';
import { readBundleModules } from './bundle-modules.ts';
import { podAndConfigProblems } from './network-app-layers.ts';
import { compareToBaseline } from './network-baseline.ts';
import { gradleProblems } from './network-gradle-layer.ts';
import { jsNetworkFindings } from './network-js-layer.ts';
import { nativeModuleRoots, nativeNetworkFindings } from './network-native-layer.ts';
import { storeBundleProblems } from './release-bundle-checks.ts';

import type { Baseline } from './network-baseline.ts';
import type { ExpoConfigLike } from './network-config-layer.ts';
import type { Lockfile } from '@e07/tooling/deps/banned-packages.ts';

const ROOT = process.cwd();
const BASELINES = join(ROOT, 'packages', 'tooling', 'network-audit');
// Store bundle without live IDs: ADS_MODE=off is a valid store pair and ships the same JS.
const STORE_ENV = {
  ...process.env,
  APP_VARIANT: 'store',
  EXPO_PUBLIC_APP_VARIANT: 'store',
  ADS_MODE: 'off',
};

// Gradle runs on JDK 17: JAVA_HOME, or Android Studio's JBR (android-emulator-build's choice).
const STUDIO_JBR = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const GRADLE_ENV = {
  ...STORE_ENV,
  JAVA_HOME: process.env['JAVA_HOME'] ?? STUDIO_JBR,
  EXPO_NO_TELEMETRY: '1',
  CI: '1',
};

function readBaseline(name: string): Baseline {
  return JSON.parse(readFileSync(join(BASELINES, name), 'utf8')) as Baseline;
}

function exportBundle(appDir: string, outDir: string): void {
  const args = ['expo', 'export', '--platform', 'ios', '--no-bytecode', '--source-maps', 'true'];
  execFileSync('npx', [...args, '--output-dir', outDir], {
    cwd: appDir,
    env: STORE_ENV,
    stdio: 'ignore',
  });
}

function jsProblems(outDir: string): string[] {
  const modules = readBundleModules(outDir);
  const { findings, firstParty } = jsNetworkFindings(modules);
  return [
    ...firstParty.map((hit) => `first-party network code: ${hit}`),
    ...compareToBaseline(findings, readBaseline('js-baseline.json')),
    ...storeBundleProblems(modules),
  ];
}

/** Layer C, then D and E: the config layer runs on every call; only the pods need a prebuild. */
function nativeAndPodProblems(appDir: string): string[] {
  const native = compareToBaseline(
    nativeNetworkFindings(nativeModuleRoots(appDir)),
    readBaseline('native-baseline.json'),
  );
  const lock = join(appDir, 'ios', 'Podfile.lock');
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'prebuild'], {
    cwd: appDir,
    env: STORE_ENV,
    encoding: 'utf8',
  });
  const podfileLock = existsSync(lock) ? readFileSync(lock, 'utf8') : null;
  const config = JSON.parse(json) as ExpoConfigLike;
  return [...native, ...podAndConfigProblems({ podfileLock, config })];
}

/** The merged release manifest under app/build/intermediates, or null before a Release build. */
function mergedReleaseManifest(androidDir: string): string | null {
  const intermediates = join(androidDir, 'app', 'build', 'intermediates');
  if (!existsSync(intermediates)) return null;
  const found = readdirSync(intermediates, { recursive: true, encoding: 'utf8' }).find((file) =>
    /^merged_manifests?\/release\/.*AndroidManifest\.xml$/.test(file),
  );
  return found === undefined ? null : join(intermediates, found);
}

function gradleDump(androidDir: string): string {
  const args = [':app:dependencies', '--configuration', 'releaseRuntimeClasspath', '-q'];
  return execFileSync(join(androidDir, 'gradlew'), args, {
    cwd: androidDir,
    env: GRADLE_ENV,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Layer D on Android (Gradle artifacts) and the merged manifest, after prebuild and build. */
function androidProblems(appDir: string): string[] {
  const androidDir = join(appDir, 'android');
  if (!existsSync(androidDir)) {
    return ['SKIPPED gradle layer: run npx expo prebuild --platform android first'];
  }
  let gradle: string[];
  try {
    gradle = gradleProblems(gradleDump(androidDir), readBaseline('gradle-baseline.json'));
  } catch (error) {
    gradle = [`gradle layer could not run: ${String(error).split('\n')[0] ?? ''}`];
  }
  const manifest = mergedReleaseManifest(androidDir);
  const manifestLines =
    manifest === null
      ? ['SKIPPED manifest layer: no merged release manifest (run npm run build:android:emu first)']
      : manifestProblems(readFileSync(manifest, 'utf8')).map((problem) => `manifest: ${problem}`);
  return [...gradle, ...manifestLines];
}

function auditApp(gameId: string): string[] {
  const appDir = join(ROOT, 'apps', gameId);
  const outDir = join(ROOT, 'dist-audit', gameId);
  exportBundle(appDir, outDir);
  return [...jsProblems(outDir), ...nativeAndPodProblems(appDir), ...androidProblems(appDir)].map(
    (p) => `${gameId}: ${p}`,
  );
}

// Banned packages anywhere in the lockfile (HTTP clients: direct only).
function bannedPackageProblems(): string[] {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as Lockfile;
  return findBannedPackages(inventoryFromLockfile(lock)).map(
    (hit) => `banned package ${hit.name}: ${hit.reason}`,
  );
}

const gameIds = readdirSync(join(ROOT, 'apps')).filter((name) => !name.startsWith('.'));
const problems = [...bannedPackageProblems(), ...gameIds.flatMap(auditApp)];
for (const line of problems) console.error(line);
const failures = problems.filter((line) => !line.includes('SKIPPED') && !line.includes('STALE'));
console.error(`audit:network: ${String(failures.length)} failure(s)`);
process.exitCode = failures.length === 0 ? 0 : 1;
