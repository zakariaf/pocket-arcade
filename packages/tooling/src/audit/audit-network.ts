// packages/tooling/src/audit/audit-network.ts
// `npm run audit:network`: spec N3 layers B-E for every app (layer A is ESLint, layer F runs in
// E2E) plus the banned-package check. Exports each app as a STORE bundle into
// dist-audit/<game-id>/ (also read by audit:licenses). Pod and config layers need
// `npx expo prebuild` first; otherwise skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findBannedPackages, inventoryFromLockfile } from '@e07/tooling/deps/banned-packages.ts';

import { readBundleModules } from './bundle-modules.ts';
import { compareToBaseline } from './network-baseline.ts';
import { configProblems } from './network-config-layer.ts';
import { jsNetworkFindings } from './network-js-layer.ts';
import { nativeModuleRoots, nativeNetworkFindings } from './network-native-layer.ts';
import { podProblems } from './network-pods-layer.ts';
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

function nativeAndPodProblems(appDir: string): string[] {
  const native = compareToBaseline(
    nativeNetworkFindings(nativeModuleRoots(appDir)),
    readBaseline('native-baseline.json'),
  );
  const lock = join(appDir, 'ios', 'Podfile.lock');
  if (!existsSync(lock))
    return [...native, 'SKIPPED pods/config layers: run npx expo prebuild first'];
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'prebuild'], {
    cwd: appDir,
    env: STORE_ENV,
    encoding: 'utf8',
  });
  return [
    ...native,
    ...podProblems(readFileSync(lock, 'utf8')),
    ...configProblems(JSON.parse(json) as ExpoConfigLike),
  ];
}

function auditApp(gameId: string): string[] {
  const appDir = join(ROOT, 'apps', gameId);
  const outDir = join(ROOT, 'dist-audit', gameId);
  exportBundle(appDir, outDir);
  return [...jsProblems(outDir), ...nativeAndPodProblems(appDir)].map((p) => `${gameId}: ${p}`);
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
