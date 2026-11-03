// ship-placeholders.mjs: the one list of scaffold placeholders a ship gate refuses by name, with the
// owner step that replaces each one, the owner-placeholder result every gate prints, and the one
// app id rule (a helper, not an entry point). Shared by ios-release-testflight (check-release-setup,
// check-store-artifact), privacy-and-network-audit (audit-app-bundle, audit-bundle), ios-simulator-build
// (check-sim-app --variant store), android-emulator-build (check-emu-app) and android-release-play
// (check-store-aab, check-release-setup-android); new-game-scaffold's app-files.mjs re-exports the
// list for check-game-app --stage complete. Each checker re-exports PLACEHOLDERS and its self-test pins it.
//
// Owner decision O4 (2026-09-30): every app's iOS bundle id and Android package is
// io.applander.<game id without hyphens>, all lowercase (Line Siege: io.applander.linesiege), and
// Premium is <bundle id>.premium. The scaffold writes Google's documented placeholder AdMob ids and
// example.com links until the owner supplies the real ones: owner step G5 (the AdMob app and its
// three units) and owner step G3 (the privacy-policy host and the support address, with the App
// Privacy answers). A plausible-looking placeholder passes a format check
// (ca-app-pub-1234567890123456~1234567890 matches ^ca-app-pub-\d{16}~\d{10}$), so the gates compare
// the values themselves.
//
// Not a real AdMob id (notRealAdIdOf, the one definition every gate that reads ad ids uses): a
// scaffold placeholder above, or any id of Google's sample publisher 3940256099942544 (Google's
// public test ids). A live build with them shows test ads and earns nothing, so where a gate reads
// the owner's ids (game.config.ts, a live build's units) a sample id is owner-placeholder too: G5 for
// the iOS ids, GP5 for the Android ids. Test builds (ADS_MODE test or off) carry Google's sample app id
// by design and no units; the gates require exactly that id there (GOOGLE_SAMPLE_APP_IDS).
//
// The result (lead decision L14, round-5 decision D68): every gate reports every placeholder under
// the rule owner-placeholder, naming the field, the placeholder and its owner step; the line before
// RESULT is "OWNER STEPS PENDING: G3, G5" (only the steps still pending), and the result stays
// FAIL. No mode turns a placeholder into a pass (--unsigned SKIPs only the signing rule). Until the
// owner supplies G3 and G5 a gate ends with exactly these lines; any other FAIL line is a real problem.

/** The rule every ship gate reports a scaffold placeholder under. */
export const OWNER_PLACEHOLDER_RULE = 'owner-placeholder';

/**
 * What each owner step supplies: G3 and G5 (human-steps of ios-release-testflight) and GP5, the
 * per-game Google Play step of android-release-play (the AdMob Android app and its three units).
 */
export const OWNER_STEP_TEXT = Object.freeze({
  G3: "the owner's privacy-policy host and support address (owner step G3, with the App Privacy answers and the store listing)",
  G5: "the owner's AdMob app id and its banner, interstitial and rewarded unit ids (owner step G5)",
  GP5: "the owner's AdMob Android app id and its banner, interstitial and rewarded unit ids (owner step GP5)",
});

/**
 * The Android AdMob ids a live Android build needs while game.config.ts still has
 * `ads.ids.android: null`: not a typed placeholder (nothing to match), so it is not in PLACEHOLDERS;
 * the Android gates report its absence with ownerPlaceholderProblem({ entry: ANDROID_AD_IDS_MISSING }).
 */
export const ANDROID_AD_IDS_MISSING = Object.freeze({
  field: 'ads.ids.android',
  value: 'ads.ids.android: null',
  name: 'missing: game.config.ts has',
  ownerStep: 'GP5',
  step: "the owner's AdMob Android app id and units (owner step GP5)",
  matches: () => false,
});

const exactly = (value) => (text) => text === value;
const entry = (field, value, name, ownerStep, step, matches) => Object.freeze({ field, value, name, ownerStep, step, matches });

/**
 * Every value a ship gate refuses by name, in game.config.ts order. `field` is the game.config.ts
 * field, `ownerStep` the owner step that replaces it (null: not the owner's, the agent fixes it),
 * `step` the sentence a fix names, `matches(text)` whether a string is this placeholder.
 */
export const PLACEHOLDERS = Object.freeze([
  entry('bundleId / premium.productId', 'com.example.*', 'the placeholder bundle id (com.example.*)', null, 'the fixed id io.applander.<game id without hyphens> (owner decision O4)', (text) => text.startsWith('com.example.')),
  entry('ads.ids.ios.appId', 'ca-app-pub-1234567890123456~1234567890', 'the placeholder AdMob app id', 'G5', "the owner's AdMob app id (owner step G5)", exactly('ca-app-pub-1234567890123456~1234567890')),
  entry('ads.ids.ios.units.banner', 'ca-app-pub-1234567890123456/1111111111', 'the placeholder AdMob banner unit', 'G5', "the owner's banner unit id (owner step G5)", exactly('ca-app-pub-1234567890123456/1111111111')),
  entry('ads.ids.ios.units.interstitial', 'ca-app-pub-1234567890123456/2222222222', 'the placeholder AdMob interstitial unit', 'G5', "the owner's interstitial unit id (owner step G5)", exactly('ca-app-pub-1234567890123456/2222222222')),
  entry('ads.ids.ios.units.rewarded', 'ca-app-pub-1234567890123456/3333333333', 'the placeholder AdMob rewarded unit', 'G5', "the owner's rewarded unit id (owner step G5)", exactly('ca-app-pub-1234567890123456/3333333333')),
  entry('links.privacyPolicy.host', 'example.com', 'the placeholder privacy-policy host', 'G3', "the owner's privacy-policy host (owner step G3)", exactly('example.com')),
  entry('links.supportEmail', 'support@example.com', 'the placeholder support address', 'G3', "the owner's support address (owner step G3)", exactly('support@example.com')),
]);

/** Google's sample AdMob publisher: every app and unit id under it is one of Google's public test ids. */
export const GOOGLE_SAMPLE_PUBLISHER = '3940256099942544';

/**
 * Google's sample app ids (developers.google.com/admob/ios/test-ads, .../android/test-ads): the AdMob
 * app id every non-live build carries (ads-config.ts GOOGLE_SAMPLE_APP_IDS), never a live build.
 */
export const GOOGLE_SAMPLE_APP_IDS = Object.freeze({
  ios: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~1458002511`,
  android: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~3347511713`,
});

/** The owner step that supplies a platform's AdMob app id and units: G5 on iOS, GP5 on Android. */
export const AD_IDS_OWNER_STEP = Object.freeze({ ios: 'G5', android: 'GP5' });

const GOOGLE_SAMPLE_AD_ID = new RegExp(`^ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}[~/]\\d+$`);
const GOOGLE_SAMPLE_NAME = "Google's sample (test) AdMob id";

/** Whether a value is one of Google's sample (test) AdMob ids: an app or unit id of the sample publisher. */
export function isGoogleSampleAdId(value) {
  return typeof value === 'string' && GOOGLE_SAMPLE_AD_ID.test(value);
}

function ownerStepOfPlatform(platform) {
  const step = AD_IDS_OWNER_STEP[platform];
  if (step === undefined) throw new Error(`AdMob ids belong to ios or android, not ${platform}`);
  return step;
}

/**
 * The scaffold's AdMob placeholder a value is (PLACEHOLDERS, owner step G5), with the platform's
 * owner step (GP5 for an Android id), or null. Google's sample ids are not in it: see notRealAdIdOf.
 */
export function adPlaceholderOf(value, platform = 'ios') {
  const ownerStep = ownerStepOfPlatform(platform);
  const placeholder = PLACEHOLDERS.find((item) => item.ownerStep === 'G5' && typeof value === 'string' && item.matches(value)) ?? null;
  if (placeholder === null || ownerStep === placeholder.ownerStep) return placeholder;
  return Object.freeze({ ...placeholder, field: placeholder.field.replace('ads.ids.ios.', `ads.ids.${platform}.`), ownerStep, step: OWNER_STEP_TEXT[ownerStep] });
}

/**
 * The one answer to "is this AdMob id the owner's?" for every ship gate: an entry when it is not (a
 * scaffold placeholder, or one of Google's sample ids, which serve test ads and earn nothing), to
 * report under owner-placeholder with the platform's owner step (G5 iOS, GP5 Android); null for an id
 * that may be the owner's. Ask it only where the owner's ids belong (game.config.ts, a live build's
 * units): every test build carries Google's sample app id on purpose.
 */
export function notRealAdIdOf(value, platform = 'ios') {
  const placeholder = adPlaceholderOf(value, platform);
  if (placeholder !== null || !isGoogleSampleAdId(value)) return placeholder;
  const ownerStep = ownerStepOfPlatform(platform);
  return Object.freeze({ field: `ads.ids.${platform}`, value, name: GOOGLE_SAMPLE_NAME, ownerStep, step: OWNER_STEP_TEXT[ownerStep], matches: (text) => text === value });
}

/**
 * Every quoted AdMob id in a game.config.ts source: its index (the opening quote), value, platform
 * (the nearest `ios:` or `android:` key before it; ios when there is none) and game.config.ts field
 * (ads.ids.<platform>.appId, or .units.<key> for any other key in front of it).
 */
export function adIdsInText(text) {
  const source = String(text ?? '');
  const found = [];
  for (const match of source.matchAll(/(?:\b(\w+)\s*:\s*)?(['"`])(ca-app-pub-\d+[~/]\d+)\2/g)) {
    const [whole, key, quote, value] = match;
    const index = match.index + whole.lastIndexOf(`${quote}${value}`);
    const platform = [...source.slice(0, index).matchAll(/\b(ios|android)\s*:/g)].at(-1)?.[1] ?? 'ios';
    const field = key === undefined ? `ads.ids.${platform}` : key === 'appId' ? `ads.ids.${platform}.appId` : `ads.ids.${platform}.units.${key}`;
    found.push({ index, value, platform, field });
  }
  return found;
}

/** The pre-O4 scaffold's bundle id prefix: never shipped, and not an owner step (the agent fixes it). */
export const LEGACY_BUNDLE_PREFIX = 'com.example.';

/** io.applander.<game id without hyphens>, all lowercase. */
export const APP_ID_PATTERN = /^io\.applander\.[a-z0-9]+$/;

export function appIdOf(gameId) {
  return `io.applander.${String(gameId).replaceAll('-', '')}`.toLowerCase();
}

/** Why a bundle id may not ship (placeholder, wrong domain, wrong game), or null. */
export function bundleIdProblem(bundleId, gameId = null) {
  const id = String(bundleId ?? '');
  if (id.startsWith(LEGACY_BUNDLE_PREFIX)) return `${id} is the scaffold's placeholder (com.example.*)`;
  if (!APP_ID_PATTERN.test(id)) return `${id || '(missing)'} is not io.applander.<game id without hyphens>`;
  if (gameId !== null && id !== appIdOf(gameId)) return `${id} is not ${appIdOf(gameId)}, the id of ${gameId}`;
  return null;
}

/** Every PLACEHOLDERS entry a string is (app-files.mjs' placeholdersIn). */
export function placeholdersIn(text) {
  return PLACEHOLDERS.filter((item) => typeof text === 'string' && item.matches(text));
}

/** The owner placeholder a value is (an entry with an owner step), or null. */
export function ownerPlaceholderOf(value) {
  if (typeof value !== 'string') return null;
  return PLACEHOLDERS.find((item) => item.ownerStep !== null && item.matches(value)) ?? null;
}

/**
 * The live AdMob units a built app's expo.extra.adUnits holds for one platform ('ios' or 'android'),
 * as [field, value] pairs for notRealAdIdOf(value, platform). withShell writes them per platform,
 * { ios: { banner, interstitial, rewarded }, android: { ... } | null } (ads-config.ts adUnitsExtra),
 * so a gate reads only the entry of the platform its artefact is for (field extra.adUnits.<platform>.<slot>);
 * the flat { banner, interstitial, rewarded } of earlier builds is read as it is (field extra.adUnits.<slot>).
 */
export function adUnitFields(adUnits, platform) {
  if (typeof adUnits !== 'object' || adUnits === null) return [];
  const isPerPlatform = 'ios' in adUnits || 'android' in adUnits;
  const units = isPerPlatform ? adUnits[platform] : adUnits;
  if (typeof units !== 'object' || units === null) return [];
  const prefix = isPerPlatform ? `extra.adUnits.${platform}` : 'extra.adUnits';
  return Object.entries(units).map(([slot, unit]) => [`${prefix}.${slot}`, unit]);
}

/** The placeholder's name for a message (owner placeholders and com.example.*), or null. */
export function placeholderName(value) {
  return placeholdersIn(String(value ?? ''))[0]?.name ?? null;
}

/**
 * Every owner placeholder inside a source file (game.config.ts), with its index and entry: the links
 * (G3), every AdMob id that is not a real one (notRealAdIdOf: a scaffold placeholder or Google's sample
 * id, G5 under `ios:`, GP5 under `android:`, the entry's field from the key in front of it), and every
 * quoted com.example.* id (entry ownerStep null).
 */
export function placeholdersInText(text) {
  const found = [];
  for (const item of PLACEHOLDERS.filter((candidate) => candidate.ownerStep === 'G3')) {
    const quoted = new RegExp(`['"\`]${item.value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"\`]`, 'g');
    for (const match of text.matchAll(quoted)) found.push({ index: match.index, value: item.value, name: item.name, entry: item });
  }
  for (const id of adIdsInText(text)) {
    const entry = notRealAdIdOf(id.value, id.platform);
    if (entry !== null) found.push({ index: id.index, value: id.value, name: entry.name, entry: Object.freeze({ ...entry, field: id.field }) });
  }
  const legacy = PLACEHOLDERS[0];
  for (const match of text.matchAll(/['"`](com\.example\.[\w.]*)['"`]/g)) found.push({ index: match.index, value: match[1], name: legacy.name, entry: legacy });
  return found.sort((a, b) => a.index - b.index);
}

/**
 * The problem a gate reports for an owner placeholder: rule owner-placeholder, naming the field
 * (`where`: the game.config.ts field, or the place inside a built app), the placeholder and its
 * owner step. Pass it to report.problem().
 */
export function ownerPlaceholderProblem({ entry: item, where = item.field, file, line = 0 }) {
  return {
    file,
    line,
    rule: OWNER_PLACEHOLDER_RULE,
    message: `${where} is ${item.name} ${item.value} (owner step ${item.ownerStep})`,
    fix: `Waits for ${OWNER_STEP_TEXT[item.ownerStep]}; never type a stand-in${isGoogleSampleAdId(item.value) ? " (Google's sample ids serve test ads and earn nothing; test builds get them from ADS_MODE test, never from game.config.ts)" : ''}. Until the owner supplies it this gate ends FAIL with this line and the OWNER STEPS PENDING line, by design.`,
  };
}

/** G steps first, then GP steps (Google Play), each by number: G3, G5, GP5. */
function ownerStepOrder(a, b) {
  const [, letterA, numberA] = /^(GP|G)(\d+)$/.exec(a);
  const [, letterB, numberB] = /^(GP|G)(\d+)$/.exec(b);
  return letterA === letterB ? Number(numberA) - Number(numberB) : letterA.length - letterB.length;
}

/** The owner steps still pending, from a gate's problems (rule owner-placeholder), sorted: ['G3', 'G5', 'GP5']. */
export function ownerStepsPending(problems) {
  const steps = new Set();
  for (const problem of problems ?? []) {
    if (problem?.rule !== OWNER_PLACEHOLDER_RULE) continue;
    for (const match of `${problem.message ?? ''} ${problem.fix ?? ''}`.matchAll(/owner step (GP\d+|G\d+)/g)) steps.add(match[1]);
  }
  return [...steps].sort(ownerStepOrder);
}

/** "OWNER STEPS PENDING: G3, G5" for a gate's problems, or null when no owner placeholder is left. */
export function ownerStepsPendingLine(problems) {
  const steps = ownerStepsPending(problems);
  return steps.length === 0 ? null : `OWNER STEPS PENDING: ${steps.join(', ')}`;
}

/**
 * report.finish() with the OWNER STEPS PENDING line printed right before the RESULT line (when any
 * owner placeholder was reported). The RESULT stays FAIL: a placeholder is never a pass.
 */
export function finishWithOwnerSteps(report, finishOptions) {
  const line = ownerStepsPendingLine(report.problems);
  if (line === null) return report.finish(finishOptions);
  const log = console.log;
  console.log = (...args) => {
    if (/^RESULT: /.test(String(args[0] ?? ''))) log(line);
    log(...args);
  };
  try {
    return report.finish(finishOptions);
  } finally {
    console.log = log;
  }
}
