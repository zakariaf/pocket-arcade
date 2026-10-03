// packages/tooling/src/audit/network-pods-layer.ts
// Layer D: vendor pods (downloaded from the CocoaPods trunk, i.e. not built from node_modules)
// must be on the allowlist, and only Google's pods may declare tracking in their manifests. A pod
// from EXTERNAL SOURCES passes only when it is built from a folder in the repo (an autolinked npm
// or workspace module, whose code layer C scans): a :git, :http or remote :podspec source, or a
// :path outside the repo, is a binary or source no other layer reads.
import { posix } from 'node:path';
export const VENDOR_POD_ALLOWLIST: ReadonlySet<string> = new Set([
  'Google-Mobile-Ads-SDK', // react-native-google-mobile-ads (spec N3 (a))
  'GoogleUserMessagingPlatform', // UMP consent, same component
  'openiap', // expo-iap's StoreKit 2 core (spec N3 (b))
]);

// Podfile.lock lists trunk pods under "SPEC REPOS:" -> "  trunk:" -> "    - Name".
export function trunkPods(podfileLock: string): string[] {
  const section = podfileLock.split('\nSPEC REPOS:\n')[1]?.split('\n\n')[0] ?? '';
  return section
    .split('\n')
    .map((line) => /^ {4}- "?([^"\s]+)"?$/.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

/**
 * Podfile.lock's "EXTERNAL SOURCES:": every pod not taken from the trunk, with its source keys
 * ("  Name:" then "    :path: \"../node_modules/x\"", :podspec, :git, :http, :tag...).
 */
export function externalSources(
  podfileLock: string,
): Map<string, Readonly<Record<string, string>>> {
  const section = podfileLock.split('\nEXTERNAL SOURCES:\n')[1]?.split('\n\n')[0] ?? '';
  const sources = new Map<string, Record<string, string>>();
  let current: Record<string, string> = {};
  for (const line of section.split('\n')) {
    const pod = /^ {2}"?([^"\s]+?)"?:$/.exec(line)?.[1];
    if (pod !== undefined) sources.set(pod, (current = {}));
    const key = /^ {4}:(\w+): "?([^"]*)"?$/.exec(line);
    if (key?.[1] !== undefined) current[key[1]] = key[2] ?? '';
  }
  return sources;
}

/** Where apps/<game>/ios sits in the repo: Podfile.lock's :path and :podspec are relative to it. */
const IOS_DIR_IN_REPO = 'apps/game/ios';
const REMOTE_KEYS = ['git', 'http'] as const;

/** The source of an external pod that is neither the trunk nor a folder in the repo, or null. */
function foreignSource(source: Readonly<Record<string, string>>): [string, string] | null {
  const remote = REMOTE_KEYS.find((key) => source[key] !== undefined);
  if (remote !== undefined) return [remote, source[remote] ?? ''];
  const key = source['path'] === undefined ? 'podspec' : 'path';
  const value = source[key];
  if (value === undefined) return null;
  const inRepo = posix.normalize(posix.join(IOS_DIR_IN_REPO, value));
  const isInside = !value.includes('://') && !posix.isAbsolute(value) && !inRepo.startsWith('../');
  return isInside ? null : [key, value];
}

function externalPodProblems(podfileLock: string): string[] {
  return [...externalSources(podfileLock)].flatMap(([pod, source]) => {
    const foreign = VENDOR_POD_ALLOWLIST.has(pod) ? null : foreignSource(source);
    if (foreign === null) return [];
    const [kind, value] = foreign;
    return [
      `pod ${pod} comes from a :${kind} source (${value}), not the CocoaPods trunk or a folder in the repo`,
    ];
  });
}

export function podProblems(podfileLock: string): string[] {
  const trunk = trunkPods(podfileLock)
    .filter((pod) => !VENDOR_POD_ALLOWLIST.has(pod))
    .map((pod) => `vendor pod ${pod} is not on the N3 allowlist`);
  return [...trunk, ...externalPodProblems(podfileLock)];
}
