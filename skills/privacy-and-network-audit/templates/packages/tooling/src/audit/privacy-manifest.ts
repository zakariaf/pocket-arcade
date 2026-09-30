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
