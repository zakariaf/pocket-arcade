// packages/tooling/src/audit/privacy-manifest.ts
import { execFileSync } from 'node:child_process';

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
