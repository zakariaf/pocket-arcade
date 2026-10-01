// ship-placeholders.mjs: the one list of scaffold placeholders a ship gate refuses by name, with the
// owner step that replaces each one, the owner-placeholder result every gate prints, and the one
// app id rule (a helper, not an entry point). Shared by ios-release-testflight (check-release-setup,
// check-store-artifact), privacy-and-network-audit (audit-app-bundle) and ios-simulator-build
// (check-sim-app --variant store); new-game-scaffold's app-files.mjs re-exports the list for
// check-game-app --stage complete. Each checker re-exports PLACEHOLDERS and its self-test pins it.
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
// The result (lead decision L14, round-5 decision D68): every gate reports every placeholder under
// the rule owner-placeholder, naming the field, the placeholder and its owner step; the line before
// RESULT is "OWNER STEPS PENDING: G3, G5" (only the steps still pending), and the result stays
// FAIL. No mode turns a placeholder into a pass (--unsigned SKIPs only the signing rule). Until the
// owner supplies G3 and G5 a gate ends with exactly these lines; any other FAIL line is a real problem.

/** The rule every ship gate reports a scaffold placeholder under. */
export const OWNER_PLACEHOLDER_RULE = 'owner-placeholder';

/** What each owner step supplies (human-steps G3 and G5 of ios-release-testflight). */
export const OWNER_STEP_TEXT = Object.freeze({
  G3: "the owner's privacy-policy host and support address (owner step G3, with the App Privacy answers and the store listing)",
  G5: "the owner's AdMob app id and its banner, interstitial and rewarded unit ids (owner step G5)",
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

/** The placeholder's name for a message (owner placeholders and com.example.*), or null. */
export function placeholderName(value) {
  return placeholdersIn(String(value ?? ''))[0]?.name ?? null;
}

/**
 * Every owner placeholder inside a source file (game.config.ts), with its index and entry, and every
 * quoted com.example.* id (entry ownerStep null).
 */
export function placeholdersInText(text) {
  const found = [];
  for (const item of PLACEHOLDERS.filter((candidate) => candidate.ownerStep !== null)) {
    const quoted = new RegExp(`['"\`]${item.value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"\`]`, 'g');
    for (const match of text.matchAll(quoted)) found.push({ index: match.index, value: item.value, name: item.name, entry: item });
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
    fix: `Waits for ${OWNER_STEP_TEXT[item.ownerStep]}; never type a stand-in. Until the owner supplies it this gate ends FAIL with this line and the OWNER STEPS PENDING line, by design.`,
  };
}

/** The owner steps still pending, from a gate's problems (rule owner-placeholder), sorted: ['G3', 'G5']. */
export function ownerStepsPending(problems) {
  const steps = new Set();
  for (const problem of problems ?? []) {
    if (problem?.rule !== OWNER_PLACEHOLDER_RULE) continue;
    for (const match of `${problem.message ?? ''} ${problem.fix ?? ''}`.matchAll(/owner step (G\d+)/g)) steps.add(match[1]);
  }
  return [...steps].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
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
