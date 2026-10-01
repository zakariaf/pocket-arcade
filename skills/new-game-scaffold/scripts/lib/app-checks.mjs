// app-checks.mjs: the checks behind check-game-app.mjs, one function per area. Not an entry point.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lineOf, readShellSlice, readText, REPO_SCAN_IGNORES, walk } from '../check-lib.mjs';
import { DECK_LOSE_SLUGS, deckEntries } from './app-files.mjs';
import { BUNDLE_PREFIX, bundleIdFor, existingApps, FONT_FILES, idForms, LANGUAGES, placeholdersIn, premiumIdFor } from './app-plan.mjs';
import { errorText } from './app-modules.mjs';
import { code } from './ts-scan.mjs';

/** The app tsconfig extends the repo's base config, two folders up (built from parts on purpose). */
const BASE_TSCONFIG = ['..', '..', 'tsconfig.base.json'].join('/');

export const SCAFFOLD_FILES = ['package.json', 'tsconfig.json', 'metro.config.js', 'app.config.ts', 'game.config.ts', 'index.ts', '.gitignore', ...LANGUAGES.map((lang) => `src/i18n/${lang}.json`)];

/** Every part of a finished game, each with the file(s) that satisfy it and the skill that builds it. */
export function moduleParts(id) {
  return [
    { part: 'module assembly', any: ['src/index.ts'], skill: 'game-host-integration' },
    { part: 'ShellGameTypes bag', any: [`src/${id}-types.ts`], skill: 'game-host-integration' },
    { part: 'contract test', any: ['src/contract.test.ts'], skill: 'game-host-integration' },
    { part: 'rules types', any: [`src/rules/${id}-types.ts`], skill: 'game-rules-engine' },
    ...['create', 'list-moves', 'apply-move', 'outcome'].map((name) => ({ part: `rules ${name}`, any: [`src/rules/${name}.ts`], skill: 'game-rules-engine' })),
    { part: 'engine assembly', any: [`src/rules/${id}-engine.ts`], skill: 'game-rules-engine' },
    { part: 'persistence', any: [`src/rules/${id}-persistence.ts`], skill: 'game-rules-engine' },
    { part: 'statistics counters', any: [`src/rules/${id}-stats.ts`], skill: 'game-rules-engine' },
    { part: 'bot and example states', any: [`src/testing/${id}-testing.ts`], skill: 'game-rules-engine' },
    { part: 'intentToMove', any: ['src/rules/intent-to-move.ts'], skill: 'board-gestures-and-input' },
    { part: 'levels', any: [`src/levels/${id}-levels.ts`], skill: 'level-generation-and-solvers' },
    { part: 'level tables', any: ['src/levels/pack-1.json'], skill: 'level-generation-and-solvers' },
    { part: 'board object', any: [`src/board/${id}-board.ts`], skill: 'board-rendering-skia' },
    ...['build-timeline', 'to-view', 'layout-board', 'draw-board'].map((name) => ({ part: `board ${name}`, any: [`src/board/${name}.ts`], skill: 'board-rendering-skia' })),
    { part: 'board palettes', any: ['src/board/board-palettes.ts'], skill: 'board-rendering-skia' },
    { part: 'UI palette', any: ['src/theme/palette.ts', 'src/board/ui-palette.ts'], skill: 'toybox-design-system' },
    { part: 'logo (LOGO_ART: icon, splash, S1 tile)', any: ['src/art/logo-art.ts'], skill: 'code-drawn-art-and-icons' },
    { part: 'presentation.art (GAME_ART: palettes, logo, S11d credits)', any: ['src/art/game-art.ts'], skill: 'code-drawn-art-and-icons' },
    { part: 'sound bank', any: ['src/sounds/sound-bank.ts'], skill: 'game-audio-and-haptics' },
    { part: 'teaching (tutorial, how to play)', any: [`src/tutorial/${id}-teaching.ts`], skill: 'game-host-integration' },
  ];
}

/** Repo-level evidence a finished game needs: goldens, sims, E2E flows. */
export function evidenceParts(id) {
  return [
    { part: 'board pixel goldens', test: (repo) => repo.exists(`test/goldens/boards/${id}-board.golden.test.ts`), where: `test/goldens/boards/${id}-board.golden.test.ts`, skill: 'board-rendering-skia' },
    { part: 'bot simulations', test: (repo) => repo.files(`test/sims/${id}`).some((file) => file.endsWith('.sim.test.ts')) || repo.files(`apps/${id}/src`).some((file) => file.endsWith('.sim.test.ts')), where: `test/sims/${id}/*.sim.test.ts`, skill: 'game-balance-and-bots' },
    { part: 'E2E flows', test: (repo) => repo.files(`apps/${id}/e2e/flows`).some((file) => file.endsWith('.yaml')), where: `apps/${id}/e2e/flows/**/*.yaml`, skill: 'e2e-maestro' },
    { part: 'parity facts pin test', test: (repo) => repo.exists(`apps/${id}/src/parity-game-facts.test.ts`), where: `apps/${id}/src/parity-game-facts.test.ts`, skill: 'toybox-visual-parity' },
  ];
}

/** Text of a repo file, or '' when it does not exist (existence is checked by its own rule). */
function textOf(repo, rel) {
  return repo.exists(rel) ? (readText(join(repo.root, rel)) ?? '') : '';
}

function readJson(repo, rel) {
  try {
    return JSON.parse(readFileSync(join(repo.root, rel), 'utf8'));
  } catch {
    return undefined;
  }
}

/** The root script "new-game" (the monorepo's package.json) must run a file that exists. */
export function checkNewGameScript(repo, report) {
  const script = readJson(repo, 'package.json')?.scripts?.['new-game'];
  const target = typeof script === 'string' ? /\bnode\s+(?:--\S+\s+)*(\S+\.(?:ts|mjs|js))\b/.exec(script)?.[1] : undefined;
  if (target !== undefined && !repo.exists(target)) report.problem({ file: target, rule: 'new-game-script', message: 'the root script "new-game" runs a file that does not exist', fix: `Copy templates/tooling/new-game.ts from this skill to ${target}: it forwards npm run new-game -- --app <id> to scaffold-game.mjs.` });
}

export function checkFiles(repo, id, report) {
  for (const rel of SCAFFOLD_FILES) {
    if (!repo.exists(`apps/${id}/${rel}`)) report.problem({ file: `apps/${id}/${rel}`, rule: 'app-file-missing', message: 'scaffold file is missing', fix: `Run node <this skill>/scripts/scaffold-game.mjs --app ${id} --add-missing: it writes only the absent files and keeps every existing one (add --name "<Name>" for a game outside the copy deck).` });
  }
}

export function checkPackage(repo, id, report) {
  const rel = `apps/${id}/package.json`;
  const manifest = readJson(repo, rel);
  if (manifest === undefined) {
    if (repo.exists(rel)) report.problem({ file: rel, rule: 'package-json', message: 'is not valid JSON', fix: 'Restore it from the scaffold.' });
    return;
  }
  const expected = { name: `@e07/${id}`, private: true, main: 'index.ts' };
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) report.problem({ file: rel, rule: 'package-json', message: `"${key}" is ${JSON.stringify(manifest[key])}, expected ${JSON.stringify(value)}`, fix: 'Keep the scaffold values: the workspace name, private, and the index.ts entry.' });
  }
  if (JSON.stringify(manifest.exports) !== JSON.stringify({ './*': './src/*' })) report.problem({ file: rel, rule: 'package-json', message: 'the exports map is not { "./*": "./src/*" }', fix: 'Game code reaches its own folders as @e07/<id>/<path under src>.ts through this map.' });
  if ('type' in manifest) report.problem({ file: rel, rule: 'package-json', message: 'apps have no "type" field (metro.config.js is CommonJS)', fix: 'Remove "type" from the app package.json.' });
  const others = existingApps(repo.root, id);
  const mine = JSON.stringify(Object.fromEntries(Object.entries(manifest.dependencies ?? {}).sort()));
  for (const other of others) {
    if (JSON.stringify(other.dependencies) !== mine) {
      report.problem({ file: rel, rule: 'deps-lockstep', message: `dependencies differ from apps/${other.id}/package.json`, fix: 'Every app lists the same packages at the same versions (native modules autolink per app); install or upgrade in all apps together (dependency-management).' });
      break;
    }
  }
}

export function checkConfigFiles(repo, id, report) {
  const tsconfig = readJson(repo, `apps/${id}/tsconfig.json`);
  if (tsconfig !== undefined) {
    const include = tsconfig.include ?? [];
    const ok = tsconfig.extends === BASE_TSCONFIG && ['index.ts', 'game.config.ts', 'src/**/*'].every((entry) => include.includes(entry));
    if (!ok) report.problem({ file: `apps/${id}/tsconfig.json`, rule: 'tsconfig', message: `does not extend ${BASE_TSCONFIG} or include index.ts, game.config.ts and src/**/*`, fix: 'Restore the scaffold tsconfig.json.' });
  }
  const metro = textOf(repo, `apps/${id}/metro.config.js`);
  if (repo.exists(`apps/${id}/metro.config.js`) && !/config\.cacheVersion\s*=.*EXPO_PUBLIC_APP_VARIANT/.test(metro)) report.problem({ file: `apps/${id}/metro.config.js`, rule: 'metro-cache', message: 'Metro\'s cache is not keyed on EXPO_PUBLIC_APP_VARIANT', fix: 'Without it a store build can reuse test-build transforms and ship the debug menu; restore the scaffold file.' });
  const appConfig = code(textOf(repo, `apps/${id}/app.config.ts`));
  if (repo.exists(`apps/${id}/app.config.ts`)) {
    const ok = /from\s+'@e07\/shell\/config\/with-shell\.ts'/.test(appConfig) && /from\s+'\.\/game\.config\.ts'/.test(appConfig) && /export\s+default\s+withShell\(gameConfig,\s*process\.env\);/.test(appConfig);
    if (!ok) report.problem({ file: `apps/${id}/app.config.ts`, rule: 'app-config', message: 'is not the one statement export default withShell(gameConfig, process.env) with .ts imports', fix: 'Every native setting comes from withShell and config plugins; restore the scaffold file.' });
  }
  const gitignore = textOf(repo, `apps/${id}/.gitignore`);
  if (repo.exists(`apps/${id}/.gitignore`) && !(/^ios\/$/m.test(gitignore) && /^android\/$/m.test(gitignore))) report.problem({ file: `apps/${id}/.gitignore`, rule: 'gitignore', message: 'does not ignore the generated ios/ and android/ folders', fix: 'Restore the scaffold .gitignore (prebuild regenerates both folders).' });
}

export function checkEntry(repo, id, stage, report) {
  const rel = `apps/${id}/index.ts`;
  if (!repo.exists(rel)) return;
  const text = code(textOf(repo, rel));
  const { camel } = idForms(id);
  // The whole file (comments masked) is the three statements: anything else is logic in the entry.
  const isEntry = new RegExp(`^\\s*import\\s+\\{\\s*startShell\\s*\\}\\s+from\\s+'@e07/shell/app/start-shell\\.ts';\\s+import\\s+\\{\\s*${camel}Game\\s*\\}\\s+from\\s+'\\./src/index\\.ts';\\s+startShell\\(${camel}Game\\);\\s*$`).test(text);
  const isPlaceholder = /registerRootComponent\(/.test(text) && !/src\/index\.ts/.test(text);
  if (stage === 'complete' && !isEntry) report.problem({ file: rel, line: 1, rule: 'entry', message: `is not exactly the 3-line entry startShell(${camel}Game)`, fix: `import { startShell } from '@e07/shell/app/start-shell.ts'; import { ${camel}Game } from './src/index.ts'; startShell(${camel}Game);` });
  if (stage === 'scaffold' && !isEntry && !isPlaceholder) report.problem({ file: rel, line: 1, rule: 'entry', message: 'is neither the scaffold placeholder nor the 3-line startShell entry', fix: 'Keep the placeholder until src/index.ts is assembled, then switch to the 3-line entry.' });
}

export function checkFonts(repo, id, skillDir, report) {
  for (const font of FONT_FILES) {
    const rel = `apps/${id}/assets/fonts/${font}`;
    if (!repo.exists(rel)) {
      report.problem({ file: rel, rule: 'fonts', message: 'font or licence file is missing', fix: `Run node <this skill>/scripts/scaffold-game.mjs --app ${id} --add-missing (it copies the five Toybox TTFs and three OFL texts byte for byte and keeps every existing file).` });
      continue;
    }
    const want = createHash('sha256').update(readFileSync(join(skillDir, 'assets', 'fonts', font))).digest('hex');
    const have = createHash('sha256').update(readFileSync(join(repo.root, rel))).digest('hex');
    if (want !== have) report.problem({ file: rel, rule: 'fonts', message: 'differs from the Toybox font file (sha256)', fix: 'Copy it byte for byte from this skill\'s assets/fonts/; a different file changes the look and the licence list.' });
  }
}

/** Reads and checks the four catalogs; returns { en, de, fa, ckb } (missing ones as {}). */
export function checkCatalogs(repo, id, report) {
  const catalogs = {};
  for (const lang of LANGUAGES) {
    const rel = `apps/${id}/src/i18n/${lang}.json`;
    const catalog = repo.exists(rel) ? readJson(repo, rel) : {};
    const isFlat = catalog !== null && typeof catalog === 'object' && !Array.isArray(catalog) && Object.values(catalog).every((value) => typeof value === 'string' && value.trim() !== '');
    if (!isFlat) report.problem({ file: rel, rule: 'catalogs', message: 'is not a flat JSON object of non-empty strings', fix: 'Catalogs are flat: key -> ICU message, no nesting, no empty texts.' });
    catalogs[lang] = isFlat ? catalog : {};
    const keys = Object.keys(catalogs[lang]);
    for (const key of keys.filter((item) => !item.startsWith(`${id}.`))) report.problem({ file: rel, rule: 'catalogs', message: `key "${key}" does not start with "${id}."`, fix: 'Game keys start with the game id; Shell texts live in the Shell catalogs.' });
    if (JSON.stringify(keys) !== JSON.stringify([...keys].sort())) report.problem({ file: rel, rule: 'catalogs', message: 'keys are not sorted', fix: 'Sort the keys (JavaScript default sort) so diffs stay small.' });
    if (repo.exists(rel) && !(`${id}.name` in catalogs[lang])) report.problem({ file: rel, rule: 'catalogs', message: `has no "${id}.name"`, fix: 'identity.nameId points at <id>.name in all four catalogs.' });
  }
  const english = Object.keys(catalogs.en ?? {}).sort().join('\n');
  for (const lang of LANGUAGES.slice(1)) {
    if (Object.keys(catalogs[lang]).sort().join('\n') !== english) report.problem({ file: `apps/${id}/src/i18n/${lang}.json`, rule: 'catalog-keys', message: 'does not have exactly the keys of en.json', fix: 'Every key exists in en, de, fa and ckb (English is the source); translate with the i18n workflow.' });
  }
  return catalogs;
}

/**
 * A game in the copy deck shows the deck's words: every deck text its catalogs hold (the scaffold
 * renders them from the deck) is the deck's text in that language. The deck changes (the Line Siege
 * march text did on 2026-09-30), and a catalog that kept the old words contradicts the design and the
 * rules.
 * Keys the catalogs lack are catalog-missing-key's and the i18n checks' business, not this rule's.
 */
export function checkDeckTexts(repo, id, catalogs, deck, report) {
  const slug = DECK_LOSE_SLUGS[id];
  const entries = slug ? deckEntries(deck, id, slug) : null;
  if (!entries) return;
  for (const lang of LANGUAGES) {
    const rel = `apps/${id}/src/i18n/${lang}.json`;
    const text = repo.exists(rel) ? readFileSync(join(repo.root, rel), 'utf8') : '';
    for (const { key, texts } of entries) {
      const have = catalogs[lang]?.[key];
      if (have === undefined || have === texts[lang]) continue;
      const at = text.indexOf(`"${key}"`);
      report.problem({ file: rel, line: at < 0 ? 1 : lineOf(text, at), rule: 'deck-text', message: `${key} is ${JSON.stringify(have)}, but the copy deck says ${JSON.stringify(texts[lang])}`, fix: id === 'line-siege' ? 'Copy the canonical Line Siege catalogs again (node <this skill>/scripts/scaffold-game.mjs --app line-siege shows them; they carry the deck\'s words), or write the deck\'s text into this key.' : 'Write the deck\'s text into this key in every language (the deck is the design\'s copy; a change of words goes through the owner and the deck, never the catalog alone).' });
    }
  }
}

/**
 * The placeholders the Pocket Arcade app templates define: the game id forms every game skill uses,
 * the scaffold's own settings, and the few per-game values other templates leave to fill. Only
 * these count: __DEV__, __OBJC__, __LINE__ and friends are platform identifiers, not placeholders.
 */
export const TEMPLATE_PLACEHOLDER = /__(?:GAME_(?:ID|PASCAL|CAMEL|CONST|NAME)|APP_ID|APP_NAME(?:_FA|_CKB)?|BUNDLE_ID|NAME_(?:EN|DE|FA|CKB)|MODE_(?:DAILY|ENDLESS)|HINTS_FREE_PER_DAY|IS_CONTINUE_ALLOWED|VIOLENCE_RATING|LOSE_SLUG|DAILY_SALT|DAILY_DIFFICULTY|MAX_DIFFICULTY|PIECE_COLOR_\d+|ADMOB_[A-Z_]+|PRIVACY_HOST|SUPPORT_EMAIL|PRODUCT_ID)__/;

/** The app's own files: generated native projects, build output, Pods and node_modules are skipped. */
export function appSourceFiles(repo, id) {
  const dir = join(repo.root, 'apps', id);
  return existsSync(dir) ? walk(dir, { ignore: [...REPO_SCAN_IGNORES, 'assets/**'] }) : [];
}

export function checkPlaceholders(repo, id, report) {
  for (const rel of appSourceFiles(repo, id)) {
    const text = readText(join(repo.root, 'apps', id, rel));
    if (text === null) continue;
    const match = TEMPLATE_PLACEHOLDER.exec(text);
    if (match) report.problem({ file: `apps/${id}/${rel}`, line: text.slice(0, match.index).split('\n').length, rule: 'placeholder-left', message: `template placeholder ${match[0]} was not replaced`, fix: 'Fill it (game id forms, names, bundle id, the game settings) or rerun the scaffold on a fresh folder.' });
  }
}

/** A Shell slice (shell-slice.json) is for building and parity work; it never ships (stage complete). */
export function checkShellSlice(repo, report) {
  const slice = readShellSlice(repo.root);
  if (slice !== null) report.problem({ file: slice.file, rule: 'shell-slice', message: `the repo declares a partial Shell (${slice.screens.size === 0 ? 'no Shell app' : [...slice.screens].join(', ')}: ${slice.why}); a slice never ships`, fix: 'Build every Shell screen, route each to its real screen instead of NotBuiltScreen, then delete shell-slice.json.' });
}

/** Loads game.config.ts with Node's type stripping and checks the spec 11 fields. */
export async function checkGameConfig(modules, repo, id, stage, report) {
  const rel = `apps/${id}/game.config.ts`;
  if (!repo.exists(rel)) return null;
  let config;
  try {
    config = (await modules.load(rel)).gameConfig;
  } catch (error) {
    report.problem({ file: rel, rule: 'game-config', message: `cannot be loaded: ${errorText(error)}`, fix: 'game.config.ts imports only the GameConfig type and exports const gameConfig.' });
    return null;
  }
  const problems = gameConfigProblems(config, id, stage);
  const text = readText(join(repo.root, rel)) ?? '';
  for (const [message, fix, rule = 'game-config', field] of problems) {
    const at = field === undefined ? -1 : text.indexOf(`${field.split('.').at(-1)}:`);
    report.problem({ file: rel, line: at < 0 ? undefined : lineOf(text, at), rule, message, fix });
  }
  return problems.length === 0 || config ? config : null;
}

function isCount(value, min = 0) {
  return Number.isInteger(value) && value >= min;
}

export function gameConfigProblems(config, id, stage) {
  if (!config || typeof config !== 'object') return [['exports no gameConfig object', 'export const gameConfig: GameConfig = { ... }']];
  const problems = [];
  const need = (isOk, message, fix, rule, field) => { if (!isOk) problems.push([message, fix, rule, field]); };
  need(config.id === id, `id is "${config.id}", the folder is apps/${id}`, 'GameConfig.id equals the folder name, identity.id and the save document\'s gameId.');
  need(LANGUAGES.every((lang) => typeof config.appName?.[lang] === 'string' && config.appName[lang].trim() !== ''), 'appName needs en, de, fa and ckb', 'Give the display name in all four languages (Latin script is fine for fa and ckb; native-speaker review later).');
  const bundleId = bundleIdFor(id);
  need(config.bundleId === bundleId, `bundleId "${config.bundleId}" is not ${bundleId}`, `Every app's iOS bundle id and Android package is ${BUNDLE_PREFIX}<game id without hyphens>, all lowercase (owner decision O4): write bundleId: '${bundleId}'.`, 'bundle-id', 'bundleId');
  need(config.appStoreId === null || /^\d+$/.test(String(config.appStoreId)), 'appStoreId is neither null nor the numeric App Store id', 'Keep null until the App Store Connect record exists (step G2).');
  need(/^\d+\.\d+\.\d+$/.test(String(config.version)) && isCount(config.buildNumber, 1), 'version must be MAJOR.MINOR.PATCH and buildNumber a whole number >= 1', 'Start at 1.0.0 and build 1; only the release pipeline bumps buildNumber.');
  need(config.premium?.productId === premiumIdFor(id), `premium.productId "${config.premium?.productId}" is not ${premiumIdFor(id)}`, `The game's one Premium product is <bundle id>.premium: write productId: '${premiumIdFor(id)}'.`, 'premium-id', 'productId');
  need(isCount(config.levels?.packCount, 1) && isCount(config.levels?.levelsPerPack, 1), 'levels.packCount and levels.levelsPerPack must be whole numbers >= 1', 'Default: 3 packs x 30 levels (decision D9).');
  need(typeof config.modes?.daily === 'boolean' && typeof config.modes?.endless === 'boolean', 'modes.daily and modes.endless must be booleans', 'Daily is on by default; endless only for games without a natural end.');
  need(isCount(config.hints?.freePerDay, 0) && typeof config.isContinueAllowed === 'boolean', 'hints.freePerDay (whole number) and isContinueAllowed (boolean) are required', 'From the game\'s rules: hints.freePerDay 0 without a solver hint (1 with one), isContinueAllowed true exactly when rules.continueRun is once (scaffold-game.mjs --hints and --continue).');
  const privacy = config.links?.privacyPolicy;
  need(typeof privacy?.host === 'string' && !privacy.host.includes('://') && typeof privacy?.path === 'string' && privacy.path.startsWith('/'), 'links.privacyPolicy must be { host, path } without a scheme', 'App code holds no URL literals; the Shell composes https://<host><path>.');
  need(typeof config.links?.supportEmail === 'string' && config.links.supportEmail.includes('@'), 'links.supportEmail is not an e-mail address', 'Use the support address the owner gives.');
  need(['general', 'children'].includes(config.store?.audience), 'store.audience must be general or children', 'Default: general (decision D8).');
  need(config.ads?.isEnabled !== undefined && isCount(config.ads?.policy?.minMsBetweenInterstitials, 0), 'ads.isEnabled and ads.policy are required', 'Keep the scaffold ad policy (3 levels first, 3 minutes and 2 levels between interstitials).');
  if (stage === 'complete') for (const [field, value] of ownerFields(config)) for (const entry of placeholdersIn(value)) need(false, `${field} is still the scaffold placeholder ${entry.value}`, `Replace it with ${entry.step}; a finished app and every store build carry the owner's real value (the ship gates reject the same list).`, 'owner-placeholder', field);
  return problems;
}

/** The game.config.ts values an owner step replaces: [field, value]. AdMob ids only while ads are on. */
function ownerFields(config) {
  const units = config.ads?.ids?.ios?.units ?? {};
  const android = config.ads?.ids?.android ?? null;
  return [
    ['bundleId', config.bundleId],
    ['premium.productId', config.premium?.productId],
    ...(config.ads?.isEnabled === false ? [] : [
      ['ads.ids.ios.appId', config.ads?.ids?.ios?.appId],
      ...Object.entries(units).map(([slot, value]) => [`ads.ids.ios.units.${slot}`, value]),
      ...(android === null ? [] : [['ads.ids.android.appId', android.appId], ...Object.entries(android.units ?? {}).map(([slot, value]) => [`ads.ids.android.units.${slot}`, value])]),
    ]),
    ['links.privacyPolicy.host', config.links?.privacyPolicy?.host],
    ['links.supportEmail', config.links?.supportEmail],
  ];
}

const WIN_LINES = ['moves', 'score'];

/**
 * Stage complete: the game's entry in parity/game-facts.json, which picks the Toybox reference
 * variants for the Shell frames (toybox-visual-parity): designGame, hasMusic, winLine and hasHints.
 * hasHints is knowable here: a game has a hint exactly when a solver proves the next move, which is
 * when game.config.ts gives free hints (hints.freePerDay 0 with no solver means hasHints false).
 */
export function checkParityFacts(repo, id, config, report) {
  const rel = 'parity/game-facts.json';
  const handOff = `Add "${id}": { "designGame", "hasMusic", "winLine", "hasHints" } to parity/game-facts.json and copy the parity pin test (toybox-visual-parity: templates/parity/game-facts.json and templates/apps/__GAME_ID__/src/parity-game-facts.test.ts).`;
  if (!repo.exists(rel)) return report.problem({ file: rel, rule: 'parity-game-facts', message: 'does not exist, so no Shell frame can pick its reference for this game', fix: handOff });
  const facts = readJson(repo, rel);
  const entry = facts?.games?.[id];
  const text = readText(join(repo.root, rel)) ?? '';
  const line = Math.max(1, lineOf(text, Math.max(0, text.indexOf(`"${id}"`))));
  if (entry === undefined || entry === null || typeof entry !== 'object') return report.problem({ file: rel, line: 1, rule: 'parity-game-facts', message: facts === undefined ? 'is not valid JSON' : `has no entry for ${id}`, fix: handOff });
  const wrong = [];
  if (typeof entry.designGame !== 'string' || entry.designGame === '') wrong.push('designGame is not a design game key (the Line Siege frames: "lineSiege")');
  if (typeof entry.hasMusic !== 'boolean') wrong.push('hasMusic is not true or false (true when the sound bank has a music sound)');
  if (!WIN_LINES.includes(entry.winLine)) wrong.push('winLine is not "moves" or "score" (the stars rule: moves against par, or a score)');
  if (typeof entry.hasHints !== 'boolean') wrong.push('hasHints is not true or false (true exactly when rules.hints.kind is \'solver\')');
  const freePerDay = config?.hints?.freePerDay;
  if (typeof entry.hasHints === 'boolean' && Number.isInteger(freePerDay) && entry.hasHints !== freePerDay > 0) wrong.push(`hasHints is ${entry.hasHints}, but game.config.ts gives ${freePerDay} free hints a day (${freePerDay > 0 ? 'a solver hint: hasHints true' : 'no solver hint: hasHints false'})`);
  for (const message of wrong) report.problem({ file: rel, line, rule: 'parity-game-facts', message: `${id}: ${message}`, fix: 'Set the entry to the game\'s facts; the parity pin test apps/<id>/src/parity-game-facts.test.ts holds the same values (toybox-visual-parity).' });
}

/** Stage complete: every module part and evidence file exists. */
export function checkCompleteness(repo, id, report) {
  for (const part of moduleParts(id)) {
    if (!part.any.some((rel) => repo.exists(`apps/${id}/${rel}`))) report.problem({ file: `apps/${id}/${part.any[0]}`, rule: 'module-part-missing', message: `${part.part} is missing`, fix: `Build it with the ${part.skill} skill (accepted file: ${part.any.join(' or ')}).` });
  }
  for (const part of evidenceParts(id)) {
    if (!part.test(repo)) report.problem({ file: part.where, rule: 'evidence-missing', message: `${part.part} are missing`, fix: `Add them with the ${part.skill} skill.` });
  }
}

const MEMBERS = ['identity', 'engine', 'rules', 'levels', 'presentation', 'realtime', 'teaching', 'stats', 'texts', 'testing', 'persistence'];

export function checkAssembly(repo, id, report) {
  const rel = `apps/${id}/src/index.ts`;
  if (!repo.exists(rel)) return;
  const text = code(textOf(repo, rel));
  const { camel, pascal } = idForms(id);
  if (!new RegExp(`export\\s+const\\s+${camel}Game\\s*:\\s*ShellGameModule<${pascal}Types>`).test(text)) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `does not export ${camel}Game: ShellGameModule<${pascal}Types>`, fix: 'Assemble the module as the one typed export the entry file starts.' });
  for (const member of MEMBERS.filter((name) => !new RegExp(`\\b${name}\\s*:`).test(text))) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `member ${member} is not assembled`, fix: 'The module lists all eleven GameModule members (realtime: null for turn-based games).' });
  for (const member of ['board', 'art', 'sounds', 'palette'].filter((name) => !new RegExp(`\\b${name}\\s*[:,]`).test(text))) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `presentation.${member} is not assembled`, fix: 'presentation holds board, art, sounds and palette.' });
  if (!new RegExp(`id:\\s*'${id}'`).test(text)) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `identity.id is not '${id}'`, fix: `identity: { id: '${id}', nameId: '${id}.name', winTitleId: '${id}.win-title', taglineId: '${id}.tagline' }` });
  if (!new RegExp(`winTitleId:\\s*'${id}\\.win-title'`).test(text)) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `identity.winTitleId is not '${id}.win-title'`, fix: `The S7 win title is identity.winTitleId: '${id}.win-title', in all four catalogs (the copy deck has it for the designed games).` });
  if (!new RegExp(`taglineId:\\s*'${id}\\.tagline'`).test(text)) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: `identity.taglineId is not '${id}.tagline'`, fix: `The line under the name on S1, S4 and S11b is identity.taglineId: '${id}.tagline', in all four catalogs (the copy deck has it for the designed games).` });
  if (!LANGUAGES.every((lang) => new RegExp(`\\b${lang}\\b`).test(text))) report.problem({ file: rel, line: 1, rule: 'module-assembly', message: 'texts do not include en, de, fa and ckb', fix: 'texts: { en, de, fa, ckb } from src/i18n/*.json.' });
  const bag = `apps/${id}/src/${id}-types.ts`;
  if (repo.exists(bag)) {
    const bagText = code(textOf(repo, bag));
    const missing = ['state', 'move', 'event', 'view', 'token', 'sim'].filter((key) => !new RegExp(`readonly\\s+${key}\\s*:`).test(bagText));
    if (!new RegExp(`export\\s+type\\s+${pascal}Types\\b`).test(bagText) || missing.length > 0) report.problem({ file: bag, line: 1, rule: 'types-bag', message: `does not declare ${pascal}Types with state, move, event, view, token and sim${missing.length ? ` (missing ${missing.join(', ')})` : ''}`, fix: 'The ShellGameTypes bag names the game\'s types once (sim: never for turn-based games).' });
  }
}

/**
 * Every '<id>.*' key literal in the game's source exists in all four catalogs: at stage scaffold the
 * keys of the templates already copied (rules, board, levels, teaching), at stage complete all.
 */
export function checkUsedKeys(repo, id, catalogs, report) {
  const pattern = new RegExp(`['"\`](${id.replace(/-/g, '\\-')}\\.[a-z0-9-]+(?:\\.[a-z0-9-]+){0,3})['"\`]`, 'g');
  for (const rel of repo.files(`apps/${id}/src`).filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))) {
    const text = code(textOf(repo, `apps/${id}/src/${rel}`));
    for (const match of text.matchAll(pattern)) {
      const missing = LANGUAGES.filter((lang) => !(match[1] in (catalogs[lang] ?? {})));
      if (missing.length > 0) report.problem({ file: `apps/${id}/src/${rel}`, rule: 'catalog-missing-key', message: `uses "${match[1]}", missing in ${missing.join(', ')}`, fix: 'Add the message to all four catalogs (English first; mark fa and ckb for native review).' });
    }
  }
}

/** Levels and rules agree with game.config.ts (the config part of the contract tests). */
export async function checkConfigContract(modules, repo, id, config, report) {
  if (config === null) return;
  const levelsRel = `apps/${id}/src/levels/${id}-levels.ts`;
  const engineRel = `apps/${id}/src/rules/${id}-engine.ts`;
  const load = async (rel) => {
    try {
      return repo.exists(rel) ? await modules.load(rel) : null;
    } catch (error) {
      report.problem({ file: rel, rule: 'config-contract', message: `cannot be loaded headless: ${errorText(error)}`, fix: 'Levels and rules must be pure; fix the import that pulls in React Native, Skia or the Shell.' });
      return null;
    }
  };
  const levels = Object.values((await load(levelsRel)) ?? {}).find((value) => value && typeof value === 'object' && Array.isArray(value.packs) && value.daily);
  const engineExports = Object.values((await load(engineRel)) ?? {});
  const rules = engineExports.find((value) => value && typeof value === 'object' && value.continueRun && value.undo);
  if (repo.exists(engineRel)) checkPanMode(engineRel, engineExports, report);
  if (levels) {
    const agree = (isOk, message) => { if (!isOk) report.problem({ file: levelsRel, rule: 'config-contract', message, fix: 'game.config.ts and the GameModule must agree (the config contract test).' }); };
    agree(levels.packs.length === config.levels.packCount, `${levels.packs.length} packs, game.config.ts says ${config.levels.packCount}`);
    agree(levels.packs.every((pack) => pack.levelCount === config.levels.levelsPerPack), `pack sizes differ from game.config.ts levelsPerPack ${config.levels.levelsPerPack}`);
    agree((levels.daily.kind === 'daily') === config.modes.daily, `levels.daily is ${levels.daily.kind}, game.config.ts modes.daily is ${config.modes.daily}`);
    agree((levels.endless.kind === 'endless') === config.modes.endless, `levels.endless is ${levels.endless.kind}, game.config.ts modes.endless is ${config.modes.endless}`);
  }
  if (rules && config.isContinueAllowed && rules.continueRun.kind !== 'once') report.problem({ file: engineRel, rule: 'config-contract', message: 'game.config.ts allows a continue but rules.continueRun is none', fix: 'Set isContinueAllowed: false, or give the game its one continue (spec 8.10).' });
}

const PAN_MODES = ['none', 'swipe', 'drag', 'aim'];

/** The engine states its board gesture (engine.panMode), the one the input design chose. */
function checkPanMode(engineRel, engineExports, report) {
  const engine = engineExports.find((value) => value && typeof value === 'object' && ('panMode' in value || typeof value.intentToMove === 'function'));
  const panMode = engine?.panMode;
  if (!PAN_MODES.includes(panMode)) report.problem({ file: engineRel, line: 1, rule: 'pan-mode', message: engine === undefined ? 'no engine object (with panMode) is exported' : `engine.panMode is ${JSON.stringify(panMode)}`, fix: `Set panMode in the engine assembly to ${PAN_MODES.join(', ')}: the board gesture the game's input uses (game-rules-engine, board-gestures-and-input).` });
}

export function listFiles(root) {
  return (rel) => (existsSync(join(root, rel)) ? walk(join(root, rel)) : []);
}

export function appIds(root) {
  const dir = join(root, 'apps');
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
}
