#!/usr/bin/env node
// check-layout.mjs: checks the shape of the Pocket Arcade monorepo: the four kinds of workspace and
// their manifests, one React, native modules in every app, each app's wiring files (app.config.ts,
// index.ts, game.config.ts, metro.config.js), the folder sets, ports with their fakes, file placement
// and work at import time.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-layout.mjs [repo-root]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { IGNORE, MONOREPO_CODE } from './lib/import-graph.mjs';
import { scanSource } from './lib/source-scan.mjs';
import { workspacePackages } from './lib/workspaces.mjs';

const RULES = JSON.parse(readFileSync(new URL('../assets/architecture-rules.json', import.meta.url), 'utf8'));

const SPEC = {
  name: 'check-layout',
  summary:
    'Checks the monorepo shape: workspaces and manifests (type module, exports map, one React), native ' +
    'modules in every app, the app wiring files, the canonical folder sets, port/adapter/fake triples, ' +
    'file placement and module-level work.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  workspaces        root workspaces is not ["apps/*", "packages/*"], or packages/ holds more than game-kit, shell, tooling',
    '  manifest          a package lacks "type": "module" or the exports map (./* -> ./src/*; shell also ./plugins/*),',
    '                    or an app lacks main index.ts / its exports map',
    '  one-react         root overrides do not pin react and react-native to the apps\' versions',
    '  native-deps       a Shell peerDependency is missing from an app, or two apps pin different versions',
    '  app-config        apps/<id>/app.config.ts is not the one-statement withShell(gameConfig, process.env) form',
    '  app-entry         apps/<id>/index.ts is not the 3-line startShell entry (checked once packages/shell/src/app/start-shell.ts exists)',
    '  app-files         an app lacks app.config.ts, game.config.ts, index.ts, src/index.ts, tsconfig.json or metro.config.js',
    '  metro-cache       metro.config.js does not key config.cacheVersion on EXPO_PUBLIC_APP_VARIANT',
    '  game-config-use   a runtime file imports game.config.ts (runtime values arrive through expo.extra)',
    '  folders           a folder outside the canonical sets of game-kit, Shell and game src; a file directly in',
    '                    packages/shell/src or packages/tooling/src; a tooling area that is not a kebab-case noun',
    '  port-triple       a services/<port>/ folder with an adapter lacks its port file or its fake',
    '  placement         a screen, adapter, port, store, reducer, plugin or Node-API test in the wrong place',
    '  import-time-work  module-level code opens a database, creates an AudioContext, an adapter or a global zustand',
    '                    store, boots the Shell or switches the direction (a reload re-runs every module)',
    '',
    'Example: node check-layout.mjs .            (from the app repo root)',
  ].join('\n'),
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const dirsOf = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => e.name).sort() : []);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function checkWorkspaces(root, report) {
  const pkg = readJson(join(root, 'package.json'));
  if (!same(pkg.workspaces, RULES.workspaces)) {
    report.problem({ file: 'package.json', line: 1, rule: 'workspaces', message: `workspaces is ${JSON.stringify(pkg.workspaces)}`, fix: `Set "workspaces": ${JSON.stringify(RULES.workspaces)}: exactly four kinds of workspace.` });
  }
  for (const name of dirsOf(join(root, 'packages'))) {
    if (!RULES.packages.includes(name)) report.problem({ file: `packages/${name}/`, rule: 'workspaces', message: `unexpected package "${name}"`, fix: 'The packages are game-kit, shell and tooling; shared code goes into one of them, a game into apps/<game-id>.' });
  }
  const workspaces = workspacePackages(root);
  for (const entry of workspaces.filter((w) => w.dir.startsWith('packages/'))) {
    const manifest = entry.manifest ?? {};
    const file = `${entry.dir}/package.json`;
    const want = entry.dir === 'packages/shell' ? { './plugins/*': './plugins/*', './*': './src/*' } : { './*': './src/*' };
    if (manifest.type !== 'module') report.problem({ file, line: 1, rule: 'manifest', message: 'no "type": "module"', fix: 'Add "type": "module" so Node type-strips the package without MODULE_TYPELESS_PACKAGE_JSON.' });
    if (!same(manifest.exports, want)) report.problem({ file, line: 1, rule: 'manifest', message: `exports is ${JSON.stringify(manifest.exports)}`, fix: `Set "exports": ${JSON.stringify(want)}; packages are consumed as TypeScript source, no build step, no barrel.` });
    if (manifest.main !== undefined) report.problem({ file, line: 1, rule: 'manifest', message: `"main": "${manifest.main}" (a barrel entry)`, fix: 'Remove "main"; importers name the file (@scope/<package>/<path>.ts).' });
  }
  const apps = workspaces.filter((w) => w.dir.startsWith('apps/'));
  for (const entry of apps) {
    const manifest = entry.manifest ?? {};
    const file = `${entry.dir}/package.json`;
    if (manifest.main !== 'index.ts') report.problem({ file, line: 1, rule: 'manifest', message: `main is ${JSON.stringify(manifest.main)}`, fix: 'Set "main": "index.ts" (the 3-line entry).' });
    if (!same(manifest.exports, { './*': './src/*' })) report.problem({ file, line: 1, rule: 'manifest', message: `exports is ${JSON.stringify(manifest.exports)}`, fix: 'Set "exports": { "./*": "./src/*" } so game code reaches its own folders without ../.' });
    if (manifest.type === 'module' && existsSync(join(root, entry.dir, 'metro.config.js'))) report.problem({ file, line: 1, rule: 'manifest', message: '"type": "module" next to a CommonJS metro.config.js', fix: 'Remove "type" from the app (metro.config.js is CommonJS), or rename it metro.config.cjs.' });
  }
  return { pkg, apps };
}

function checkDependencies(root, pkg, apps, report) {
  const shell = workspacePackages(root).find((w) => w.dir === 'packages/shell')?.manifest ?? {};
  const peers = Object.keys(shell.peerDependencies ?? {});
  const versions = new Map();
  for (const app of apps) {
    const deps = app.manifest?.dependencies ?? {};
    for (const peer of peers) {
      if (deps[peer] === undefined) report.problem({ file: `${app.dir}/package.json`, line: 1, rule: 'native-deps', message: `lacks the Shell peer dependency ${peer}`, fix: 'Install it in every app (npx expo install inside the app): autolinking and expo install --check see only the app\'s own dependencies.' });
    }
    for (const [name, version] of Object.entries(deps)) {
      if (name.startsWith('@') && app.manifest?.name && name.split('/')[0] === app.manifest.name.split('/')[0]) continue;
      if (!versions.has(name)) versions.set(name, new Map());
      versions.get(name).set(app.dir, version);
    }
  }
  for (const [name, byApp] of versions) {
    const distinct = new Set(byApp.values());
    if (distinct.size > 1) report.problem({ file: 'package.json', line: 1, rule: 'native-deps', message: `${name} has different versions across apps: ${[...byApp].map(([dir, v]) => `${dir} ${v}`).join(', ')}`, fix: 'Pin one version in every app; all apps upgrade in lockstep.' });
  }
  if (apps.length > 0) {
    const overrides = pkg.overrides ?? {};
    for (const name of ['react', 'react-native']) {
      const appVersion = apps[0].manifest?.dependencies?.[name];
      if (overrides[name] === undefined || (appVersion !== undefined && overrides[name] !== appVersion)) {
        report.problem({ file: 'package.json', line: 1, rule: 'one-react', message: `overrides.${name} is ${JSON.stringify(overrides[name])}, the apps use ${JSON.stringify(appVersion)}`, fix: `Set "overrides": { "${name}": "${appVersion ?? '<the apps\' version>'}" }: without it npm installs a second copy at the root and Jest resolves it.` });
      }
    }
  }
}

function statements(text) {
  const { codeKeep } = scanSource(text);
  return codeKeep.split(';').map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function checkApp(root, dir, report) {
  // Before the Shell boot exists (right after monorepo-bootstrap), the pilot's index.ts is a
  // registerRootComponent placeholder and there is no game module yet: those two checks wait.
  const hasShellBoot = existsSync(join(root, 'packages/shell/src/app/start-shell.ts'));
  const need = ['app.config.ts', 'game.config.ts', 'index.ts', 'tsconfig.json', 'metro.config.js', ...(hasShellBoot ? ['src/index.ts'] : [])];
  for (const name of need) {
    if (!existsSync(join(root, dir, name))) report.problem({ file: `${dir}/${name}`, rule: 'app-files', message: `${name} is missing`, fix: 'Every app has app.config.ts, game.config.ts, the 3-line index.ts, src/index.ts (the GameModule), tsconfig.json and metro.config.js.' });
  }
  const appConfig = join(root, dir, 'app.config.ts');
  if (existsSync(appConfig)) {
    const parts = statements(readFileSync(appConfig, 'utf8'));
    const ok = parts.length === 3 && /^import \{ withShell \} from '[^']*\/config\/with-shell\.ts'$/.test(parts[0]) && /^import \{ gameConfig \} from '\.\/game\.config\.ts'$/.test(parts[1]) && parts[2] === 'export default withShell(gameConfig, process.env)';
    if (!ok) report.problem({ file: `${dir}/app.config.ts`, line: 1, rule: 'app-config', message: 'is not the one-statement withShell form', fix: "Write: import { withShell } from '@scope/shell/config/with-shell.ts'; import { gameConfig } from './game.config.ts'; export default withShell(gameConfig, process.env); (every native setting comes from withShell and config plugins)." });
  }
  const entry = join(root, dir, 'index.ts');
  if (!hasShellBoot) report.note(`note: ${dir}/index.ts and src/index.ts are not checked yet (packages/shell/src/app/start-shell.ts does not exist)`);
  if (existsSync(entry) && hasShellBoot) {
    const parts = statements(readFileSync(entry, 'utf8'));
    const call = /^import \{ startShell \} from '[^']*\/app\/start-shell\.ts'$/.test(parts[0] ?? '') ? /^import \{ (\w+) \} from '\.\/src\/index\.ts'$/.exec(parts[1] ?? '') : null;
    if (!(parts.length === 3 && call && parts[2] === `startShell(${call[1]})`)) {
      report.problem({ file: `${dir}/index.ts`, line: 1, rule: 'app-entry', message: 'is not the 3-line startShell entry', fix: "Write: import { startShell } from '@scope/shell/app/start-shell.ts'; import { <game>Game } from './src/index.ts'; startShell(<game>Game); (polyfills and the direction check run first, inside startShell)." });
    }
  }
  const metro = join(root, dir, 'metro.config.js');
  if (existsSync(metro) && !/config\.cacheVersion\s*=\s*`[^`]*\$\{process\.env\.EXPO_PUBLIC_APP_VARIANT/.test(readFileSync(metro, 'utf8'))) {
    report.problem({ file: `${dir}/metro.config.js`, line: 1, rule: 'metro-cache', message: 'config.cacheVersion is not keyed on EXPO_PUBLIC_APP_VARIANT', fix: 'Add config.cacheVersion = `app-variant-${process.env.EXPO_PUBLIC_APP_VARIANT ?? \'test\'}`; without it a store build reused test-build transforms and shipped the debug menu (verified).' });
  }
}

function checkFolders(root, report) {
  const expect = (parent, allowed, what) => {
    for (const name of dirsOf(join(root, parent))) {
      if (!allowed.includes(name)) report.problem({ file: `${parent}/${name}/`, rule: 'folders', message: `"${name}" is not a ${what} folder`, fix: `Use one of: ${allowed.join(', ')}; a new kind of file needs an owner decision and a row in the placement table.` });
    }
  };
  expect('packages/game-kit/src', RULES.folders['game-kit'], 'game-kit');
  expect('packages/shell/src', RULES.folders.shell, 'Shell');
  for (const name of dirsOf(join(root, 'packages/tooling/src'))) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) report.problem({ file: `packages/tooling/src/${name}/`, rule: 'folders', message: `tooling area "${name}" is not a kebab-case noun`, fix: `Name areas like ${RULES.folders.tooling.slice(0, 6).join(', ')}.` });
  }
  for (const app of dirsOf(join(root, 'apps'))) expect(`apps/${app}/src`, RULES.folders.app, 'game');
  const shellSrc = join(root, 'packages/shell/src');
  if (existsSync(shellSrc)) {
    for (const name of readdirSync(shellSrc)) {
      if (statSync(join(shellSrc, name)).isFile() && !RULES.folders.shellFiles.includes(name)) report.problem({ file: `packages/shell/src/${name}`, rule: 'folders', message: 'a file directly in packages/shell/src', fix: 'Put it in its area folder (app/, ui/, services/<port>/, ...); only app-env.d.ts sits at the top.' });
    }
  }
  const toolingSrc = join(root, 'packages/tooling/src');
  if (existsSync(toolingSrc)) {
    for (const name of readdirSync(toolingSrc)) {
      if (statSync(join(toolingSrc, name)).isFile()) report.problem({ file: `packages/tooling/src/${name}`, rule: 'folders', message: 'a tooling script directly in src/', fix: 'Tooling scripts live in an area folder: packages/tooling/src/<area>/<verb>-<noun>.ts.' });
    }
  }
}

function checkPorts(root, report) {
  const services = join(root, 'packages/shell/src/services');
  for (const folder of dirsOf(services)) {
    const files = readdirSync(join(services, folder));
    const adapters = files.filter((f) => /-adapter\.ts$/.test(f) || (/-save-store\.ts$/.test(f) && f !== 'save-store.ts') || (/-sql-driver\.ts$/.test(f) && f !== 'sql-driver.ts'));
    if (adapters.length === 0) continue;
    const known = RULES.ports.filter((port) => port.folder === folder);
    const portFiles = known.length > 0 ? known.map((port) => port.port) : [`${folder}-port.ts`];
    if (!portFiles.some((name) => files.includes(name))) report.problem({ file: `packages/shell/src/services/${folder}/`, rule: 'port-triple', message: `has an adapter (${adapters[0]}) but no port file (${portFiles.join(' or ')})`, fix: 'Write the vendor-neutral port type first, in services/<port>/<port>-port.ts.' });
    if (!files.some((name) => /^fake-[a-z0-9-]+\.ts$/.test(name))) report.problem({ file: `packages/shell/src/services/${folder}/`, rule: 'port-triple', message: `has an adapter (${adapters[0]}) but no fake-<port>.ts`, fix: 'Write the in-memory fake (createFake<Port>) so tests never touch the SDK.' });
  }
}

function checkPlacement(root, report) {
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: IGNORE }).filter((rel) => MONOREPO_CODE.test(rel));
  for (const rel of files) {
    const name = rel.split('/').at(-1);
    const bad = (message, fix) => report.problem({ file: rel, rule: 'placement', message, fix });
    if (/-screen\.tsx$/.test(name) && !/^packages\/shell\/src\/screens\//.test(rel) && !RULES.nonRouteScreens.includes(rel)) bad('a screen outside packages/shell/src/screens/', 'Screens are Shell screens: packages/shell/src/screens/<screen>/<screen>-screen.tsx (only the error boundary\'s app/crash-screen.tsx and the partial Shell\'s navigation/not-built-screen.tsx live elsewhere).');
    // The test-only debug module (S15, reached only through TEST_ONLY) keeps its own debug store
    // port and fake next to each other; they are test tooling, never app services or domain stores.
    const isTestOnlyModule = RULES.testOnlyFolders.some((folder) => rel.startsWith(folder));
    if ((/-adapter\.ts$/.test(name) || /-port\.ts$/.test(name) || /^fake-/.test(name)) && !isTestOnlyModule && !/^packages\/shell\/src\/services\/[^/]+\/[^/]+$/.test(rel) && !/\.test\.ts$/.test(name)) bad('a port, adapter or fake outside packages/shell/src/services/<port>/', 'Ports, adapters and fakes live together in packages/shell/src/services/<port>/.');
    if (/-(store|selectors)\.ts$/.test(name) && !isTestOnlyModule && !/save-store\.ts$/.test(name) && !/^packages\/shell\/src\/(stores|app|game-host)\//.test(rel) && !/\.test\.ts$/.test(name)) bad('a store outside packages/shell/src/stores/', 'Domain stores and selectors live in packages/shell/src/stores/ (a big domain gets stores/<domain>/); only the session store (game-host/) and OS mirrors (app/) live elsewhere.');
    if (/-reducer\.ts$/.test(name) && !/^packages\/shell\/src\/(stores|game-host)\//.test(rel)) bad('a reducer outside stores/ or game-host/', 'Shell reducers live in packages/shell/src/stores/ (the GameSession reducer in game-host/); game logic is applyMove in apps/<id>/src/rules/.');
    const text = readFileSync(join(root, rel), 'utf8');
    if (/from\s+'expo\/config-plugins(\.js)?'/.test(text) && !/^packages\/shell\/(plugins|src\/config)\//.test(rel) && !/^packages\/tooling\//.test(rel)) bad('a config plugin outside packages/shell/plugins/', 'Local Expo config plugins live in packages/shell/plugins/with-<capability>.ts, referenced by path from withShell.');
    if (/\.test\.tsx?$/.test(name) && /^(packages|apps)\//.test(rel) && !/^packages\/tooling\//.test(rel) && /from\s+'node:/.test(text)) bad('a test that needs Node APIs inside an app program', 'Move it to the root test/integration/<area>/ (the root program has Node types).');
  }
  return files;
}

// Work that must never happen when a module is imported: a direction reload re-runs every module.
const IMPORT_TIME_HAZARDS = [
  { pattern: /\b(openDatabaseSync|openDatabaseAsync)\s*\(/, what: 'opens a database' },
  { pattern: /\bnew\s+AudioContext\s*\(/, what: 'creates an AudioContext' },
  { pattern: /\bcreate[A-Z][\w$]*(Adapter|SaveStore|SqlDriver)\s*\(/, what: 'creates an adapter' },
  { pattern: /\b(createShellApp|hydrateSave|reloadAppAsync)\s*\(/, what: 'boots the Shell' },
  { pattern: /\bI18nManager\.(forceRTL|allowRTL)\s*\(/, what: 'switches the layout direction' },
];
const ZUSTAND_CREATE = { pattern: /(?<![\w$.])create\s*(<[^>]*>)?\s*\(\s*\)?\s*\(?/, what: 'creates a global zustand store' };
IMPORT_TIME_HAZARDS.push(ZUSTAND_CREATE);
const ZUSTAND_CREATE_IMPORT = /import\s*\{[^}]*\bcreate\b[^}]*\}\s*from\s*['"]zustand['"]/;

function topLevelStatements(code) {
  // Statements that start in column 0 outside any function body.
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < code.length; i += 1) {
    const c = code[i];
    if (c === '{' || c === '(' || c === '[') depth += 1;
    else if (c === '}' || c === ')' || c === ']') depth -= 1;
    const atEnd = (c === ';' && depth === 0) || (c === '}' && depth === 0 && /^\s*\n/.test(code.slice(i + 1, i + 3)));
    if (atEnd) {
      out.push({ index: start, text: code.slice(start, i + 1) });
      start = i + 1;
    }
  }
  return out;
}

function checkImportTimeWork(root, files, report) {
  const runtime = files.filter((rel) => /^(packages\/(shell\/src|game-kit\/src)|apps\/[^/]+\/src)\//.test(rel) && !/^packages\/shell\/src\/(config|testing)\//.test(rel) && !/\.test\.tsx?$/.test(rel));
  for (const rel of runtime) {
    if (/\/i18n\/intl-polyfills\.ts$/.test(rel) || /\/app\/start-shell\.ts$/.test(rel)) continue;
    const source = readFileSync(join(root, rel), 'utf8');
    const { code, lineOf } = scanSource(source);
    // A module-level create(...) is a zustand store only where create comes from zustand (a game's
    // create(seed, difficulty) from its own rules is pure data, e.g. a tutorial's start state).
    const hazards = ZUSTAND_CREATE_IMPORT.test(source) ? IMPORT_TIME_HAZARDS : IMPORT_TIME_HAZARDS.filter((hazard) => hazard !== ZUSTAND_CREATE);
    for (const statement of topLevelStatements(code)) {
      const body = statement.text.trimStart();
      if (/^(import|export\s+(type|\{|\*)|type\s|declare\s)/.test(body) || /^(export\s+)?(async\s+)?function\b/.test(body)) continue;
      for (const hazard of hazards) {
        const match = hazard.pattern.exec(body);
        if (match && !/=>|\bfunction\b/.test(body.slice(0, match.index))) {
          const at = statement.index + (statement.text.length - body.length) + match.index;
          report.problem({ file: rel, line: lineOf(at), rule: 'import-time-work', message: `module-level code ${hazard.what} (${match[0].trim()})`, fix: 'Do it in a factory that createShellApp calls, and pass the result down through ServicesProvider or StoresProvider.' });
        }
      }
    }
  }
}

function checkGameConfigUse(root, files, report) {
  for (const rel of files) {
    if (/^apps\/[^/]+\/app\.config\.ts$/.test(rel) || /^packages\/tooling\//.test(rel) || /^test\//.test(rel)) continue;
    const { code, stringAt, lineOf } = scanSource(readFileSync(join(root, rel), 'utf8'));
    for (const match of code.matchAll(/\bfrom\s*(?=['"])/g)) {
      const spec = stringAt.get(match.index + match[0].length)?.value ?? '';
      if (/(^|\/)game\.config(\.ts)?$/.test(spec)) report.problem({ file: rel, line: lineOf(match.index), rule: 'game-config-use', message: `imports ${spec}`, fix: 'Only app.config.ts reads game.config.ts; runtime code reads expo.extra.game through readGameExtra().' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`nothing to check: ${root} has no package.json`, 'Run from the app repo root, or pass it as the argument.');
  const report = createReporter({ name: 'check-layout', json: options.json });
  const { pkg, apps } = checkWorkspaces(root, report);
  checkDependencies(root, pkg, apps, report);
  for (const app of apps) checkApp(root, app.dir, report);
  checkFolders(root, report);
  checkPorts(root, report);
  const files = checkPlacement(root, report);
  checkImportTimeWork(root, files, report);
  checkGameConfigUse(root, files, report);
  return report.finish({ checked: files.length + apps.length + 1, unit: 'files and manifests' });
});
