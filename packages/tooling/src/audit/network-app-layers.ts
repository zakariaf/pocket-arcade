// packages/tooling/src/audit/network-app-layers.ts
// Layers D (pods) and E (config) of one app. The config layer reads `expo config`, which needs no
// prebuild, so it runs on every audit; only the pods layer needs ios/Podfile.lock and is skipped
// (a SKIPPED line, never a failure) until `npx expo prebuild` has made one.
import { configProblems } from './network-config-layer.ts';
import { podProblems } from './network-pods-layer.ts';

import type { ExpoConfigLike } from './network-config-layer.ts';

export const PODS_SKIPPED = 'SKIPPED pods layer: no ios/Podfile.lock (run npx expo prebuild first)';

export function podAndConfigProblems(input: {
  readonly podfileLock: string | null;
  readonly config: ExpoConfigLike;
}): string[] {
  const pods = input.podfileLock === null ? [PODS_SKIPPED] : podProblems(input.podfileLock);
  return [...pods, ...configProblems(input.config)];
}
