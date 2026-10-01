// packages/tooling/src/release/store-gate.ts
// The store-artifact gate (release step 7) as a pure function: facts read from the exported .ipa
// in, problems out. The only check that proves the debug menu, the StoreKit test harness and test
// ads are absent from what players receive, so it runs before --validate-app. A partial Shell's
// placeholder screen (NotBuiltScreen, testID not-built.screen) fails every variant: a slice never ships.
// Every variant also carries the app id io.applander.<game id without hyphens> (owner decision O4),
// no scaffold placeholder, and Apple's tracking prompt text in Info.plist and every app language
// (owner decision O1). A placeholder is an '[owner-placeholder] ...' problem naming its owner step
// (G5: the AdMob ids; G3: the store build's links); ownerStepsPendingLine gives the line the release
// stops with ('OWNER STEPS PENDING: G3, G5'). Until the owner supplies them, those are the only
// problems a release of the pilot can stop on here.
import type { BuildVariant } from '@e07/shell/config/app-variant.ts';

export const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;

/** The owner step that replaces a scaffold value (human steps G3 and G5); null: the agent fixes it. */
export type OwnerStep = 'G3' | 'G5';

export type Placeholder = {
  /** The game.config.ts field. */
  readonly field: string;
  readonly value: string;
  readonly name: string;
  readonly ownerStep: OwnerStep | null;
  /** What replaces it, for a fix text. */
  readonly step: string;
};

/**
 * The scaffold's placeholders, refused by name (a format check alone lets them through), each with
 * the owner step that replaces it: the same list as the ship gates' ship-placeholders.mjs (lead
 * decision L14). The line OWNER STEPS PENDING: G3, G5 lists the steps still pending.
 */
export const PLACEHOLDERS: readonly Placeholder[] = [
  {
    field: 'bundleId / premium.productId',
    value: 'com.example.*',
    name: 'the placeholder bundle id (com.example.*)',
    ownerStep: null,
    step: 'the fixed id io.applander.<game id without hyphens> (owner decision O4)',
  },
  {
    field: 'ads.ids.ios.appId',
    value: 'ca-app-pub-1234567890123456~1234567890',
    name: 'the placeholder AdMob app id',
    ownerStep: 'G5',
    step: "the owner's AdMob app id (owner step G5)",
  },
  {
    field: 'ads.ids.ios.units.banner',
    value: 'ca-app-pub-1234567890123456/1111111111',
    name: 'the placeholder AdMob banner unit',
    ownerStep: 'G5',
    step: "the owner's banner unit id (owner step G5)",
  },
  {
    field: 'ads.ids.ios.units.interstitial',
    value: 'ca-app-pub-1234567890123456/2222222222',
    name: 'the placeholder AdMob interstitial unit',
    ownerStep: 'G5',
    step: "the owner's interstitial unit id (owner step G5)",
  },
  {
    field: 'ads.ids.ios.units.rewarded',
    value: 'ca-app-pub-1234567890123456/3333333333',
    name: 'the placeholder AdMob rewarded unit',
    ownerStep: 'G5',
    step: "the owner's rewarded unit id (owner step G5)",
  },
  {
    field: 'links.privacyPolicy.host',
    value: 'example.com',
    name: 'the placeholder privacy-policy host',
    ownerStep: 'G3',
    step: "the owner's privacy-policy host (owner step G3)",
  },
  {
    field: 'links.supportEmail',
    value: 'support@example.com',
    name: 'the placeholder support address',
    ownerStep: 'G3',
    step: "the owner's support address (owner step G3)",
  },
];

const LEGACY_BUNDLE_PREFIX = 'com.example.';
const OWNER_PLACEHOLDER = '[owner-placeholder] ';

/** `[owner-placeholder] <where> is <name> <value> (owner step Gn)` for an owner placeholder, or ''. */
function ownerPlaceholderProblem(where: string, value: string | undefined): string {
  const found = PLACEHOLDERS.find((entry) => entry.ownerStep !== null && entry.value === value);
  const step = found?.ownerStep ?? null;
  if (found === undefined || step === null) return '';
  return `${OWNER_PLACEHOLDER}${where} is ${found.name} ${found.value} (owner step ${step})`;
}

/** 'OWNER STEPS PENDING: G3, G5' for the gate's problems (only the steps still pending), or null. */
export function ownerStepsPendingLine(problems: readonly string[]): string | null {
  const steps = new Set<string>();
  for (const problem of problems) {
    if (!problem.startsWith(OWNER_PLACEHOLDER)) continue;
    const step = /\(owner step (G\d+)\)$/.exec(problem)?.[1];
    if (step !== undefined) steps.add(step);
  }
  return steps.size === 0 ? null : `OWNER STEPS PENDING: ${[...steps].sort().join(', ')}`;
}

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
  const placeholder = ownerPlaceholderProblem('Info.plist GADApplicationIdentifier', id);
  if (placeholder !== '') return placeholder;
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
  if (id.startsWith(LEGACY_BUNDLE_PREFIX)) {
    return `CFBundleIdentifier ${id} is the scaffold's placeholder (com.example.*)`;
  }
  const wanted = appIdOf(expected.game);
  return id === wanted ? '' : `CFBundleIdentifier ${id} is not ${wanted}`;
}

/** The AdMob units (live builds) in every variant, the links in store builds: owner steps G5 and G3. */
function placeholderProblems(facts: ArtifactFacts, isStore: boolean): string[] {
  return [
    ...facts.adUnits.map((unit) => ownerPlaceholderProblem('extra.adUnits', unit)),
    ...(isStore
      ? [
          ownerPlaceholderProblem('extra.game.links.privacyPolicy.host', facts.privacyHost),
          ownerPlaceholderProblem('extra.game.links.supportEmail', facts.supportEmail),
        ]
      : []),
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
    ...(isStore ? storeOnlyProblems(facts) : []),
    ...placeholderProblems(facts, isStore),
  ];
  return all.filter((problem) => problem !== '');
}
