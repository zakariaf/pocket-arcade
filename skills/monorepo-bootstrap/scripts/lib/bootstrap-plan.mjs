// bootstrap-plan.mjs: turns this skill's templates into the list of files the monorepo needs.
// Shared by scaffold-monorepo.mjs (writes the files) and check-monorepo.mjs (checks a repo).
// Not an entry point: helpers only, no side effects on import.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUNDLE_PREFIX, bundleIdFor, FONT_FILES, LANGUAGES, PILOT, premiumIdFor, renderGameConfig } from './app-files.mjs';

export { bundleIdFor, premiumIdFor };

const HERE = dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = resolve(HERE, '..', '..');
export const TEMPLATES = join(SKILL_DIR, 'templates');
const ASSETS = join(SKILL_DIR, 'assets');
/** The canonical Line Siege catalogs (synced from the skill library): the pilot's src/i18n/. */
export const PILOT_CATALOGS = join(ASSETS, 'line-siege-i18n');

/** Template folders and where their files land in the repo. */
export const TEMPLATE_ROOTS = Object.freeze([
  { dir: join(TEMPLATES, 'repo'), to: '' },
  { dir: join(TEMPLATES, 'tooling-deps'), to: 'packages/tooling/' },
]);

export const BUNDLE_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
export const APP_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Top-level entries that belong to the monorepo itself. Anything else found at the root before
 * the bootstrap (knowledge folders, design exports, notes, the owner's README) is "pre-existing":
 * Prettier and ESLint must ignore it, because none of it is our code.
 */
export const MONOREPO_TOP_LEVEL = new Set([
  'apps', 'packages', 'test', '__mocks__', 'skills', 'node_modules', 'reports', 'tools', 'coverage',
  'dist-audit', 'parity', 'perf-baselines', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.base.json',
  'tsconfig.stryker.json', 'eslint.config.mjs', 'knip.json', 'lefthook.yml', 'quality-gates.json',
  'AGENTS.md', 'CLAUDE.md', 'babel.config.js', 'jest.config.js', 'jest.setup.ts', 'jest.sim.config.js',
  'stryker.config.json',
  // A partial Shell's declaration (quality-gates): part of the monorepo, formatted and checked.
  'shell-slice.json',
  // (perf-baselines above: the committed cold-start baselines e2e-maestro's runner writes on its first
  // run, perf-baselines/cold-start-sim-<game-id>.json; formatted JSON, part of the monorepo.)
]);

const toPosix = (path) => path.split(sep).join('/');

function listFiles(dir) {
  const out = [];
  const visit = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name === '.DS_Store') continue;
      const child = join(abs, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) out.push(toPosix(relative(dir, child)));
    }
  };
  if (existsSync(dir)) visit(dir);
  return out;
}

/** Template path -> repo path: "dot-x" segments become ".x", "__APP_ID__" the app id, ".tmpl" is dropped. */
export function mapTemplatePath(rel, vars) {
  return rel
    .split('/')
    .map((segment) => segment.replace(/^dot-/, '.').replace(/__APP_ID__/g, vars.appId).replace(/\.tmpl$/, ''))
    .join('/');
}

/** Top-level names at the root that are not part of the monorepo (hidden entries are skipped). */
export function preExistingEntries(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    // EXPECT.txt marks a self-test fixture; check-lib's walker skips it the same way.
    .filter((entry) => !entry.name.startsWith('.') && !MONOREPO_TOP_LEVEL.has(entry.name) && entry.name !== 'EXPECT.txt')
    .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** The dated bootstrap exclude block, or '' once its expiry date has passed. */
export function releaseAgeBlock(todayIso) {
  const text = readFileSync(join(TEMPLATES, 'npmrc-bootstrap-block.txt'), 'utf8').trimEnd();
  const expires = /expires=(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
  if (!expires) throw new Error('templates/npmrc-bootstrap-block.txt has no expires=YYYY-MM-DD header');
  return todayIso <= expires ? `\n${text}\n` : '';
}

export function validateVars(vars) {
  const problems = [];
  if (!APP_ID.test(vars.appId)) problems.push(`app id "${vars.appId}" is not kebab-case (for example line-siege)`);
  else if (vars.appId !== PILOT.id) problems.push(`the pilot app is ${PILOT.id} (Line Siege v1: its catalogs, modes, hints, continue and age rating are canonical), not "${vars.appId}"; bootstrap with --app ${PILOT.id}, then scaffold every other game with the new-game-scaffold skill`);
  if (vars.bundleId !== bundleIdFor(vars.appId)) problems.push(`bundle id "${vars.bundleId}" is not ${bundleIdFor(vars.appId)} (every app's id is ${BUNDLE_PREFIX}<game id without hyphens>, owner decision O4)`);
  for (const [label, value] of [['app name', vars.appName], ['fa name', vars.appNameFa], ['ckb name', vars.appNameCkb]]) {
    if (value !== null && (!value.trim() || /['\\]/.test(value))) problems.push(`${label} "${value}" must be non-empty without quotes or backslashes`);
  }
  if (!ISO_DATE.test(vars.today)) problems.push(`date "${vars.today}" is not YYYY-MM-DD`);
  return problems;
}

/** Default display name and the fixed bundle id (owner decision O4) of the app id (fa and ckb names: none yet). */
export function defaultVars(appId, today) {
  const appName = appId.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return { appId, appName, appNameFa: null, appNameCkb: null, bundleId: bundleIdFor(appId), today };
}

/** The pilot's game.config.ts settings (the shared renderer the new-game scaffold uses too). */
export function pilotSettings(vars) {
  return {
    gameId: vars.appId,
    bundleId: vars.bundleId,
    names: { en: vars.appName, de: vars.appName, fa: vars.appNameFa ?? vars.appName, ckb: vars.appNameCkb ?? vars.appName },
    modes: PILOT.modes,
    hints: PILOT.hints,
    continueRun: PILOT.continueRun,
    violence: PILOT.violence,
  };
}

/** Fill the placeholders of one template file. */
export function renderTemplate(repoRel, text, vars, preExisting) {
  if (repoRel === `apps/${vars.appId}/game.config.ts`) return renderGameConfig(text, pilotSettings(vars));
  let out = text
    .replace(/__APP_ID__/g, vars.appId)
    // Templates shared with the other app skills (metro.config.js, app.config.ts, quality-gates.json)
    // name the game __GAME_ID__; the pilot app is that game.
    .replace(/__GAME_ID__/g, vars.appId)
    .replace(/__BUNDLE_ID__/g, vars.bundleId);
  if (repoRel === '.npmrc') out = out.replace('__RELEASE_AGE_BOOTSTRAP_BLOCK__\n', releaseAgeBlock(vars.today));
  if (repoRel === '.prettierignore') {
    const lines = preExisting.map((entry) => (entry.isDir ? `${entry.name}/` : entry.name));
    out = out.replace('__PRE_EXISTING__\n', lines.length ? `${lines.join('\n')}\n` : '');
  }
  if (repoRel === 'eslint.config.mjs') {
    const globs = preExisting.map((entry) => `'${entry.isDir ? `${entry.name}/**` : entry.name}'`);
    out = out.replace('const PRE_EXISTING = [];', `const PRE_EXISTING = [${globs.join(', ')}];`);
  }
  return out;
}

/**
 * The pilot's files that are copied byte for byte: the five Toybox fonts with their three licence
 * texts, and the four canonical Line Siege catalogs (the new-game scaffold writes the same bytes).
 */
export function pilotAssetFiles(vars) {
  const app = `apps/${vars.appId}`;
  const fonts = FONT_FILES.map((font) => ({ rel: `${app}/assets/fonts/${font}`, content: readFileSync(join(ASSETS, 'fonts', font)) }));
  const catalogs = LANGUAGES.map((lang) => ({ rel: `${app}/src/i18n/${lang}.json`, content: readFileSync(join(PILOT_CATALOGS, `${lang}.json`), 'utf8') }));
  return [...fonts, ...catalogs];
}

/** Every file the bootstrap writes: [{ rel, content }] (a string, or a Buffer for fonts), rendered for this repo. */
export function renderedFiles(root, vars) {
  const preExisting = preExistingEntries(root);
  const files = [];
  for (const { dir, to } of TEMPLATE_ROOTS) {
    for (const rel of listFiles(dir)) {
      const repoRel = `${to}${mapTemplatePath(rel, vars)}`;
      files.push({ rel: repoRel, content: renderTemplate(repoRel, readFileSync(join(dir, rel), 'utf8'), vars, preExisting) });
    }
  }
  files.push(...pilotAssetFiles(vars));
  return files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/** True when the file at abs holds exactly this content (string or Buffer). */
export function sameContent(abs, content) {
  const current = readFileSync(abs);
  return Buffer.isBuffer(content) ? current.equals(content) : current.equals(Buffer.from(content, 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// Merges for files that may already exist at the root
// ---------------------------------------------------------------------------------------------

/** .gitignore: keep the existing lines, append the missing ones. */
export function mergeGitignore(existing, wanted) {
  const have = new Set(existing.split('\n').map((line) => line.trim()));
  const missing = wanted.split('\n').filter((line) => line.trim() && !have.has(line.trim()));
  if (missing.length === 0) return { content: existing, changed: false, conflicts: [] };
  const base = existing.endsWith('\n') || existing === '' ? existing : `${existing}\n`;
  return { content: `${base}${missing.join('\n')}\n`, changed: true, conflicts: [] };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * .claude/settings.json: keep every existing key (skill listing budget, other allow rules),
 * add the template's plugins, allow rules, deny and ask lists and hooks. The quality-gates guardrail
 * compares deny, ask and hooks exactly, so an existing different value is a conflict to resolve.
 */
export function mergeSettings(existingText, wantedText) {
  let existing;
  try {
    existing = JSON.parse(existingText);
  } catch (error) {
    return { content: existingText, changed: false, conflicts: [`is not valid JSON (${error.message})`] };
  }
  const wanted = JSON.parse(wantedText);
  const merged = { ...existing };
  const conflicts = [];
  merged.enabledPlugins = { ...(existing.enabledPlugins ?? {}), ...wanted.enabledPlugins };
  const permissions = { ...(existing.permissions ?? {}) };
  permissions.allow = [...new Set([...(permissions.allow ?? []), ...wanted.permissions.allow])];
  for (const key of ['deny', 'ask']) {
    const have = permissions[key];
    if (have !== undefined && !sameJson(have, wanted.permissions[key])) {
      const extra = have.filter((rule) => !wanted.permissions[key].includes(rule));
      if (extra.length) conflicts.push(`permissions.${key} has rules the gates do not list: ${extra.join(', ')}`);
    }
    permissions[key] = wanted.permissions[key];
  }
  merged.permissions = permissions;
  if (existing.hooks !== undefined && !sameJson(existing.hooks, wanted.hooks)) {
    conflicts.push('hooks differ from the Pocket Arcade hooks (PostToolUse after-edit, Stop check:fast)');
  }
  merged.hooks = wanted.hooks;
  const content = `${JSON.stringify(merged, null, 2)}\n`;
  return { content, changed: content !== existingText, conflicts };
}

/**
 * Root package.json: `npm approve-scripts` adds "allowScripts" after the first install. A manifest
 * that differs from the template only there is unchanged; any other difference is a conflict.
 */
export function mergeRootManifest(existingText, wantedText) {
  try {
    const { allowScripts, ...existing } = JSON.parse(existingText);
    const same = sameJson(existing, JSON.parse(wantedText));
    return { content: existingText, changed: false, conflicts: same ? [] : ['exists with different content (beyond the allowScripts approvals)'] };
  } catch (error) {
    return { content: existingText, changed: false, conflicts: [`is not valid JSON (${error.message})`] };
  }
}

/**
 * CLAUDE.md belongs to the owner and may carry project notes for Claude Code. The template's only
 * demand is the import line, so an existing file that has it is kept as it is, and one without it
 * gains it as its first line.
 */
export function mergeClaudeMd(existing, wanted) {
  const importLine = wanted.trim();
  if (existing.split('\n').some((line) => line.trim() === importLine)) return { content: existing, changed: false, conflicts: [], notes: [`kept: it already imports ${importLine}`] };
  return { content: `${importLine}\n\n${existing}`, changed: true, conflicts: [], notes: [`gains the ${importLine} import as its first line`] };
}

/** What would happen to each file: create, same, merge or conflict. */
export function buildPlan(root, vars) {
  return renderedFiles(root, vars).map(({ rel, content }) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return { rel, content, action: 'create', notes: [] };
    if (!statSync(abs).isFile()) return { rel, content, action: 'conflict', notes: ['exists and is not a file'] };
    if (sameContent(abs, content)) return { rel, content, action: 'same', notes: [] };
    if (Buffer.isBuffer(content)) return { rel, content, action: 'conflict', notes: ['exists with different bytes'] };
    const current = readFileSync(abs, 'utf8');
    const merge = rel === '.gitignore' ? mergeGitignore(current, content) : rel === '.claude/settings.json' ? mergeSettings(current, content) : rel === 'package.json' ? mergeRootManifest(current, content) : rel === 'CLAUDE.md' ? mergeClaudeMd(current, content) : null;
    if (merge === null) return { rel, content, action: 'conflict', notes: ['exists with different content'] };
    if (merge.conflicts.length) return { rel, content: merge.content, action: 'conflict', notes: merge.conflicts };
    return { rel, content: merge.content, action: merge.changed ? 'merge' : 'same', notes: merge.notes ?? [] };
  });
}
