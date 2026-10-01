// app-files.mjs: the one renderer of the per-app files that both the monorepo bootstrap (the pilot
// app) and the new-game scaffold write into apps/<game-id>/: the game.config.ts settings, the
// placeholder entry, the catalogs and the font list. The skill library keeps the canonical copy and
// syncs it into both skills' scripts/lib/, so the two generators write identical bytes. Not an entry
// point: no side effects on import, node: built-ins only.

/** The four UI languages, in catalog order. */
export const LANGUAGES = Object.freeze(['en', 'de', 'fa', 'ckb']);

/** The five Toybox fonts and three licence texts every app bundles, byte for byte. */
export const FONT_FILES = Object.freeze([
  'LilitaOne.ttf',
  'Rubik-Regular.ttf',
  'Rubik-Bold.ttf',
  'Vazirmatn-Regular.ttf',
  'Vazirmatn-Bold.ttf',
  'LilitaOne-OFL.txt',
  'Rubik-OFL.txt',
  'Vazirmatn-OFL.txt',
]);

export const GAME_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const BUNDLE_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

/**
 * The owner's app ids (decision O4, 2026-09-30): every app's iOS bundle id and Android package is
 * io.applander.<game id without hyphens>, all lowercase (line-siege: io.applander.linesiege), and its
 * one Premium product is <bundle id>.premium. The scaffolds always write these; nothing overrides them.
 */
export const BUNDLE_PREFIX = 'io.applander.';
export function bundleIdFor(gameId) {
  return `${BUNDLE_PREFIX}${String(gameId).replaceAll('-', '').toLowerCase()}`;
}
export function premiumIdFor(gameId) {
  return `${bundleIdFor(gameId)}.premium`;
}

/**
 * The scaffold's placeholder values (and the older com.example ids) that must never reach a finished
 * app or a store build. `field` names the game.config.ts field, `step` the owner step that replaces
 * the value. check-game-app --stage complete (new-game-scaffold) rejects each one by name.
 */
export const PLACEHOLDERS = Object.freeze([
  Object.freeze({ value: 'com.example.*', field: 'bundleId / premium.productId', step: `the fixed id ${BUNDLE_PREFIX}<game id> (owner decision O4)`, matches: (text) => /^com\.example\./.test(text) }),
  Object.freeze({ value: 'ca-app-pub-1234567890123456~1234567890', field: 'ads.ids.ios.appId', step: 'the owner\'s AdMob app id (owner step G5)', matches: (text) => text === 'ca-app-pub-1234567890123456~1234567890' }),
  Object.freeze({ value: 'ca-app-pub-1234567890123456/1111111111', field: 'ads.ids.ios.units.banner', step: 'the owner\'s banner unit id (owner step G5)', matches: (text) => text === 'ca-app-pub-1234567890123456/1111111111' }),
  Object.freeze({ value: 'ca-app-pub-1234567890123456/2222222222', field: 'ads.ids.ios.units.interstitial', step: 'the owner\'s interstitial unit id (owner step G5)', matches: (text) => text === 'ca-app-pub-1234567890123456/2222222222' }),
  Object.freeze({ value: 'ca-app-pub-1234567890123456/3333333333', field: 'ads.ids.ios.units.rewarded', step: 'the owner\'s rewarded unit id (owner step G5)', matches: (text) => text === 'ca-app-pub-1234567890123456/3333333333' }),
  Object.freeze({ value: 'example.com', field: 'links.privacyPolicy.host', step: 'the owner\'s privacy policy host (the privacy link, owner step G3 with the App Privacy answers)', matches: (text) => text === 'example.com' }),
  Object.freeze({ value: 'support@example.com', field: 'links.supportEmail', step: 'the owner\'s support address (the privacy link\'s contact, owner step G3)', matches: (text) => text === 'support@example.com' }),
]);

/**
 * The generators have no --bundle-id option any more (the id is fixed). An old command line may still
 * pass one: with the fixed id it is dropped, with any other value the caller stops with exit 2.
 * Returns { argv } without the option, or { error: [message, fix] }.
 */
export function withoutBundleIdOption(argv, defaultApp) {
  const at = argv.findIndex((arg) => arg === '--bundle-id' || arg.startsWith('--bundle-id='));
  if (at === -1) return { argv };
  const inline = argv[at].startsWith('--bundle-id=');
  const given = inline ? argv[at].slice('--bundle-id='.length) : argv[at + 1];
  const appAt = argv.findIndex((arg) => arg === '--app' || arg.startsWith('--app='));
  const app = appAt === -1 ? defaultApp : argv[appAt].startsWith('--app=') ? argv[appAt].slice('--app='.length) : argv[appAt + 1];
  const expected = app === undefined ? `${BUNDLE_PREFIX}<game id without hyphens>` : bundleIdFor(app);
  if (given !== expected) return { error: [`--bundle-id ${given ?? '(no value)'}: every app's bundle id is ${expected} (owner decision O4), and the scaffold writes it`, `Drop --bundle-id; the scaffold writes the fixed ${BUNDLE_PREFIX} id and <bundle id>.premium.`] };
  return { argv: [...argv.slice(0, at), ...argv.slice(at + (inline ? 1 : 2))] };
}

/** Every placeholder a string holds, as PLACEHOLDERS entries. */
export function placeholdersIn(text) {
  return PLACEHOLDERS.filter((entry) => typeof text === 'string' && entry.matches(text));
}
export const RESERVED_IDS = Object.freeze(new Set(['game-kit', 'shell', 'tooling', 'app', 'apps', 'packages', 'test']));

/** hints.freePerDay per hint design: no hint, or a solver's next move (spec 8.5: one free per day). */
export const HINT_FREE_PER_DAY = Object.freeze({ none: 0, solver: 1 });
/** isContinueAllowed per continue design (rules.continueRun.kind). */
export const CONTINUE_ALLOWED = Object.freeze({ once: true, none: false });
/** App Store Connect answers for "cartoon or fantasy violence" the templates accept. */
export const VIOLENCE_RATINGS = Object.freeze(['NONE', 'INFREQUENT_OR_MILD', 'FREQUENT_OR_INTENSE']);

/** Lose-reason slugs of the games in the copy deck: games.<id>.loseReason becomes <id>.lose.<slug>. */
export const DECK_LOSE_SLUGS = Object.freeze({ 'line-siege': 'broke-through', 'flock-tilt': 'wolf-got-sheep', 'scrap-shove': 'caught' });
/** The lose slug of a game outside the deck (the Tap Flip templates: no moves left). */
export const DEFAULT_LOSE_SLUG = 'out-of-moves';
export const LOSE_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * The pilot, Line Siege v1: levels, daily and endless; no hints (no exact solver); one continue
 * (the monsters fall back); monsters are hit, so the violence answer is INFREQUENT_OR_MILD. Its
 * catalogs are the canonical Line Siege set (copied byte for byte, never rendered).
 */
export const PILOT = Object.freeze({
  id: 'line-siege',
  name: 'Line Siege',
  modes: Object.freeze({ daily: true, endless: true }),
  hints: 'none',
  continueRun: 'once',
  violence: 'INFREQUENT_OR_MILD',
  loseSlug: 'broke-through',
});

/** The id forms: kebab (flock-tilt), Pascal (FlockTilt), camel (flockTilt), UPPER_SNAKE. */
export function idForms(gameId) {
  const pascal = gameId
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return { kebab: gameId, pascal, camel: pascal[0].toLowerCase() + pascal.slice(1), constant: gameId.toUpperCase().replaceAll('-', '_') };
}

/** A TypeScript single-quoted string literal. */
export function tsString(text) {
  return `'${String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

/** Replace every placeholder key of `values` in `text`. */
export function fillTemplate(text, values) {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(key, String(value)), text);
}

const PRINT_WIDTH = 100;

/**
 * appName as Prettier prints it: one line when it fits in 100 columns, otherwise one language per
 * line. A language whose name equals the Latin one shows LATIN_NAME.
 */
function appNameText(names) {
  const parts = LANGUAGES.map((lang) => `${lang}: ${lang === 'en' || names[lang] === names.en ? 'LATIN_NAME' : tsString(names[lang])}`);
  const oneLine = `  appName: { ${parts.join(', ')} },`;
  if (oneLine.length <= PRINT_WIDTH) return oneLine;
  return ['  appName: {', ...parts.map((part) => `    ${part},`), '  },'].join('\n');
}

/**
 * The problems of one game's settings, as sentences (empty when valid).
 * settings = { gameId, bundleId, names: { en, de, fa, ckb }, modes: { daily, endless },
 *              hints: 'none' | 'solver', continueRun: 'once' | 'none', violence }
 */
export function settingsProblems(settings) {
  const problems = [];
  if (!GAME_ID.test(settings.gameId) || RESERVED_IDS.has(settings.gameId)) problems.push(`game id "${settings.gameId}" is not a kebab-case game id`);
  if (settings.bundleId !== bundleIdFor(settings.gameId)) problems.push(`bundle id "${settings.bundleId}" is not ${bundleIdFor(settings.gameId)} (every app's id is ${BUNDLE_PREFIX}<game id without hyphens>, owner decision O4)`);
  for (const lang of LANGUAGES) if (typeof settings.names?.[lang] !== 'string' || settings.names[lang].trim() === '') problems.push(`the ${lang} name is empty`);
  if (!(settings.hints in HINT_FREE_PER_DAY)) problems.push(`hints "${settings.hints}" is not none or solver`);
  if (!(settings.continueRun in CONTINUE_ALLOWED)) problems.push(`continue "${settings.continueRun}" is not once or none`);
  if (!VIOLENCE_RATINGS.includes(settings.violence)) problems.push(`violence rating "${settings.violence}" is not ${VIOLENCE_RATINGS.join(', ')}`);
  return problems;
}

/** game.config.ts from the shared template (repo-templates/apps/__GAME_ID__/game.config.ts). */
export function renderGameConfig(template, settings) {
  const withNames = template.replace(/^ {2}appName: \{[^\n]*\},$/m, appNameText(settings.names));
  return fillTemplate(withNames, {
    "'__NAME_EN__'": tsString(settings.names.en),
    __GAME_ID__: settings.gameId,
    __BUNDLE_ID__: settings.bundleId,
    __MODE_DAILY__: settings.modes.daily,
    __MODE_ENDLESS__: settings.modes.endless,
    __HINTS_FREE_PER_DAY__: HINT_FREE_PER_DAY[settings.hints],
    __IS_CONTINUE_ALLOWED__: CONTINUE_ALLOWED[settings.continueRun],
    __VIOLENCE_RATING__: settings.violence,
  });
}

/** Keys sorted with the JavaScript default sort, as the catalog checks expect. */
export function sortedObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** A catalog file: flat, sorted, two-space JSON with a final newline. */
export function catalogText(entries) {
  return `${JSON.stringify(sortedObject(entries), null, 2)}\n`;
}

const kebab = (text) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** The copy deck's game entry for an id, or null. */
export function deckGame(deck, gameId) {
  return Object.values(deck?.games ?? {}).find((entry) => entry.id === gameId) ?? null;
}

/**
 * The copy deck's texts for a game as catalog entries: [{ key, texts: { en, de, fa, ckb } }].
 * loseReason maps to <id>.lose.<loseSlug>; the rest follows the field names (stats.fooBar ->
 * stats.foo-bar, howToPlay[0] -> how-to-play.step-1, packs[0] -> pack-name.1).
 */
export function deckEntries(deck, gameId, loseSlug) {
  const game = deckGame(deck, gameId);
  if (!game) return null;
  const out = [];
  const add = (key, texts) => out.push({ key: `${gameId}.${key}`, texts });
  for (const [field, value] of Object.entries(game)) {
    if (field === 'id' || field === 'modes') continue;
    if (field === 'loseReason') add(`lose.${loseSlug}`, value);
    else if (field === 'stats') for (const [stat, texts] of Object.entries(value)) add(`stats.${kebab(stat)}`, texts);
    else if (field === 'howToPlay' || field === 'tutorial') value.forEach((texts, index) => add(`${kebab(field)}.step-${index + 1}`, texts));
    else if (field === 'packs') value.forEach((texts, index) => add(`pack-name.${index + 1}`, texts));
    else if (value && typeof value === 'object' && typeof value.en === 'string') add(kebab(field), value);
  }
  return out;
}

/**
 * The four catalogs of a new game, { en, de, fa, ckb } of flat entries:
 *   a game in the copy deck: <id>.name plus the deck's texts (lose reason as <id>.lose.<slug>);
 *   any other game: the template catalogs (the keys the Tap Flip rules, board, level and teaching
 *   templates use) with the id, the names and the lose slug filled in.
 * templateCatalogs = { en: '<json text>', ... } with __GAME_ID__, __NAME_*__ and __LOSE_SLUG__.
 */
export function gameCatalogs({ deck, gameId, names, loseSlug, templateCatalogs }) {
  const entries = deckEntries(deck, gameId, loseSlug);
  const catalogs = {};
  for (const lang of LANGUAGES) {
    if (entries !== null) {
      catalogs[lang] = { [`${gameId}.name`]: names[lang] };
      for (const entry of entries) catalogs[lang][entry.key] = entry.texts[lang];
      continue;
    }
    const filled = fillTemplate(templateCatalogs[lang], { __GAME_ID__: gameId, __LOSE_SLUG__: loseSlug });
    const parsed = JSON.parse(filled);
    parsed[`${gameId}.name`] = names[lang];
    catalogs[lang] = parsed;
  }
  return catalogs;
}

/** FNV-1a (the RNG's hashSeed) folded to 16 bits: a stable daily-salt suggestion per game. */
export function suggestedSalt(gameId) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < gameId.length; i += 1) hash = Math.imul(hash ^ gameId.charCodeAt(i), 0x01000193);
  return ((hash >>> 0) ^ ((hash >>> 0) >>> 16)) & 0xffff;
}
