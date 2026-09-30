// packages/tooling/src/release/store-gate.ts
// The store-artifact gate (release step 7) as a pure function: facts read from the exported .ipa
// in, problems out. The only check that proves the debug menu, the StoreKit test harness and test
// ads are absent from what players receive, so it runs before --validate-app. A partial Shell's
// placeholder screen (NotBuiltScreen, testID not-built.screen) fails every variant: a slice never ships.
import type { BuildVariant } from '@e07/shell/config/app-variant.ts';

export const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;

export type ArtifactFacts = {
  readonly buildNumber: string;
  readonly version: string;
  readonly usesNonExemptEncryption: boolean | undefined;
  readonly gadAppId: string | undefined;
  readonly extraAppVariant: string | undefined;
  readonly extraAdsMode: string | undefined;
  readonly sentinelCount: number;
  /** How often main.jsbundle holds 'not-built.screen', NotBuiltScreen's testID. */
  readonly placeholderCount: number;
  readonly testArtefacts: readonly string[];
  readonly hasPrivacyManifest: boolean;
  readonly hasGetTaskAllow: boolean;
  readonly allowsArbitraryLoads: boolean;
};

export type GateExpectation = {
  readonly variant: BuildVariant;
  readonly buildNumber: number;
  readonly version: string;
};

function identityProblems(facts: ArtifactFacts, expected: GateExpectation): string[] {
  const { appVariant, adsMode } = expected.variant;
  return [
    facts.buildNumber === String(expected.buildNumber)
      ? ''
      : `CFBundleVersion ${facts.buildNumber} is not the new build number ${String(expected.buildNumber)}`,
    facts.version === expected.version
      ? ''
      : `CFBundleShortVersionString ${facts.version} is not ${expected.version}`,
    facts.extraAppVariant === appVariant
      ? ''
      : `extra.appVariant is ${String(facts.extraAppVariant)}, not ${appVariant}`,
    facts.extraAdsMode === adsMode
      ? ''
      : `extra.adsMode is ${String(facts.extraAdsMode)}, not ${adsMode}`,
    facts.hasGetTaskAllow ? 'the get-task-allow entitlement is present (a debug entitlement)' : '',
    facts.placeholderCount === 0
      ? ''
      : `main.jsbundle contains the NotBuiltScreen placeholder (not-built.screen): a partial Shell never ships`,
  ];
}

function adIdProblem(facts: ArtifactFacts, expected: GateExpectation): string {
  const id = facts.gadAppId ?? '';
  const shown = id === '' ? '(missing)' : id;
  if (expected.variant.adsMode === 'live') {
    const isLive = LIVE_APP_ID.test(id) && id !== SAMPLE_APP_ID;
    return isLive ? '' : `GADApplicationIdentifier ${shown} is not a live AdMob app ID`;
  }
  return id === SAMPLE_APP_ID ? '' : `GADApplicationIdentifier ${shown} is not the sample app ID`;
}

function storeOnlyProblems(facts: ArtifactFacts): string[] {
  return [
    facts.usesNonExemptEncryption === false ? '' : 'ITSAppUsesNonExemptEncryption is not false',
    facts.sentinelCount === 0
      ? ''
      : `main.jsbundle contains SHELL_TEST_BUILD_ONLY ${String(facts.sentinelCount)} time(s)`,
    ...facts.testArtefacts.map((path) => `test artefact shipped: ${path}`),
    facts.hasPrivacyManifest ? '' : 'PrivacyInfo.xcprivacy is missing',
    facts.allowsArbitraryLoads ? 'NSAllowsArbitraryLoads is true' : '',
  ];
}

/** Every check runs for store builds; test builds run the identity, entitlement and placeholder checks. */
export function storeGateProblems(facts: ArtifactFacts, expected: GateExpectation): string[] {
  const all = [
    ...identityProblems(facts, expected),
    adIdProblem(facts, expected),
    ...(expected.variant.appVariant === 'store' ? storeOnlyProblems(facts) : []),
  ];
  return all.filter((problem) => problem !== '');
}
