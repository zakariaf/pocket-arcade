// packages/tooling/src/audit/audit-privacy.ts
// `npm run audit:privacy [-- --app <game-id>]` after `npx expo prebuild --platform ios --clean`
// (prebuild runs pod install). Without --app: every app that has ios/Pods. Fails when app.config
// lacks a reason a pod declares, when a pod other than Google's declares tracking, or when no
// app is prebuilt. Also prints the App Privacy questionnaire input.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { mergeReasons, missingReasons, readManifest } from './privacy-manifest.ts';

import type { PrivacyManifest } from './privacy-manifest.ts';

// Pods allowed to declare tracking or collected data (the AdMob SDKs, spec N3).
const TRACKING_ALLOWED = /\/(Google-Mobile-Ads-SDK|GoogleUserMessagingPlatform)\//;

function podManifests(appDir: string): string[] {
  const pods = join(appDir, 'ios', 'Pods');
  return readdirSync(pods, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('PrivacyInfo.xcprivacy'))
    .map((file) => join(pods, file));
}

function appManifest(appDir: string): PrivacyManifest {
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
    cwd: appDir,
    encoding: 'utf8',
  });
  const config = JSON.parse(json) as { ios?: { privacyManifests?: PrivacyManifest } };
  return config.ios?.privacyManifests ?? {};
}

function trackingViolations(paths: readonly string[]): string[] {
  return paths
    .filter((path) => !TRACKING_ALLOWED.test(path))
    .filter((path) => {
      const manifest = readManifest(path);
      const domains = manifest.NSPrivacyTrackingDomains ?? [];
      return manifest.NSPrivacyTracking === true || domains.length > 0;
    });
}

// Input for the App Store Connect "App Privacy" questionnaire (a human step).
function collectedData(paths: readonly string[]): string[] {
  return paths.flatMap((path) =>
    (readManifest(path).NSPrivacyCollectedDataTypes ?? []).map((item) => {
      const pod = path.split('/Pods/')[1]?.split('/')[0] ?? path;
      const flags = `linked=${String(item.NSPrivacyCollectedDataTypeLinked)} tracking=${String(item.NSPrivacyCollectedDataTypeTracking)}`;
      return `${pod}: ${item.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '')} ${flags}`;
    }),
  );
}

function auditApp(appDir: string): number {
  const paths = podManifests(appDir);
  const required = mergeReasons(paths.map(readManifest));
  const declared = mergeReasons([appManifest(appDir)]);
  const problems = [
    ...missingReasons(required, declared).map((gap) => `app.config lacks ${gap}`),
    ...trackingViolations(paths).map((path) => `tracking declared outside the AdMob pods: ${path}`),
  ];
  for (const [category, reasons] of required)
    console.error(`${category}: ${[...reasons].join(', ')}`);
  for (const line of new Set(collectedData(paths))) console.error(`collected ${line}`);
  for (const problem of problems) console.error(`FAIL ${problem}`);
  console.error(
    `${appDir}: ${String(paths.length)} pod manifests, ${String(problems.length)} problem(s)`,
  );
  return problems.length;
}

function prebuiltGameIds(): string[] {
  if (!existsSync('apps')) return [];
  return readdirSync('apps').filter((id) => existsSync(join('apps', id, 'ios', 'Pods')));
}

const appIndex = process.argv.indexOf('--app');
const gameIds = appIndex >= 0 ? [process.argv[appIndex + 1] ?? ''] : prebuiltGameIds();
if (gameIds.length === 0) console.error('audit:privacy: no prebuilt app (run npx expo prebuild)');
const failures = gameIds.reduce((sum, id) => sum + auditApp(join('apps', id)), 0);
process.exitCode = gameIds.length > 0 && failures === 0 ? 0 : 1;
