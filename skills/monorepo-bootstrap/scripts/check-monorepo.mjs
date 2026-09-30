#!/usr/bin/env node
// check-monorepo.mjs: checks that a repo has the Pocket Arcade monorepo skeleton and that the
// policy parts of every config still match this skill's templates (layout, workspaces, pins,
// .npmrc, tsconfigs, ignores, gates, Claude Code settings, lockfile, install-script approvals).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-monorepo.mjs .

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FONT_FILES, LANGUAGES } from './lib/app-files.mjs';
import { BUNDLE_ID, TEMPLATES, preExistingEntries } from './lib/bootstrap-plan.mjs';
import { EXACT_VERSION, lineMatching, npmrcExcludeProblems, npmrcPolicyOverrides, readJsonFile, readTextFile, workspaceFolders } from './lib/repo-read.mjs';
import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-monorepo',
  summary: 'Checks the Pocket Arcade monorepo skeleton: every root file, the three packages and the apps, exact pins and one React, the .npmrc policy and dated excludes, strict tsconfigs, Prettier and ESLint ignores, quality-gates.json against the real configs, Claude Code settings, the committed lockfile and approved install scripts.',
  usage: '[repo-root] [options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'The repo root (same as the positional argument; default ".")' },
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'Date for the .npmrc exclude expiry check (default: today, UTC)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: root-file workspace-layout root-manifest root-scripts root-overrides pin-exact root-runtime',
    '  npmrc-policy npmrc-exclude node-pin gitignore prettier-config format-ignore lint-ignore tsconfig-base',
    '  tsconfig-workspace package-manifest app-manifest app-lockstep shell-peer shell-only banned app-files',
    '  app-config metro-cache game-config runtime-game-config shell-files tooling-files knip-config lefthook',
    '  quality-gates gate-scope stryker-config claude-settings agents lockfile install-scripts one-react',
    'Scripts whose tool file does not exist yet are listed as "pending" (not a failure).',
    'root-overrides covers one React, one typescript-eslint (the ten @typescript-eslint/* packages at the',
    'typescript-eslint pin) and every native "*" peer of the Shell at the version the apps install.',
    '',
    'Example: node check-monorepo.mjs .      (from the repo root)',
  ].join('\n'),
};

const ROOT_FILES = ['package.json', 'package-lock.json', '.npmrc', '.nvmrc', '.mise.toml', '.gitignore', '.prettierrc.json', '.prettierignore', 'tsconfig.base.json', 'tsconfig.json', 'tsconfig.stryker.json', 'eslint.config.mjs', 'knip.json', 'lefthook.yml', 'quality-gates.json', '.claude/settings.json', 'AGENTS.md', 'CLAUDE.md', 'babel.config.js', 'jest.config.js', 'jest.setup.ts', 'jest.sim.config.js', 'stryker.config.json'];
const PACKAGES = ['game-kit', 'shell', 'tooling'];
const APP_FILES = ['package.json', 'tsconfig.json', 'app.config.ts', 'game.config.ts', 'index.ts', 'metro.config.js', '.gitignore', ...LANGUAGES.map((lang) => `src/i18n/${lang}.json`), ...FONT_FILES.map((font) => `assets/fonts/${font}`)];
/** typescript-eslint's own packages: eslint-config-expo asks for ^8.59.0 of them, so they float without an override. */
const TS_ESLINT_PACKAGES = ['eslint-plugin', 'parser', 'project-service', 'scope-manager', 'tsconfig-utils', 'type-utils', 'types', 'typescript-estree', 'utils', 'visitor-keys'].map((name) => `@typescript-eslint/${name}`);
/** Paths into the Shell that every app program includes (two folders up, built from parts on purpose). */
const APP_INCLUDES = ['packages/shell/src/app-env.d.ts', 'packages/shell/src/navigation/react-navigation.d.ts'];
const SHELL_FILES = ['src/app-env.d.ts', 'src/config/with-shell.ts', 'src/config/game-config.ts', 'src/config/app-variant.ts', 'src/config/game-extra.ts', 'src/i18n/intl-polyfills.ts', 'plugins/with-app-variant-marker.ts'];
const TOOLING_FILES = ['src/quality/check-quality-gates.ts', 'src/quality/gate-diff.ts', 'src/quality/run-verify.ts', 'src/quality/verify-plan.ts', 'src/quality/shell-slice.ts', 'src/quality/device-only.ts', 'src/git/commit-trailer-rules.ts', 'src/deps/check-deps.ts', 'src/deps/release-age-excludes.ts', 'src/deps/banned-packages.ts', 'src/deps/app-lockstep.ts', 'src/clock/system-clock.ts', 'src/git/check-commit-message.ts', 'src/git/commit-message-rules.ts', 'src/hooks/after-edit.ts', 'src/audit/audit-licenses.ts', 'src/audit/license-policy.ts', 'src/scaffold/new-game.ts', 'license-exceptions.json'];
const SHELL_ONLY = /^(valibot|zustand|react-intl|@formatjs\/.+)$/;
const RUNTIME_AT_ROOT = /^(expo|expo-.+|react|react-native|react-native-.+|@shopify\/react-native-skia)$/;
const BANNED = [
  [/^(expo-router|react-dom|react-native-web)$/, 'Expo template leftover: the Shell owns one React Navigation stack and there is no web target'],
  [/^(babel-preset-expo|babel-plugin-react-compiler)$/, 'comes with expo; never add it directly'],
  [/^(expo-updates|expo-dev-client)$/, 'OTA updates and dev clients are network components (N3)'],
  [/^@react-native-community\/netinfo$/, 'its reachability probe calls Google (N3); use expo-network'],
  [/^expo-audio$/, 'adds microphone and background-audio keys; use react-native-audio-api'],
  [/^(react-native-purchases(-ui)?|react-native-iap)$/, 'purchases go through expo-iap on the device (N2)'],
  [/^(firebase|@react-native-firebase\/.+|@sentry\/.+|sentry-expo|@bugsnag\/.+|@datadog\/.+|expo-insights|expo-observe|expo-app-metrics|@amplitude\/.+|expo-analytics-amplitude|@segment\/.+)$/, 'a backend, analytics or crash service (N2)'],
  [/^expo-notifications$/, 'no push notifications'],
  [/^(react-native-webview|expo-web-browser)$/, 'web views are a network surface (N3)'],
  [/^expo-tracking-transparency$/, 'no ATT prompt in v1'],
  [/^react-native-restart$/, 'reloadAppAsync from expo covers restarts'],
  [/^eslint-plugin-react-compiler$/, 'superseded by eslint-plugin-react-hooks 7'],
  [/^(axios|ky|got|node-fetch|cross-fetch)$/, 'our code makes no HTTP requests (N3)'],
];
const PENDING_OWNER = { 'i18n:verify': 'i18n-strings-and-catalogs', 'audit:network': 'privacy-and-network-audit', 'audit:privacy': 'privacy-and-network-audit', 'e2e:ios': 'e2e-maestro', 'screenshots:ios': 'e2e-maestro', 'build:ios:sim': 'ios-simulator-build', 'release:ios': 'ios-release-testflight' };

const template = (rel) => readFileSync(join(TEMPLATES, 'repo', rel), 'utf8');
// The canonical root npm scripts, shared with the quality-gates skill (synced from the library).
const canonicalScripts = () => JSON.parse(readFileSync(join(TEMPLATES, 'package-scripts.json'), 'utf8'));
// Folders that hold skills and Claude Code files: no gate may reach into them through a wildcard.
const KNOWLEDGE_FOLDERS = ['skills', '.claude'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Paths inside the app repo, two folders up from a workspace (built from parts on purpose).
const UP2 = ['..', '..'].join('/');
const depsOf = (manifest) => ({ ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) });

function context(root, today) {
  const json = (rel, opts) => readJsonFile(join(root, rel), opts);
  const text = (rel) => readTextFile(join(root, rel));
  const apps = workspaceFolders(root, 'apps');
  const appManifests = new Map(apps.map((app) => [app, json(`apps/${app}/package.json`)]).filter(([, read]) => read.ok).map(([app, read]) => [app, read.value]));
  return { root, today, json, text, apps, appManifests, rootManifest: json('package.json').value ?? {} };
}

function checkFiles(ctx, add) {
  for (const rel of ROOT_FILES) if (!existsSync(join(ctx.root, rel))) add(rel, 0, 'root-file', 'is missing', 'Run scaffold-monorepo.mjs --root . --write (or copy the file from the templates).');
  for (const pkg of PACKAGES) {
    for (const file of ['package.json', 'tsconfig.json']) if (!existsSync(join(ctx.root, 'packages', pkg, file))) add(`packages/${pkg}/${file}`, 0, 'workspace-layout', 'is missing', 'Create the workspace from the templates.');
  }
  const extra = workspaceFolders(ctx.root, 'packages').filter((name) => !PACKAGES.includes(name));
  for (const name of extra) add(`packages/${name}/package.json`, 1, 'workspace-layout', 'is a fourth package; the repo has exactly game-kit, shell and tooling', 'Move the code into one of the three packages (the architecture-and-boundaries skill says where).');
  if (ctx.apps.length === 0) add('apps/', 0, 'workspace-layout', 'has no app workspace', 'Scaffold the pilot app (apps/<game-id>) with scaffold-monorepo.mjs.');
  for (const app of ctx.apps) {
    for (const file of APP_FILES) if (!existsSync(join(ctx.root, 'apps', app, file))) add(`apps/${app}/${file}`, 0, 'app-files', 'is missing', 'Rerun scaffold-monorepo.mjs --write for the pilot (it writes the .gitignore, the fonts and the four catalogs), or scaffold-game.mjs --add-missing of the new-game-scaffold skill for another game.');
  }
  for (const rel of SHELL_FILES) if (!existsSync(join(ctx.root, 'packages/shell', rel))) add(`packages/shell/${rel}`, 0, 'shell-files', 'is missing', 'Copy it from the templates; app.config.ts and Jest need it.');
  for (const rel of TOOLING_FILES) if (!existsSync(join(ctx.root, 'packages/tooling', rel))) add(`packages/tooling/${rel}`, 0, 'tooling-files', 'is missing: a gate, hook or npm script calls it', 'Copy it from the templates (the gates fail without it).');
}

function checkRootManifest(ctx, add) {
  const read = ctx.json('package.json');
  if (!read.ok) return read.error === 'missing' ? undefined : add('package.json', 1, 'root-manifest', read.error, 'Fix the JSON.');
  const pkg = read.value;
  const want = JSON.parse(template('package.json'));
  if (pkg.private !== true || !same(pkg.workspaces, want.workspaces)) add('package.json', 1, 'root-manifest', `must be private with workspaces ${JSON.stringify(want.workspaces)}`, 'Set "private": true and the two workspace globs.');
  if (!same(pkg.engines, want.engines)) add('package.json', 1, 'root-manifest', `engines must be ${JSON.stringify(want.engines)} (type stripping needs Node 22.18, dated excludes need npm 11.17)`, 'Copy "engines" from the template.');
  for (const [name, command] of Object.entries(canonicalScripts())) {
    if (pkg.scripts?.[name] !== command) add('package.json', 1, 'root-scripts', `script "${name}" ${pkg.scripts?.[name] === undefined ? 'is missing' : 'differs from the canonical command'}`, `Set it to: ${command}`);
  }
  for (const [name, version] of Object.entries(depsOf(pkg))) {
    if (!EXACT_VERSION.test(version)) add('package.json', 1, 'pin-exact', `${name} is pinned as "${version}", not an exact version`, `Pin it exactly (npm install -D ${name}@<version>; .npmrc save-exact=true).`);
    if (RUNTIME_AT_ROOT.test(name)) add('package.json', 1, 'root-runtime', `${name} is an app runtime package listed at the root`, 'Install it in every app (npx expo install inside apps/<game>); the root only pins react and react-native through "overrides".');
  }
  for (const name of ['react', 'react-native']) {
    const pinned = pkg.overrides?.[name];
    if (typeof pinned !== 'string' || !EXACT_VERSION.test(pinned)) add('package.json', 1, 'root-overrides', `overrides.${name} must be the exact version the apps use`, 'Add "overrides": { "react": "<x.y.z>", "react-native": "<x.y.z>" } (one React in the tree).');
    for (const [app, manifest] of ctx.appManifests) {
      const used = manifest.dependencies?.[name];
      if (pinned !== undefined && used !== undefined && used !== pinned) add('package.json', 1, 'root-overrides', `overrides.${name} is ${pinned} but apps/${app} uses ${used}`, 'Change both in the same commit; npm ls react react-native must show one version.');
    }
  }
  checkOneTypescriptEslint(pkg, add);
  checkPeerOverrides(ctx, pkg, add);
  for (const [script, owner] of Object.entries(PENDING_OWNER)) {
    const target = /^node (\S+\.ts)/.exec(pkg.scripts?.[script] ?? '')?.[1];
    if (target && !existsSync(join(ctx.root, target))) console.log(`pending  npm run ${script}: ${target} is built by the ${owner} skill`);
  }
}

/**
 * One typescript-eslint: eslint-config-expo asks for ^8.59.0 of the @typescript-eslint/* packages,
 * so a fresh install hoists the newest release next to typescript-eslint's own copy and every ESLint
 * run crashes with 'Cannot redefine plugin "@typescript-eslint"'. The root overrides pin all ten.
 */
function checkOneTypescriptEslint(pkg, add) {
  const pin = pkg.devDependencies?.['typescript-eslint'];
  if (pin === undefined) return;
  for (const name of TS_ESLINT_PACKAGES) {
    if (pkg.overrides?.[name] !== pin) add('package.json', 1, 'root-overrides', `overrides.${name} is ${pkg.overrides?.[name] ?? 'missing'}; one typescript-eslint means all ten @typescript-eslint/* packages at the typescript-eslint pin ${pin} (a newer copy crashes ESLint: Cannot redefine plugin "@typescript-eslint")`, `Set "${name}": "${pin}" in the root overrides (the template lists all ten), then npm install; npm ls ${name} must show one version.`);
  }
}

/** Lowest version of a specifier and whether an exact version lies in it (~x.y.z, ^x.y.z, x.y.z). */
function inRange(version, spec) {
  const want = String(spec).replace(/^[~^]/, '');
  const [major, minor, patch] = want.split('.').map(Number);
  const [gotMajor, gotMinor, gotPatch] = String(version).split('-')[0].split('.').map(Number);
  const atLeast = gotMajor > major || (gotMajor === major && (gotMinor > minor || (gotMinor === minor && gotPatch >= patch)));
  if (String(spec).startsWith('~')) return gotMajor === major && gotMinor === minor && atLeast;
  if (String(spec).startsWith('^')) return gotMajor === major && atLeast;
  return version === want;
}

/**
 * Every native "*" peer of the Shell is pinned in the root overrides at the version the apps install:
 * otherwise npm resolves the peer on its own and puts its newest release at the root next to the
 * apps' copy (react-native-screens 4.28.0 next to 4.26.2: duplicate native modules).
 */
function checkPeerOverrides(ctx, pkg, add) {
  const peers = Object.keys(ctx.json('packages/shell/package.json').value?.peerDependencies ?? {}).filter((name) => !['react', 'react-native'].includes(name));
  for (const name of peers) {
    const specs = [...ctx.appManifests.values()].map((manifest) => manifest.dependencies?.[name]).filter(Boolean);
    if (specs.length === 0) continue;
    const pinned = pkg.overrides?.[name];
    if (typeof pinned !== 'string' || !EXACT_VERSION.test(pinned) || !specs.every((spec) => inRange(pinned, spec))) add('package.json', 1, 'root-overrides', `overrides.${name} is ${pinned ?? 'missing'}; the Shell's "*" peer must be pinned at the exact version the apps install for "${specs[0]}"`, `Set "${name}": "<the version npm ls ${name} shows for the apps>" in the root overrides, then npm install (the dependency-management skill's plan-dependency.mjs prints it).`);
  }
}

function checkNpmrcAndNode(ctx, add) {
  const npmrc = ctx.text('.npmrc');
  if (npmrc !== null) {
    for (const line of ['min-release-age=7', 'engine-strict=true', 'save-exact=true']) if (!npmrc.split('\n').includes(line)) add('.npmrc', 1, 'npmrc-policy', `lacks the line ${line}`, 'Restore the three policy lines (quality-gates.json checks them too).');
    for (const hit of npmrcPolicyOverrides(npmrc)) add('.npmrc', hit.line, 'npmrc-policy', `sets ${hit.key}=${hit.value}; npm keeps the last value of a key, so this switches the policy ${hit.key}=${hit.want} off`, `Delete the line; the policy stays ${hit.key}=${hit.want} (a young release needs a dated exclude block instead).`);
    for (const hit of npmrcExcludeProblems(npmrc, ctx.today)) {
      add('.npmrc', hit.line, 'npmrc-exclude', hit.kind === 'expired' ? `exclude ${hit.pattern} is in a block that expired on ${hit.expires}` : `exclude ${hit.pattern} is not inside a dated "# exclude-block expires=YYYY-MM-DD reason=..." block`, hit.kind === 'expired' ? 'Delete the whole expired block (never extend it); the lockfile keeps the installed versions.' : 'Put it under a dated block header with the reason, or remove it.');
    }
  }
  const nvmrc = ctx.text('.nvmrc')?.trim();
  const mise = /^node\s*=\s*"([^"]+)"/m.exec(ctx.text('.mise.toml') ?? '')?.[1];
  if (nvmrc !== undefined && mise !== undefined && nvmrc !== mise) add('.nvmrc', 1, 'node-pin', `.nvmrc says ${nvmrc} but .mise.toml says ${mise}`, 'Pin the same Node version in both files.');
  const major = Number((nvmrc ?? mise ?? '').split('.')[0]);
  if ((nvmrc !== undefined || mise !== undefined) && !(major >= 22)) add('.nvmrc', 1, 'node-pin', `Node "${nvmrc ?? mise}" is below 22.18 (app.config.ts needs type stripping)`, 'Pin Node 26.4.0 (or the newest 26.x LTS that is at least 7 days old).');
}

function checkIgnoresAndFormat(ctx, add) {
  const gitignore = ctx.text('.gitignore');
  if (gitignore !== null) {
    const have = new Set(gitignore.split('\n').map((line) => line.trim()));
    for (const line of template('dot-gitignore').split('\n').filter(Boolean)) if (!have.has(line)) add('.gitignore', 1, 'gitignore', `lacks "${line}"`, 'Append the missing line (generated folders, signing files and keys never reach git).');
  }
  const prettierrc = ctx.json('.prettierrc.json');
  if (prettierrc.ok) {
    const want = JSON.parse(template('dot-prettierrc.json'));
    for (const [key, value] of Object.entries(want)) if (key !== '$schema' && !same(prettierrc.value[key], value)) add('.prettierrc.json', 1, 'prettier-config', `${key} must be ${JSON.stringify(value)}`, 'Restore the house Prettier options.');
  }
  const prettierignore = ctx.text('.prettierignore');
  const eslint = ctx.text('eslint.config.mjs');
  const ignoreLines = new Set((prettierignore ?? '').split('\n').map((line) => line.trim()));
  if (prettierignore !== null) for (const line of ['package-lock.json', 'skills/', '.claude/']) if (!ignoreLines.has(line)) add('.prettierignore', 1, 'format-ignore', `lacks "${line}"`, `Add the line ${line}.`);
  if (eslint !== null) {
    if (!/noInlineConfig:\s*true/.test(eslint)) add('eslint.config.mjs', 1, 'lint-ignore', 'does not switch inline eslint-disable comments off (noInlineConfig: true)', 'Restore block 0 of the config.');
    for (const glob of ["'skills/**'", "'.claude/**'"]) if (!eslint.includes(glob)) add('eslint.config.mjs', 1, 'lint-ignore', `globalIgnores lacks ${glob}`, `Add ${glob} to globalIgnores.`);
  }
  for (const entry of preExistingEntries(ctx.root)) {
    const line = entry.isDir ? `${entry.name}/` : entry.name;
    if (prettierignore !== null && !ignoreLines.has(line)) add('.prettierignore', 1, 'format-ignore', `the pre-existing ${entry.isDir ? 'folder' : 'file'} ${line} is not ignored, so Prettier would reformat it`, `Add the line ${line} (or move it into the monorepo layout).`);
    const glob = entry.isDir ? `'${entry.name}/**'` : `'${entry.name}'`;
    if (eslint !== null && !eslint.includes(glob)) add('eslint.config.mjs', lineMatching(eslint, /PRE_EXISTING = /), 'lint-ignore', `the pre-existing ${entry.isDir ? 'folder' : 'file'} ${entry.name} is not in PRE_EXISTING, so ESLint would lint it`, `Add ${glob} to PRE_EXISTING.`);
  }
}

function checkTsconfigs(ctx, add) {
  const base = ctx.json('tsconfig.base.json', { jsonc: true });
  if (base.ok) {
    const want = JSON.parse(template('tsconfig.base.json'));
    if (base.value.extends !== want.extends) add('tsconfig.base.json', 1, 'tsconfig-base', `must extend ${want.extends}`, 'Restore "extends".');
    for (const [key, value] of Object.entries(want.compilerOptions)) {
      if (!same(base.value.compilerOptions?.[key], value)) add('tsconfig.base.json', 1, 'tsconfig-base', `compilerOptions.${key} must be ${JSON.stringify(value)}`, 'Restore the strict option; never loosen the shared compiler settings.');
    }
  }
  const rootTs = ctx.json('tsconfig.json', { jsonc: true });
  if (rootTs.ok) {
    const want = JSON.parse(template('tsconfig.json'));
    if (!same(rootTs.value.compilerOptions?.types, want.compilerOptions.types)) add('tsconfig.json', 1, 'tsconfig-workspace', 'the root program must use types ["jest", "node"]', 'Restore compilerOptions.types.');
    for (const glob of want.include) if (!(rootTs.value.include ?? []).includes(glob)) add('tsconfig.json', 1, 'tsconfig-workspace', `include lacks ${glob}`, 'Restore the include list (tests and Node-side config).');
  }
  const expect = { 'packages/game-kit': { types: ['jest'], lib: ['ESNext'] }, 'packages/shell': { types: ['jest'] }, 'packages/tooling': { types: ['node', 'jest'], lib: ['ESNext'] }, ...Object.fromEntries(ctx.apps.map((app) => [`apps/${app}`, { types: ['jest'] }])) };
  for (const [folder, want] of Object.entries(expect)) {
    const read = ctx.json(`${folder}/tsconfig.json`, { jsonc: true });
    if (!read.ok) continue;
    const rel = `${folder}/tsconfig.json`;
    const cfg = read.value;
    if (cfg.extends !== `${UP2}/tsconfig.base.json`) add(rel, 1, 'tsconfig-workspace', `must extend ${UP2}/tsconfig.base.json`, 'Every workspace uses the shared strict base.');
    const extraKeys = Object.keys(cfg.compilerOptions ?? {}).filter((key) => !['types', 'lib'].includes(key));
    if (extraKeys.length) add(rel, 1, 'tsconfig-workspace', `sets ${extraKeys.join(', ')}; a workspace may only set types and lib`, 'Remove them; change shared options in tsconfig.base.json with a Gate-Change trailer.');
    for (const [key, value] of Object.entries(want)) if (!same(cfg.compilerOptions?.[key], value)) add(rel, 1, 'tsconfig-workspace', `compilerOptions.${key} must be ${JSON.stringify(value)}`, 'Each world lists exactly the types it may use.');
    for (const entry of folder.startsWith('apps/') ? APP_INCLUDES : []) {
      if (!(cfg.include ?? []).includes(`${UP2}/${entry}`)) add(rel, 1, 'tsconfig-workspace', `include lacks ${UP2}/${entry}`, entry.endsWith('app-env.d.ts') ? 'Add it: app programs need the declared process.env (TS2591 without it).' : 'Add it: the Shell\'s route types are a global augmentation nothing imports; without it every navigation.navigate(...) fails with TS2769 in the app program.');
    }
    if (folder === 'packages/shell' && !(cfg.exclude ?? []).includes('src/config/**/*')) add(rel, 1, 'tsconfig-workspace', 'must exclude src/config/**/* (Node-world composer)', 'Add the exclude; the root program checks src/config.');
  }
}

function checkManifests(ctx, add) {
  for (const pkg of PACKAGES) {
    const rel = `packages/${pkg}/package.json`;
    const read = ctx.json(rel);
    if (!read.ok) continue;
    const m = read.value;
    const exportsWant = pkg === 'shell' ? { './plugins/*': './plugins/*', './*': './src/*' } : { './*': './src/*' };
    if (m.name !== `@e07/${pkg}` || m.private !== true || m.type !== 'module') add(rel, 1, 'package-manifest', `must be "@e07/${pkg}", private, "type": "module"`, 'Copy the manifest shape from the templates.');
    if (!same(m.exports, exportsWant)) add(rel, 1, 'package-manifest', `exports must be ${JSON.stringify(exportsWant)} (TypeScript source, no build step, no barrel)`, 'Restore the exports map.');
    if (pkg === 'game-kit' && Object.keys(depsOf(m)).length) add(rel, 1, 'package-manifest', 'game-kit must have no dependencies (pure TypeScript)', 'Remove them; game-kit imports nothing but itself.');
    for (const [name, version] of Object.entries(depsOf(m))) if (!name.startsWith('@e07/') && !EXACT_VERSION.test(version)) add(rel, 1, 'pin-exact', `${name} is pinned as "${version}", not an exact version`, 'Pin it exactly.');
  }
  const shell = ctx.json('packages/shell/package.json').value ?? {};
  for (const [app, m] of ctx.appManifests) {
    const rel = `apps/${app}/package.json`;
    if (m.name !== `@e07/${app}` || m.private !== true || m.main !== 'index.ts') add(rel, 1, 'app-manifest', `must be "@e07/${app}", private, "main": "index.ts"`, 'Copy the manifest shape from the app template.');
    if (!same(m.exports, { './*': './src/*' })) add(rel, 1, 'app-manifest', 'exports must be { "./*": "./src/*" } (game code imports its own folders by package name)', 'Restore the exports map.');
    if (m.type !== undefined) add(rel, 1, 'app-manifest', 'apps have no "type" field (metro.config.js is CommonJS)', 'Remove "type".');
    for (const name of ['expo', 'react', 'react-native', 'expo-system-ui']) if (!m.dependencies?.[name]) add(rel, 1, 'app-manifest', `lacks the dependency ${name}`, name === 'expo-system-ui' ? "Run npx expo install expo-system-ui in the app (userInterfaceStyle 'automatic' needs it)." : `Run npx expo install ${name} in the app.`);
    for (const [name, version] of Object.entries(depsOf(m))) {
      if (name.startsWith('@e07/') && version !== '*') add(rel, 1, 'app-manifest', `${name} must be "*" (a workspace link)`, 'Use "*" for workspace packages.');
      if (SHELL_ONLY.test(name)) add(rel, 1, 'shell-only', `${name} is a Shell-only JavaScript library listed in an app`, 'Remove it from the app; it is a dependency of packages/shell.');
      if (!name.startsWith('@e07/') && name !== 'expo-system-ui' && !SHELL_ONLY.test(name) && !(name in (shell.peerDependencies ?? {}))) add('packages/shell/package.json', 1, 'shell-peer', `${name} (a dependency of apps/${app}) is not a Shell peerDependency`, `Add "${name}": "*" to peerDependencies.`);
    }
  }
  const versions = new Map();
  for (const [app, m] of ctx.appManifests) for (const [name, version] of Object.entries(depsOf(m))) if (version !== '*') versions.set(name, [...(versions.get(name) ?? []), `${app}=${version}`]);
  for (const [name, list] of versions) if (new Set(list.map((item) => item.split('=')[1])).size > 1) add(`apps/${list[0].split('=')[0]}/package.json`, 1, 'app-lockstep', `${name} differs between apps: ${list.join(', ')}`, 'Move every app to the same version in one commit.');
  const manifests = [['package.json', ctx.rootManifest], ...PACKAGES.map((pkg) => [`packages/${pkg}/package.json`, ctx.json(`packages/${pkg}/package.json`).value ?? {}]), ...[...ctx.appManifests].map(([app, m]) => [`apps/${app}/package.json`, m])];
  for (const [rel, m] of manifests) {
    for (const name of Object.keys({ ...depsOf(m), ...(m.peerDependencies ?? {}) })) {
      const hit = BANNED.find(([pattern]) => pattern.test(name));
      if (hit) add(rel, 1, 'banned', `${name} is banned: ${hit[1]}`, `Uninstall it (npm uninstall ${name} -w <workspace>) and remove its files.`);
    }
  }
}

function checkApps(ctx, add) {
  for (const app of ctx.apps) {
    const dir = `apps/${app}`;
    const appConfig = ctx.text(`${dir}/app.config.ts`);
    if (appConfig !== null) {
      if (!/^export default withShell\(gameConfig, process\.env\);$/m.test(appConfig)) add(`${dir}/app.config.ts`, 1, 'app-config', 'must be the one statement export default withShell(gameConfig, process.env);', 'Every native setting comes from withShell and config plugins.');
      if (!appConfig.includes("from '@e07/shell/config/with-shell.ts'") || !appConfig.includes("from './game.config.ts'")) add(`${dir}/app.config.ts`, 1, 'app-config', 'imports must carry the .ts extension (Node type stripping fails without it)', "Import '@e07/shell/config/with-shell.ts' and './game.config.ts'.");
    }
    const metro = ctx.text(`${dir}/metro.config.js`);
    if (metro !== null && !/config\.cacheVersion\s*=.*EXPO_PUBLIC_APP_VARIANT/.test(metro)) add(`${dir}/metro.config.js`, 1, 'metro-cache', "Metro's cache is not keyed on EXPO_PUBLIC_APP_VARIANT (a store build could reuse test-build transforms)", 'Copy metro.config.js from the app template.');
    const game = ctx.text(`${dir}/game.config.ts`);
    if (game !== null) {
      if (!new RegExp(`^\\s*id: '${app}',$`, 'm').test(game)) add(`${dir}/game.config.ts`, lineMatching(game, /^\s*id:/), 'game-config', `id must equal the folder name '${app}'`, 'The game id is the folder, the slug and the save gameId: keep them equal.');
      const bundle = /bundleId: '([^']*)'/.exec(game)?.[1];
      if (bundle === undefined || !BUNDLE_ID.test(bundle)) add(`${dir}/game.config.ts`, lineMatching(game, /bundleId:/), 'game-config', `bundleId "${bundle ?? ''}" must match ${BUNDLE_ID.source}`, 'Use lowercase letters and digits between dots (valid on iOS and Android).');
    }
    const runtimeFiles = ['index.ts', ...listTs(join(ctx.root, dir, 'src')).map((file) => `src/${file}`)];
    for (const file of runtimeFiles) {
      const source = ctx.text(`${dir}/${file}`) ?? '';
      if (/from ['"][^'"]*game\.config(\.ts)?['"]/.test(source)) add(`${dir}/${file}`, lineMatching(source, /game\.config/), 'runtime-game-config', 'app code imports game.config.ts (only app.config.ts may)', 'Read runtime values from expo.extra.game (read-game-extra.ts).');
    }
  }
  const env = ctx.text('packages/shell/src/app-env.d.ts');
  if (env !== null && (!env.includes('EXPO_PUBLIC_APP_VARIANT') || !/declare const process/.test(env))) add('packages/shell/src/app-env.d.ts', 1, 'shell-files', 'must declare EXPO_PUBLIC_APP_VARIANT and `declare const process`', 'Copy app-env.d.ts from the templates.');
  const composer = ctx.text('packages/shell/src/config/with-shell.ts');
  if (composer !== null) {
    for (const [pattern, what] of [[/updates: \{ enabled: false \}/, 'updates: { enabled: false } (no OTA network traffic)'], [/reactCompiler: true/, 'experiments.reactCompiler: true'], [/userInterfaceStyle: 'automatic'/, "userInterfaceStyle: 'automatic'"]]) {
      if (!pattern.test(composer)) add('packages/shell/src/config/with-shell.ts', 1, 'shell-files', `withShell lacks ${what}`, 'Restore it in the composer.');
    }
  }
}

function listTs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const visit = (abs, prefix) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(abs, entry.name), `${prefix}${entry.name}/`);
      else if (/\.tsx?$/.test(entry.name)) out.push(`${prefix}${entry.name}`);
    }
  };
  visit(dir, '');
  return out;
}

function checkGates(ctx, add) {
  const knip = ctx.json('knip.json');
  const knipWant = JSON.parse(template('knip.json'));
  if (knip.ok) {
    if (!same(knip.value.rules, knipWant.rules)) add('knip.json', 1, 'knip-config', 'rules must list every issue type as "error"', 'Restore the rules block.');
    // knip's Jest plugin falls back to Jest's default test globs anywhere in the repo, so the skills
    // (templates and fixtures) must be ignored; only pre-existing top-level entries may join them.
    const ignore = Array.isArray(knip.value.ignore) ? knip.value.ignore : [];
    const mayIgnore = new Set(['skills/**', ...preExistingEntries(ctx.root).map((entry) => (entry.isDir ? `${entry.name}/**` : entry.name))]);
    if (!ignore.includes('skills/**')) add('knip.json', 1, 'knip-config', '"ignore" lacks "skills/**": knip then analyses the skill templates and fixtures (hundreds of "Unlisted dependencies")', 'Add "ignore": ["skills/**"] to knip.json and the same list to quality-gates.json knip.ignore.');
    for (const glob of ignore.filter((entry) => !mayIgnore.has(entry))) add('knip.json', 1, 'knip-config', `"ignore" lists ${glob}; only skills/** and pre-existing top-level folders may be ignored (a wider ignore hides dead code)`, 'Remove it; fix the unused file, export or dependency instead.');
    for (const pkg of PACKAGES) if (knip.value.workspaces?.[`packages/${pkg}`]?.includeEntryExports !== true) add('knip.json', 1, 'knip-config', `workspaces.packages/${pkg}.includeEntryExports must be true (dead Shell and game-kit files are reported)`, 'Restore it.');
  }
  const lefthook = ctx.text('lefthook.yml');
  if (lefthook !== null) {
    for (const line of ['assert_lefthook_installed: true', 'name: no-secrets', 'run: node packages/tooling/src/git/check-commit-message.ts {1}', 'run: npm run verify', 'run: npm run -s typecheck']) if (!lefthook.includes(line)) add('lefthook.yml', 1, 'lefthook', `lacks "${line}"`, 'Restore the hook from the template.');
  }
  const settings = ctx.json('.claude/settings.json');
  if (settings.ok) {
    const s = settings.value;
    for (const rule of ['Read(~/.appstoreconnect/**)', 'Read(**/*.p8)', 'Bash(git commit *--no-verify*)']) if (!(s.permissions?.deny ?? []).includes(rule)) add('.claude/settings.json', 1, 'claude-settings', `permissions.deny lacks ${rule}`, 'Restore the deny list.');
    const stop = JSON.stringify(s.hooks?.Stop ?? []);
    const post = JSON.stringify(s.hooks?.PostToolUse ?? []);
    if (!stop.includes('check:fast') || !stop.includes('exit 2')) add('.claude/settings.json', 1, 'claude-settings', 'the Stop hook must run npm run -s check:fast and exit 2 on failure', 'Restore hooks.Stop.');
    if (!post.includes('Edit|Write') || !post.includes('packages/tooling/src/hooks/after-edit.ts')) add('.claude/settings.json', 1, 'claude-settings', 'the PostToolUse Edit|Write hook must run packages/tooling/src/hooks/after-edit.ts', 'Restore hooks.PostToolUse from the template (node "$(git rev-parse --show-toplevel)/packages/tooling/src/hooks/after-edit.ts").');
  }
  const gates = ctx.json('quality-gates.json');
  if (gates.ok) {
    const g = gates.value;
    for (const [name, command] of Object.entries(g.npmScripts ?? {})) if (ctx.rootManifest.scripts?.[name] !== command) add('quality-gates.json', 1, 'quality-gates', `npmScripts.${name} differs from package.json`, 'Keep the gate and quality-gates.json identical (change both with a Gate-Change trailer).');
    if (settings.ok) {
      for (const key of ['deny', 'ask']) if (!same(g.claudeSettings?.permissions?.[key], settings.value.permissions?.[key])) add('quality-gates.json', 1, 'quality-gates', `claudeSettings.permissions.${key} differs from .claude/settings.json`, 'Make both lists identical.');
      if (!same(g.claudeSettings?.hooks, settings.value.hooks)) add('quality-gates.json', 1, 'quality-gates', 'claudeSettings.hooks differs from .claude/settings.json', 'Make both identical.');
    }
    const npmrc = (ctx.text('.npmrc') ?? '').split('\n');
    for (const line of g.npmrcLines ?? []) if (!npmrc.includes(line)) add('quality-gates.json', 1, 'quality-gates', `npmrcLines lists "${line}" but .npmrc lacks it`, 'Restore the .npmrc line.');
    if (knip.ok && !same(g.knip?.rules, knip.value.rules)) add('quality-gates.json', 1, 'quality-gates', 'knip.rules differs from knip.json', 'Make both identical.');
    if (knip.ok && !same(g.knip?.ignore, knip.value.ignore)) add('quality-gates.json', 1, 'quality-gates', 'knip.ignore differs from knip.json', 'Make both lists identical (the guardrail compares them).');
    const base = ctx.json('tsconfig.base.json', { jsonc: true });
    if (base.ok) for (const [key, value] of Object.entries(g.typescript?.shared ?? {})) if (!same(base.value.compilerOptions?.[key], value)) add('quality-gates.json', 1, 'quality-gates', `typescript.shared.${key} differs from tsconfig.base.json`, 'Keep the strict options identical in both files.');
    for (const probe of Object.keys(g.eslint?.probes ?? {})) {
      const app = /^apps\/([^/]+)\//.exec(probe)?.[1];
      if (app && !ctx.apps.includes(app)) add('quality-gates.json', 1, 'quality-gates', `eslint probe ${probe} names an app that does not exist`, `Point the probe at apps/<pilot>/src/rules/gate-probe.ts (the pilot is ${ctx.apps[0] ?? 'missing'}).`);
    }
  }
  checkGateScope(ctx, add);
  const agents = ctx.text('AGENTS.md');
  const claude = ctx.text('CLAUDE.md');
  if (agents !== null && !agents.includes('npm run -s check:fast')) add('AGENTS.md', 1, 'agents', 'does not tell a session to start from a green npm run -s check:fast', 'Copy AGENTS.md from the template.');
  if (claude !== null && !claude.includes('@AGENTS.md')) add('CLAUDE.md', 1, 'agents', 'must import AGENTS.md with the line @AGENTS.md', 'Write the one line @AGENTS.md.');
}

/** Gates must not reach the skills folder or .claude/ (a skill edit would need a trailer or a prompt). */
function checkGateScope(ctx, add) {
  const stryker = ctx.json('stryker.config.json');
  if (stryker.ok) {
    const ignored = Array.isArray(stryker.value.ignorePatterns) ? stryker.value.ignorePatterns : [];
    for (const folder of KNOWLEDGE_FOLDERS) if (!ignored.includes(folder)) add('stryker.config.json', 1, 'stryker-config', `ignorePatterns lacks "${folder}": Stryker copies it into every sandbox (16,000+ files for the skills)`, `Add "${folder}" to ignorePatterns (the unit-and-component-tests template has it).`);
  }
  // The trailer rules (UNGATED_FOLDERS, isGatedFile) live in commit-trailer-rules.ts, which
  // commit-message-rules.ts imports; an older repo kept them in commit-message-rules.ts itself.
  const rulesFile = ['packages/tooling/src/git/commit-trailer-rules.ts', 'packages/tooling/src/git/commit-message-rules.ts'].find((rel) => ctx.text(rel) !== null);
  const rules = rulesFile === undefined ? null : ctx.text(rulesFile);
  if (rules !== null && !/UNGATED_FOLDERS = \['skills\/', '\.claude\/'\]/.test(rules)) add(rulesFile, lineMatching(rules, /function isGatedFile|UNGATED_FOLDERS/), 'gate-scope', 'gated-path matching does not exclude skills/ and .claude/, so a skill edit that matches a "**/" pattern demands a Gate-Change trailer', 'Copy commit-trailer-rules.ts and commit-message-rules.ts (and the test) from the templates: UNGATED_FOLDERS and isGatedFile.');
  const settings = ctx.json('.claude/settings.json');
  for (const rule of settings.ok ? settings.value.permissions?.ask ?? [] : []) {
    if (/^Edit\(\*\*\//.test(rule)) add('.claude/settings.json', 1, 'gate-scope', `permissions.ask has ${rule}, which also prompts the owner for every matching file under skills/`, 'Anchor it at the repo root instead (Edit(/tsconfig*.json), Edit(/apps/**/tsconfig*.json), Edit(/packages/**/tsconfig*.json)) in both .claude/settings.json and quality-gates.json.');
  }
}

function checkLockfile(ctx, add) {
  const read = ctx.json('package-lock.json');
  if (!read.ok) return read.error === 'missing' ? undefined : add('package-lock.json', 1, 'lockfile', read.error, 'Regenerate it with npm install and commit it.');
  const lock = read.value;
  if (lock.lockfileVersion !== 3) add('package-lock.json', 1, 'lockfile', `lockfileVersion is ${lock.lockfileVersion}, expected 3 (npm 11)`, 'Reinstall with the pinned npm (engine-strict).');
  const rootEntry = lock.packages?.[''] ?? {};
  if (!same(depsOf(rootEntry), depsOf(ctx.rootManifest))) add('package-lock.json', 1, 'lockfile', 'root dependencies differ from package.json (the lockfile is stale)', 'Run npm install, then commit package.json and package-lock.json together.');
  const workspaces = [...PACKAGES.map((pkg) => `packages/${pkg}`), ...ctx.apps.map((app) => `apps/${app}`)];
  for (const ws of workspaces) {
    const manifest = ctx.json(`${ws}/package.json`).value;
    if (!manifest) continue;
    const entry = lock.packages?.[ws];
    if (!entry) add('package-lock.json', 1, 'lockfile', `has no entry for the workspace ${ws}`, 'Run npm install at the root and commit the lockfile.');
    else if (!same(depsOf(entry), depsOf(manifest))) add('package-lock.json', 1, 'lockfile', `dependencies of ${ws} differ from its package.json`, 'Run npm install at the root and commit the lockfile.');
  }
  const allow = ctx.rootManifest.allowScripts ?? {};
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (!entry.hasInstallScript || !path.includes('node_modules/') || entry.inBundle) continue;
    // Optional packages for another platform are in the lockfile but never installed or run (npm skips them too).
    if (entry.optional && !existsSync(join(ctx.root, path))) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const covered = Object.keys(allow).some((key) => key === name || key === `${name}@${entry.version}`);
    if (!covered) add('package.json', 1, 'install-scripts', `${name}@${entry.version} has an install script that allowScripts does not cover`, `Read what the script does, then run npm approve-scripts ${name} (or npm deny-scripts ${name}).`);
  }
  const installedAs = (name) => new Set(Object.entries(lock.packages ?? {}).filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)).map(([, entry]) => entry.version));
  for (const name of ['react', 'react-native']) {
    const found = installedAs(name);
    const pinned = ctx.rootManifest.overrides?.[name];
    if (found.size > 1 || (pinned && found.size === 1 && !found.has(pinned))) add('package-lock.json', 1, 'one-react', `${name} is installed as ${[...found].join(', ')}; the tree must hold exactly ${pinned ?? 'one version'}`, 'Fix "overrides" in the root package.json and reinstall; check with npm ls react react-native.');
  }
  for (const [name, pinned] of Object.entries(ctx.rootManifest.overrides ?? {}).filter(([key]) => !['react', 'react-native'].includes(key))) {
    const found = [...installedAs(name)].sort();
    if (found.length > 0 && (found.length > 1 || found[0] !== pinned)) add('package-lock.json', 1, 'root-overrides', `${name} is installed as ${found.join(', ')} but the root overrides pin ${pinned} (the lockfile predates the override)`, `Run npm install so the override applies, then commit the lockfile; npm ls ${name} must show only ${pinned}.`);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const target = positionals[0] ?? options.root ?? '.';
  const root = requireDir(target, 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${target} has no package.json`, 'Scaffold the repo first: scaffold-monorepo.mjs --root . --write');
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) fail(`--today "${today}" is not YYYY-MM-DD`, 'Pass a date such as 2026-09-28.');
  const report = createReporter({ name: 'check-monorepo', json: options.json });
  const add = (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix });
  const ctx = context(root, today);
  checkFiles(ctx, add);
  checkRootManifest(ctx, add);
  checkNpmrcAndNode(ctx, add);
  checkIgnoresAndFormat(ctx, add);
  checkTsconfigs(ctx, add);
  checkManifests(ctx, add);
  checkApps(ctx, add);
  checkGates(ctx, add);
  checkLockfile(ctx, add);
  return report.finish({ checked: ROOT_FILES.length + ctx.apps.length + PACKAGES.length, unit: 'root files and workspaces' });
});
