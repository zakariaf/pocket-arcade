// packages/tooling/src/audit/privacy-manifest.ts
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { externalSources } from './network-pods-layer.ts';

export type ApiDeclaration = {
  readonly NSPrivacyAccessedAPIType: string;
  readonly NSPrivacyAccessedAPITypeReasons: readonly string[];
};
export type CollectedDataType = {
  readonly NSPrivacyCollectedDataType: string;
  readonly NSPrivacyCollectedDataTypeLinked: boolean;
  readonly NSPrivacyCollectedDataTypeTracking: boolean;
};
export type PrivacyManifest = {
  readonly NSPrivacyTracking?: boolean;
  readonly NSPrivacyTrackingDomains?: readonly string[];
  readonly NSPrivacyAccessedAPITypes?: readonly ApiDeclaration[];
  readonly NSPrivacyCollectedDataTypes?: readonly CollectedDataType[];
};

// plutil ships with macOS; it reads both XML and binary plists.
export function readManifest(path: string): PrivacyManifest {
  const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8' });
  return JSON.parse(json) as PrivacyManifest;
}

// category -> set of reason codes, merged over many manifests.
export function mergeReasons(manifests: readonly PrivacyManifest[]): Map<string, Set<string>> {
  const merged = new Map<string, Set<string>>();
  for (const manifest of manifests) {
    for (const api of manifest.NSPrivacyAccessedAPITypes ?? []) {
      const reasons = merged.get(api.NSPrivacyAccessedAPIType) ?? new Set<string>();
      api.NSPrivacyAccessedAPITypeReasons.forEach((reason) => reasons.add(reason));
      merged.set(api.NSPrivacyAccessedAPIType, reasons);
    }
  }
  return merged;
}

// Every (category, reason) a pod declares must also be declared by the app.
export function missingReasons(
  required: Map<string, Set<string>>,
  declared: Map<string, Set<string>>,
): string[] {
  const missing: string[] = [];
  for (const [category, reasons] of required) {
    for (const reason of reasons) {
      if (declared.get(category)?.has(reason) !== true) missing.push(`${category} ${reason}`);
    }
  }
  return missing;
}

/**
 * The app's own manifest: our code tracks nothing, so NSPrivacyTracking is false and it lists no
 * NSPrivacyTrackingDomains. Apple fails requests to listed domains for players who decline App
 * Tracking Transparency, so listing Google's domains here would stop ads for them; only Google's
 * pods declare tracking (their own manifests), and the app asks ATT before any ad request (O1).
 */
export function appTrackingProblems(manifest: PrivacyManifest): string[] {
  const problems: string[] = [];
  if (manifest.NSPrivacyTracking !== false)
    problems.push('the app manifest must set NSPrivacyTracking: false');
  if ((manifest.NSPrivacyTrackingDomains ?? []).length > 0) {
    problems.push('the app manifest must list no NSPrivacyTrackingDomains');
  }
  return problems;
}

/**
 * The App Privacy answers for data a pod collects for tracking (Device ID by Google Mobile Ads):
 * "collected, linked to the user, used for tracking, by the third-party ads SDK".
 */
export function trackingAnswers(
  collected: readonly { readonly pod: string; readonly item: CollectedDataType }[],
): string[] {
  return collected
    .filter(({ item }) => item.NSPrivacyCollectedDataTypeTracking)
    .map(({ pod, item }) => {
      const type = item.NSPrivacyCollectedDataType.replace('NSPrivacyCollectedDataType', '');
      const linked = item.NSPrivacyCollectedDataTypeLinked ? 'linked to the user' : 'not linked';
      return `App Privacy: ${type} collected, ${linked}, used for tracking by the third-party ads SDK ${pod} (the app asks App Tracking Transparency first)`;
    });
}

/** One pod's manifest: trunk pods' under ios/Pods/<pod>/, development pods' at their own root. */
export type PodManifest = {
  readonly pod: string;
  readonly path: string;
  readonly manifest: PrivacyManifest;
};

// Pods allowed to declare tracking or collected data (the AdMob SDKs, spec N3).
const TRACKING_PODS: ReadonlySet<string> = new Set([
  'Google-Mobile-Ads-SDK',
  'GoogleUserMessagingPlatform',
]);

/**
 * Every problem of the merged pod manifests against the app's own: a (category, reason) a pod
 * declares that app.config lacks, tracking declared outside Google's pods, and the app's tracking.
 */
export function privacyProblems(pods: readonly PodManifest[], app: PrivacyManifest): string[] {
  const required = mergeReasons(pods.map(({ manifest }) => manifest));
  const tracking = pods.filter(({ pod, manifest }) => {
    const domains = manifest.NSPrivacyTrackingDomains ?? [];
    return !TRACKING_PODS.has(pod) && (manifest.NSPrivacyTracking === true || domains.length > 0);
  });
  return [
    ...missingReasons(required, mergeReasons([app])).map((gap) => `app.config lacks ${gap}`),
    ...tracking.map(
      ({ pod, path }) => `tracking declared outside the AdMob pods: ${pod} (${path})`,
    ),
    ...appTrackingProblems(app),
  ];
}

type PodspecJson = {
  readonly resource_bundles?: Readonly<Record<string, string | readonly string[]>>;
  readonly resources?: string | readonly string[];
  readonly ios?: unknown;
  readonly subspecs?: readonly unknown[];
};

/**
 * The privacy manifests a podspec (Pods/Local Podspecs/<pod>.podspec.json) bundles, relative to
 * the pod's root: its resource_bundles and resources that end in .xcprivacy, at the top level, for
 * iOS and in every subspec. This is what CocoaPods copies into the app.
 */
export function podspecPrivacyFiles(podspec: unknown): string[] {
  if (typeof podspec !== 'object' || podspec === null) return [];
  const spec = podspec as PodspecJson;
  const own = [...Object.values(spec.resource_bundles ?? {}), spec.resources ?? []]
    .flat()
    .filter((path) => path.endsWith('.xcprivacy'));
  return [...own, ...[spec.ios, ...(spec.subspecs ?? [])].flatMap(podspecPrivacyFiles)];
}

/** A development pod's root, relative to ios/: its :path, or the folder of a local :podspec. */
function localPodRoot(source: Readonly<Record<string, string>>): string | null {
  const { path, podspec } = source;
  if (path !== undefined) return path;
  return podspec === undefined || /^[a-z]+:\/\//.test(podspec) ? null : dirname(podspec);
}

/**
 * The privacy manifests of the development pods (Podfile.lock's EXTERNAL SOURCES built from a
 * local :path or :podspec): CocoaPods never copies them into ios/Pods, it bundles them from the
 * pod's own folder, as its Local Podspecs entry names them. Remote sources land in ios/Pods.
 */
export function localPodManifestPaths(iosDir: string): { pod: string; path: string }[] {
  const lock = readFileSync(join(iosDir, 'Podfile.lock'), 'utf8');
  return [...externalSources(lock)].flatMap(([pod, source]) => {
    const root = localPodRoot(source);
    const spec = join(iosDir, 'Pods', 'Local Podspecs', `${pod}.podspec.json`);
    if (root === null || !existsSync(spec)) return [];
    const files = podspecPrivacyFiles(JSON.parse(readFileSync(spec, 'utf8')) as unknown);
    return files.map((file) => ({ pod, path: join(iosDir, root, file) }));
  });
}
