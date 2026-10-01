// app-plan.mjs: builds the file plan for a new apps/<game-id>/ from this skill's templates: the
// shared per-app files (package.json, game.config.ts, the placeholder entry, .gitignore, tsconfig,
// metro and app config), dependencies copied in lockstep from the existing apps, the catalogs and
// the Toybox fonts. The rendering itself lives in app-files.mjs, the file the monorepo bootstrap
// syncs too, so the pilot gets the same bytes from either skill. Not an entry point.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { catalogText, fillTemplate, FONT_FILES, gameCatalogs, LANGUAGES, PILOT, renderGameConfig, sortedObject } from './app-files.mjs';

export { BUNDLE_ID, BUNDLE_PREFIX, bundleIdFor, DECK_LOSE_SLUGS, DEFAULT_LOSE_SLUG, deckGame, FONT_FILES, GAME_ID, idForms, LANGUAGES, LOSE_SLUG, PILOT, PLACEHOLDERS, placeholdersIn, premiumIdFor, RESERVED_IDS, settingsProblems, suggestedSalt, VIOLENCE_RATINGS, withoutBundleIdOption } from './app-files.mjs';

/** Dependencies of every existing app (except `skip`), sorted, for the lockstep check. */
export function existingApps(root, skip) {
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== skip && existsSync(join(appsDir, entry.name, 'package.json')))
    .map((entry) => {
      const manifest = JSON.parse(readFileSync(join(appsDir, entry.name, 'package.json'), 'utf8'));
      return { id: entry.name, dependencies: sortedObject(manifest.dependencies ?? {}) };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The four catalogs: the pilot's canonical Line Siege set byte for byte, otherwise the copy deck's
 * texts (a designed game) or the template keys (any other game) through the shared renderer.
 */
function catalogFiles(input, app, read) {
  if (input.settings.gameId === PILOT.id) {
    return LANGUAGES.map((lang) => ({ rel: `${app}/src/i18n/${lang}.json`, content: readFileSync(join(input.skillDir, 'assets', 'line-siege-i18n', `${lang}.json`), 'utf8') }));
  }
  const templateCatalogs = Object.fromEntries(LANGUAGES.map((lang) => [lang, read(`src/i18n/${lang}.json`)]));
  const catalogs = gameCatalogs({ deck: input.deck, gameId: input.settings.gameId, names: input.settings.names, loseSlug: input.loseSlug, templateCatalogs });
  return LANGUAGES.map((lang) => ({ rel: `${app}/src/i18n/${lang}.json`, content: catalogText(catalogs[lang]) }));
}

/**
 * The files of apps/<id>/: [{ rel, content }] (content is a string, or a Buffer for fonts).
 * input = { skillDir, settings (app-files.mjs settingsProblems shape), loseSlug, dependencies, deck }
 * dependencies: the existing apps' set (lockstep), or null for the template's minimal pilot set.
 */
export function buildAppPlan(input) {
  const templates = join(input.skillDir, 'templates', 'app');
  const read = (rel) => readFileSync(join(templates, rel), 'utf8');
  const { gameId } = input.settings;
  const app = `apps/${gameId}`;
  const values = { __GAME_ID__: gameId };
  const manifest = JSON.parse(fillTemplate(read('package.json'), values));
  manifest.dependencies = sortedObject(input.dependencies ?? manifest.dependencies);
  const plan = [
    { rel: `${app}/package.json`, content: `${JSON.stringify(manifest, null, 2)}\n` },
    { rel: `${app}/tsconfig.json`, content: read('tsconfig.json') },
    { rel: `${app}/metro.config.js`, content: fillTemplate(read('metro.config.js'), values) },
    { rel: `${app}/app.config.ts`, content: fillTemplate(read('app.config.ts'), values) },
    { rel: `${app}/game.config.ts`, content: renderGameConfig(read('game.config.ts'), input.settings) },
    { rel: `${app}/index.ts`, content: fillTemplate(read('index.ts'), values) },
    { rel: `${app}/.gitignore`, content: read('dot-gitignore') },
    ...catalogFiles(input, app, read),
  ];
  for (const font of FONT_FILES) plan.push({ rel: `${app}/assets/fonts/${font}`, content: readFileSync(join(input.skillDir, 'assets', 'fonts', font)) });
  return plan;
}
