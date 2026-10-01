// ship-placeholders.mjs: the one list of scaffold placeholders a ship gate refuses by name, and the
// one app id rule (a helper, not an entry point). Shared by ios-release-testflight
// (check-release-setup, check-store-artifact), privacy-and-network-audit (audit-app-bundle) and
// ios-simulator-build (check-sim-app --variant store); each checker re-exports PLACEHOLDERS and its
// self-test pins the list.
//
// Owner decision O4 (2026-09-30): every app's iOS bundle id and Android package is
// io.applander.<game id without hyphens>, all lowercase (Line Siege: io.applander.linesiege), and
// Premium is <bundle id>.premium. The scaffold writes Google's documented placeholder AdMob ids and
// example.com links until the owner supplies the real ones (owner step G5 for AdMob): a build that
// still carries one of them must never ship. A plausible-looking placeholder passes a format check
// (ca-app-pub-1234567890123456~1234567890 matches ^ca-app-pub-\d{16}~\d{10}$), so the gates compare
// the values themselves.

export const PLACEHOLDERS = Object.freeze({
  /** Any bundle id or package under com.example. (the pre-O4 scaffold default). */
  bundleIdPrefix: 'com.example.',
  /** The scaffold's placeholder AdMob app id. */
  admobAppId: 'ca-app-pub-1234567890123456~1234567890',
  /** The scaffold's placeholder AdMob units: banner, interstitial, rewarded. */
  admobUnits: Object.freeze([
    'ca-app-pub-1234567890123456/1111111111',
    'ca-app-pub-1234567890123456/2222222222',
    'ca-app-pub-1234567890123456/3333333333',
  ]),
  /** The scaffold's privacy-policy host. */
  privacyHost: 'example.com',
  /** The scaffold's support address. */
  supportEmail: 'support@example.com',
});

/** io.applander.<game id without hyphens>, all lowercase. */
export const APP_ID_PATTERN = /^io\.applander\.[a-z0-9]+$/;

export function appIdOf(gameId) {
  return `io.applander.${String(gameId).replaceAll('-', '')}`.toLowerCase();
}

/** Why a bundle id may not ship (placeholder, wrong domain, wrong game), or null. */
export function bundleIdProblem(bundleId, gameId = null) {
  const id = String(bundleId ?? '');
  if (id.startsWith(PLACEHOLDERS.bundleIdPrefix)) return `${id} is the scaffold's placeholder (com.example.*)`;
  if (!APP_ID_PATTERN.test(id)) return `${id || '(missing)'} is not io.applander.<game id without hyphens>`;
  if (gameId !== null && id !== appIdOf(gameId)) return `${id} is not ${appIdOf(gameId)}, the id of ${gameId}`;
  return null;
}

/** The placeholder a value is (its name for the message), or null. */
export function placeholderName(value) {
  const text = String(value ?? '');
  if (text === PLACEHOLDERS.admobAppId) return 'the placeholder AdMob app id';
  if (PLACEHOLDERS.admobUnits.includes(text)) return 'a placeholder AdMob unit id';
  if (text.startsWith(PLACEHOLDERS.bundleIdPrefix)) return 'the placeholder bundle id (com.example.*)';
  if (text === PLACEHOLDERS.privacyHost) return 'the placeholder privacy-policy host example.com';
  if (text === PLACEHOLDERS.supportEmail) return 'the placeholder support address support@example.com';
  return null;
}

/** Every placeholder text inside a source file (game.config.ts), with its index. */
export function placeholdersInText(text) {
  const found = [];
  const add = (needle, name) => {
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) found.push({ index: at, value: needle, name });
  };
  add(PLACEHOLDERS.admobAppId, 'the placeholder AdMob app id');
  for (const unit of PLACEHOLDERS.admobUnits) add(unit, 'a placeholder AdMob unit id');
  for (const match of text.matchAll(/['"`](com\.example\.[\w.]*)['"`]/g)) found.push({ index: match.index, value: match[1], name: 'the placeholder bundle id (com.example.*)' });
  for (const match of text.matchAll(/['"`]example\.com['"`]/g)) found.push({ index: match.index, value: PLACEHOLDERS.privacyHost, name: 'the placeholder privacy-policy host example.com' });
  add(PLACEHOLDERS.supportEmail, 'the placeholder support address support@example.com');
  return found.sort((a, b) => a.index - b.index);
}
