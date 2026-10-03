// packages/tooling/src/audit/network-pods-layer.ts
// Layer D: vendor pods (downloaded from the CocoaPods trunk, i.e. not built from node_modules)
// must be on the allowlist, and only Google's pods may declare tracking in their manifests.
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

export function podProblems(podfileLock: string): string[] {
  return trunkPods(podfileLock)
    .filter((pod) => !VENDOR_POD_ALLOWLIST.has(pod))
    .map((pod) => `vendor pod ${pod} is not on the N3 allowlist`);
}
