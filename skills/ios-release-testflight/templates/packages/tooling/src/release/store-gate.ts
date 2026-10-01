// packages/tooling/src/release/store-gate.ts
// The store-artifact gate (release step 7) as a pure function: facts read from the exported .ipa
// in, problems out. The only check that proves the debug menu, the StoreKit test harness and test
// ads are absent from what players receive, so it runs before --validate-app. A partial Shell's
// placeholder screen (NotBuiltScreen, testID not-built.screen) fails every variant: a slice never ships.
// Every variant also carries the app id io.applander.<game id without hyphens> (owner decision O4),
// no scaffold placeholder (the AdMob ids until owner step G5, the example.com links), and Apple's
// tracking prompt text in Info.plist and every app language (owner decision O1).
import type { BuildVariant } from '@e07/shell/config/app-variant.ts';

export const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;

/** The scaffold's placeholders, refused by name: a format check alone lets them through. */
export const PLACEHOLDERS = {
  bundleIdPrefix: 'com.example.',
  admobAppId: 'ca-app-pub-1234567890123456~1234567890',
  admobUnits: [
    'ca-app-pub-1234567890123456/1111111111',
    'ca-app-pub-1234567890123456/2222222222',
    'ca-app-pub-1234567890123456/3333333333',
  ],
  privacyHost: 'example.com',
  supportEmail: 'support@example.com',
} as const;

/** The app languages; each .lproj carries the tracking prompt text. */
export const TRACKING_LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;
type TrackingPlace = 'Info.plist' | (typeof TRACKING_LANGUAGES)[number];

/** io.applander.<game id without hyphens>, all lowercase (owner decision O4). */
export function appIdOf(gameId: string): string {
  return `io.applander.${gameId.replaceAll('-', '')}`.toLowerCase();
}

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
  readonly bundleId: string | undefined;
  /** extra.adUnits values (live builds only). */
  readonly adUnits: readonly string[];
  /** extra.game.links: the privacy-policy host and the support address. */
  readonly privacyHost: string | undefined;
  readonly supportEmail: string | undefined;
  /** Where NSUserTrackingUsageDescription is non-empty: Info.plist and each <lang>.lproj. */
  readonly trackingText: Readonly<Record<TrackingPlace, boolean>>;
};

export type GateExpectation = {
  readonly variant: BuildVariant;
  readonly buildNumber: number;
  readonly version: string;
  /** The game id (--app): the bundle id must be appIdOf(game). */
  readonly game: string;
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
  if (id === PLACEHOLDERS.admobAppId) {
    return `GADApplicationIdentifier ${id} is the placeholder AdMob app id (owner step G5)`;
  }
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

function appIdProblem(facts: ArtifactFacts, expected: GateExpectation): string {
  const id = facts.bundleId ?? '(missing)';
  if (id.startsWith(PLACEHOLDERS.bundleIdPrefix)) {
    return `CFBundleIdentifier ${id} is the scaffold's placeholder (com.example.*)`;
  }
  const wanted = appIdOf(expected.game);
  return id === wanted ? '' : `CFBundleIdentifier ${id} is not ${wanted}`;
}

function placeholderProblems(facts: ArtifactFacts): string[] {
  const units: readonly string[] = PLACEHOLDERS.admobUnits;
  return [
    ...facts.adUnits
      .filter((unit) => units.includes(unit))
      .map((unit) => `extra.adUnits holds the placeholder AdMob unit ${unit} (owner step G5)`),
    facts.privacyHost === PLACEHOLDERS.privacyHost
      ? 'extra.game.links holds the placeholder privacy-policy host example.com'
      : '',
    facts.supportEmail === PLACEHOLDERS.supportEmail
      ? 'extra.game.links holds the placeholder support address support@example.com'
      : '',
  ];
}

function trackingTextProblems(facts: ArtifactFacts): string[] {
  const places: readonly TrackingPlace[] = ['Info.plist', ...TRACKING_LANGUAGES];
  return places
    .filter((place) => !facts.trackingText[place])
    .map((place) =>
      place === 'Info.plist'
        ? 'Info.plist has no NSUserTrackingUsageDescription (the tracking prompt would crash the app)'
        : `${place}.lproj/InfoPlist.strings has no NSUserTrackingUsageDescription`,
    );
}

/**
 * Every check runs for store builds; test builds run the identity, entitlement, app id, tracking
 * text and placeholder-screen checks.
 */
export function storeGateProblems(facts: ArtifactFacts, expected: GateExpectation): string[] {
  const isStore = expected.variant.appVariant === 'store';
  const all = [
    ...identityProblems(facts, expected),
    adIdProblem(facts, expected),
    appIdProblem(facts, expected),
    ...trackingTextProblems(facts),
    ...(isStore ? [...storeOnlyProblems(facts), ...placeholderProblems(facts)] : []),
  ];
  return all.filter((problem) => problem !== '');
}
