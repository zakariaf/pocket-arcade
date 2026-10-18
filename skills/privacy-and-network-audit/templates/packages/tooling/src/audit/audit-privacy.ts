// packages/tooling/src/audit/audit-privacy.ts
// `npm run audit:privacy [-- --app <game-id>]` after `npx expo prebuild --platform ios --clean`
// (prebuild runs pod install). Without --app: every app that has ios/Pods. Fails when app.config
// lacks a reason a pod declares, when a pod other than Google's declares tracking, when the app's
// own manifest declares tracking or tracking domains, or when no app is prebuilt. It reads the
// manifests of the trunk pods (ios/Pods) and of the development pods (built from node_modules or
// the workspace and bundled from their own folder): exactly what CocoaPods puts into the app.
// Also prints the App Privacy questionnaire input, with the tracking answers: Device ID is
// collected, linked and used for tracking by the third-party ads SDK, and the app asks App
// Tracking Transparency first (owner decision O1).
// `npm run audit:privacy -- --platform android [--app <game-id>]` prints Google Play's Data safety
// answers instead (spec 4.2 point 1), for every app or the one named; it needs no prebuild.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { dataSafetyAnswers } from './data-safety.ts';
import { isAdsEnabled } from './network-config-layer.ts';
import {
  localPodManifestPaths,
  mergeReasons,
  privacyProblems,
  readManifest,
  trackingAnswers,
} from './privacy-manifest.ts';

import type { ExpoConfigLike } from './network-config-layer.ts';
import type { PodManifest, PrivacyManifest } from './privacy-manifest.ts';

/**
 * Each pod manifest is read (one plutil run) once; the checks below share the parsed copies.
 * Trunk pods' manifests sit in ios/Pods/<pod>/; development pods' (EXTERNAL SOURCES with a local
 * :path or :podspec) stay in their own folder, where their Local Podspecs entry names them.
 */
function podManifests(appDir: string): { pods: PodManifest[]; unreadable: string[] } {
  const ios = join(appDir, 'ios');
  const pods = join(ios, 'Pods');
  const trunk = readdirSync(pods, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('PrivacyInfo.xcprivacy'))
    .map((file) => ({ pod: file.split('/')[0] ?? file, path: join(pods, file) }));
  const local = localPodManifestPaths(ios);
  const unreadable = local
    .filter(({ path }) => !existsSync(path))
    .map(({ pod, path }) => `pod ${pod} bundles ${path}, which the audit cannot read`);
  const found = [...trunk, ...local.filter(({ path }) => existsSync(path))];
  return {
    pods: found.map((entry) => ({ ...entry, manifest: readManifest(entry.path) })),
    unreadable,
  };
}

function appManifest(appDir: string): PrivacyManifest {
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
    cwd: appDir,
    encoding: 'utf8',
  });
  const config = JSON.parse(json) as { ios?: { privacyManifests?: PrivacyManifest } };
  return config.ios?.privacyManifests ?? {};
}

type Collected = Parameters<typeof trackingAnswers>[0][number];

function collectedItems(pods: readonly PodManifest[]): Collected[] {
  return pods.flatMap(({ pod, manifest }) =>
    (manifest.NSPrivacyCollectedDataTypes ?? []).map((item) => ({ pod, item })),
  );
}

// Input for the App Store Connect "App Privacy" questionnaire (a human step).
function collectedData(items: readonly Collected[]): string[] {
  return items.map(({ pod, item }) => {
    const flags = `linked=${String(item.NSPrivacyCollectedDataTypeLinked)} tracking=${String(item.NSPrivacyCollectedDataTypeTracking)}`;
    return `${pod}: ${item.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '')} ${flags}`;
  });
}

function auditApp(appDir: string): number {
  const { pods, unreadable } = podManifests(appDir);
  const required = mergeReasons(pods.map(({ manifest }) => manifest));
  const problems = [...privacyProblems(pods, appManifest(appDir)), ...unreadable];
  for (const [category, reasons] of required)
    console.error(`${category}: ${[...reasons].join(', ')}`);
  const items = collectedItems(pods);
  for (const line of new Set(collectedData(items))) console.error(`collected ${line}`);
  for (const line of new Set(trackingAnswers(items))) console.error(line);
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(
    `${appDir}: ${String(pods.length)} pod manifests, ${String(problems.length)} problem(s)`,
  );
  return problems.length;
}

function prebuiltGameIds(): string[] {
  if (!existsSync('apps')) return [];
  return readdirSync('apps').filter((id) => existsSync(join('apps', id, 'ios', 'Pods')));
}

const execFileAsync = promisify(execFile);

// The store build's config, as the network audit reads it (ads on unless the game turns them off).
async function storeConfig(gameId: string): Promise<ExpoConfigLike> {
  const { stdout } = await execFileAsync(
    'npx',
    ['expo', 'config', '--json', '--type', 'prebuild'],
    {
      cwd: join('apps', gameId),
      env: {
        ...process.env,
        APP_VARIANT: 'store',
        EXPO_PUBLIC_APP_VARIANT: 'store',
        ADS_MODE: 'off',
      },
      encoding: 'utf8',
    },
  );
  return JSON.parse(stdout) as ExpoConfigLike;
}

/** Every game's config is read at once (independent npx runs); the answers print in game order. */
async function printDataSafety(gameIds: readonly string[]): Promise<void> {
  const configs = await Promise.all(gameIds.map(storeConfig));
  gameIds.forEach((gameId, index) => {
    const config = configs[index];
    if (config === undefined) return;
    const answers = dataSafetyAnswers({ gameId, isAdsEnabled: isAdsEnabled(config) });
    for (const line of answers) console.error(line);
  });
}

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const appId = argument('--app');
if (argument('--platform') === 'android') {
  const allApps = existsSync('apps') ? readdirSync('apps').filter((id) => !id.startsWith('.')) : [];
  const gameIds = appId === undefined ? allApps : [appId];
  await printDataSafety(gameIds);
  process.exitCode = gameIds.length > 0 ? 0 : 1;
} else {
  const gameIds = appId === undefined ? prebuiltGameIds() : [appId];
  if (gameIds.length === 0) console.error('audit:privacy: no prebuilt app (run npx expo prebuild)');
  const failures = gameIds.reduce((sum, id) => sum + auditApp(join('apps', id)), 0);
  process.exitCode = gameIds.length > 0 && failures === 0 ? 0 : 1;
}
