// packages/tooling/src/audit/release-bundle-checks.ts
import { modulesMatching, packageOf } from './bundle-modules.ts';

import type { BundleModule } from './bundle-modules.ts';

// Google's sample publisher id may appear ONLY inside the AdMob library itself
// (its TestIds and doc comments are always bundled: Metro does not tree-shake).
const SAMPLE_PUBLISHER = /3940256099942544/;
const DEBUG_SENTINEL = /SHELL_TEST_BUILD_ONLY/; // the test-only entry's TEST_BUILD_SENTINEL
const STOREKIT_TEST = /StoreKitTest|SKTestSession/;

export function storeBundleProblems(modules: readonly BundleModule[]): string[] {
  const sampleIds = modulesMatching(modules, SAMPLE_PUBLISHER).filter(
    (source) => packageOf(source) !== 'react-native-google-mobile-ads',
  );
  return [
    ...sampleIds.map((s) => `Google sample ad id outside the AdMob library: ${s}`),
    ...modulesMatching(modules, DEBUG_SENTINEL).map((s) => `debug-only module shipped: ${s}`),
    ...modulesMatching(modules, STOREKIT_TEST).map((s) => `StoreKit test code shipped: ${s}`),
    ...modules
      .filter((m) => m.source.includes('/screens/debug/'))
      .map((m) => `debug screen shipped: ${m.source}`),
  ];
}
