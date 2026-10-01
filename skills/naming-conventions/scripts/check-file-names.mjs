#!/usr/bin/env node
// check-file-names.mjs: checks the names of files, folders, workspaces and their main exports in
// the Pocket Arcade app repo (kebab-case, no grab-bag or barrel files, path headers, main export
// named after the file, test/fake/flow/catalog/level/plugin file patterns, package and game ids).
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-file-names.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, matchGlob, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { BUNDLE_ID, KEBAB, NPM_SCRIPT, RULES, bundleIdFor, camelFromKebab, kebabFromPascal, pascalFromKebab, premiumIdFor, stem } from './lib/names.mjs';
import { scanSource } from './lib/source-scan.mjs';
import { workspacePackages } from './lib/workspaces.mjs';

const SPEC = {
  name: 'check-file-names',
  summary:
    'Checks file and folder names under apps/, packages/ and test/, the path header on line 1, that a file\'s main ' +
    'export is named after it, the test/fake/flow/catalog/level/plugin file patterns, workspace package names, ' +
    'game ids, bundle ids and npm script names.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  file-kebab        a file name part is not kebab-case (apply-move.ts, level-tile.tsx, save-v1.full.json)',
    '  folder-kebab      a folder name is not kebab-case (how-to-play/, game-host/)',
    '  grab-bag-file     utils.ts, helpers.ts, common.ts, shared.ts, misc.ts or stuff.ts',
    '  barrel-index      an index.ts other than apps/<id>/index.ts and apps/<id>/src/index.ts',
    '  path-header       line 1 of a .ts/.tsx file is not "// <repo-relative path>"',
    '  export-name       the main export is not named after the file (use-x.ts -> useX, x-screen.tsx -> XScreen,',
    '                    ui/ and screens/ .tsx -> PascalCase or a camelCase JSX helper, nested screens may prefix',
    '                    the parent (SettingsLanguageView), <vendor>-<port>-adapter.ts -> create..., fake-x.ts ->',
    '                    createFakeX, x-port.ts -> type XPort, stores/x-store.ts -> useXStore, x-reducer.ts -> xReducer,',
    '                    plugins/with-x.ts -> withX)',
    '  port-file         a type ending in Port is declared outside its <port>-port.ts file',
    '  test-file         .spec files, __tests__ folders, or a test suffix other than .test/.golden.test/.sim.test/.perf.test',
    '  fake-file         a mock or fake of our own named *.mock.ts, mock-*.ts or *-mock.ts (use fake-<port>.ts)',
    '  flow-file         an e2e flow not named e2e/flows/<area>/<nn>-<name>.yaml, a game flow numbered below 10,',
    '                    or a sub-flow in e2e/subflows/ that is not a kebab-case name',
    '  catalog-file      a catalog not named en.json, de.json, fa.json or ckb.json',
    '  level-file        a level table in src/levels/ not named pack-<n>.json',
    '  plugin-file       a config plugin not named with-<capability>.ts',
    '  save-fixture-file a frozen save fixture not named save-v<N>[.<case>].json',
    '  package-name      a workspace package is not @<scope>/<folder>, or the scopes differ',
    '  game-id           game.config.ts id differs from the folder, a bad bundle id, or a premium id other than <bundleId>.premium',
    '  bundle-id-applander  game.config.ts bundleId is not io.applander.<folder id without hyphens> (owner decision O4:',
    '                    line-siege -> io.applander.linesiege, the same Android package; Premium <bundleId>.premium)',
    '  npm-script-name   a root npm script is not <verb> or <area>:<verb> in kebab-case words',
    '',
    'Example: node check-file-names.mjs .            (from the app repo root)',
  ].join('\n'),
};

// Generated or local-only folders. Root folders and app build output are anchored, so area folders
// such as packages/tooling/src/build/ are still checked.
const IGNORE = ['node_modules', '.git', '.expo', 'ios', 'android', 'apps/*/build/', 'apps/*/dist/', 'apps/*/sfx-preview/', 'coverage/', 'reports/', 'dist-audit/', 'tools/', '.stryker-tmp/', 'skills/', '.claude/', 'expo-env.d.ts'];
const SKIP_FOLDERS = new Set(['__mocks__', '__snapshots__', '__image_snapshots__', 'assets', 'baselines', 'sfx-preview', 'generated']);
const NAMED_EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|ya?ml)$/;
const HEADER_SCOPE = ['apps/**', 'packages/**', 'test/**', '__mocks__/**', '*.ts'];

function checkNames(root, files, report) {
  const folders = new Set();
  for (const rel of files) {
    const parts = rel.split('/');
    const scoped = ['apps', 'packages', 'test'].includes(parts[0]);
    if (!scoped || parts.some((part) => SKIP_FOLDERS.has(part))) continue;
    for (let i = 1; i < parts.length - 1; i += 1) folders.add(parts.slice(0, i + 1).join('/'));
    const name = parts.at(-1);
    if (name.startsWith('.') || !NAMED_EXTENSIONS.test(name)) continue;
    const bad = name.split('.').find((piece) => !KEBAB.test(piece));
    if (bad !== undefined) {
      report.problem({ file: rel, rule: 'file-kebab', message: `file name "${name}" is not kebab-case ("${bad}")`, fix: 'Rename to lowercase words joined by hyphens, e.g. apply-move.ts, level-tile.tsx.' });
    }
  }
  for (const folder of [...folders].sort()) {
    const name = folder.split('/').at(-1);
    if (!KEBAB.test(name)) report.problem({ file: `${folder}/`, rule: 'folder-kebab', message: `folder name "${name}" is not kebab-case`, fix: 'Rename to lowercase words joined by hyphens, e.g. how-to-play/, game-host/.' });
  }
}

function checkFilePatterns(rel, report) {
  const name = rel.split('/').at(-1);
  const base = stem(name);
  const isTs = /\.tsx?$/.test(name);
  const inMocks = rel.startsWith('__mocks__/');
  if (isTs && RULES.grabBagNames.includes(base)) {
    report.problem({ file: rel, rule: 'grab-bag-file', message: `"${name}" is a grab-bag module`, fix: 'Name the file after what it does (format-duration.ts, clamp-to-board.ts); grab-bags grow without limit.' });
  }
  const isAppEntry = /^apps\/[^/]+\/(src\/)?index\.ts$/.test(rel);
  if (/^index\.tsx?$/.test(name) && !isAppEntry && (rel.startsWith('packages/') || rel.startsWith('apps/'))) {
    report.problem({ file: rel, rule: 'barrel-index', message: 'barrel index file', fix: 'Delete it and import the file that defines the symbol; only apps/<id>/index.ts and apps/<id>/src/index.ts exist.' });
  }
  if (/\.spec\.tsx?$/.test(name) || rel.split('/').includes('__tests__')) {
    report.problem({ file: rel, rule: 'test-file', message: 'spec file or __tests__ folder', fix: 'Colocate the test as <unit>.test.ts(x) next to the unit.' });
  } else if (isTs && name.includes('.test.')) {
    const suffix = name.slice(base.length + 1).replace(/\.tsx?$/, '');
    if (!RULES.testSuffixes.includes(suffix)) report.problem({ file: rel, rule: 'test-file', message: `test suffix ".${suffix}"`, fix: 'Use <unit>.test.ts(x), <unit>.golden.test.ts, <unit>.sim.test.ts or <unit>.perf.test.ts.' });
  }
  if (isTs && !inMocks && (/\.mock\.tsx?$/.test(name) || /^mock-/.test(base) || /-mock$/.test(base))) {
    report.problem({ file: rel, rule: 'fake-file', message: `"${name}" is a mock of our own code`, fix: 'Write an in-memory fake-<port>.ts exporting createFake<Port>(); root __mocks__/ is only for vendor SDKs.' });
  }
  if (/\/e2e\/flows\//.test(rel) && /\.ya?ml$/.test(name)) {
    if (!/^\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.ya?ml$/.test(name)) {
      report.problem({ file: rel, rule: 'flow-file', message: `flow "${name}" is not <nn>-<name>.yaml`, fix: 'Name flows e2e/flows/<area>/<nn>-<name>.yaml, e.g. 01-first-launch.yaml.' });
    } else if (!/\/e2e\/flows\/[^/]+\/[^/]+$/.test(rel)) {
      report.problem({ file: rel, rule: 'flow-file', message: `flow "${name}" is not inside an area folder`, fix: 'Put flows in e2e/flows/<area>/ (smoke, journeys, rtl, a11y, ...): the runner lists flows/<area>/*.yaml.' });
    } else if (/^apps\//.test(rel) && Number(name.slice(0, 2)) < 10) {
      report.problem({ file: rel, rule: 'flow-file', message: `game flow "${name}" is numbered below 10`, fix: 'Shell journeys own 01-09 (packages/shell/e2e/flows/); a game numbers its own flows 10 and up, e.g. 10-level-1.yaml.' });
    }
  }
  if (/\/e2e\/subflows\/[^/]+\.ya?ml$/.test(rel) && !/^[a-z0-9]+(-[a-z0-9]+)*\.ya?ml$/.test(name)) {
    report.problem({ file: rel, rule: 'flow-file', message: `sub-flow "${name}" is not <name>.yaml in kebab-case`, fix: 'Name sub-flows by what they do (debug-setup.yaml); they never run on their own and carry no number.' });
  }
  if ((/^packages\/shell\/src\/i18n\/catalogs\/[^/]+\.json$/.test(rel) || /^apps\/[^/]+\/src\/i18n\/[^/]+\.json$/.test(rel)) && !RULES.languages.includes(base)) {
    report.problem({ file: rel, rule: 'catalog-file', message: `catalog "${name}" is not a language code`, fix: `One file per language: ${RULES.languages.map((code) => `${code}.json`).join(', ')}.` });
  }
  if (/^apps\/[^/]+\/src\/levels\/[^/]+\.json$/.test(rel) && !/^pack-\d+\.json$/.test(name)) {
    report.problem({ file: rel, rule: 'level-file', message: `level table "${name}" is not pack-<n>.json`, fix: 'Name level tables pack-1.json, pack-2.json, ...' });
  }
  if (/^packages\/shell\/plugins\/[^/]+\.ts$/.test(rel) && !/^with-[a-z0-9]+(-[a-z0-9]+)*\.ts$/.test(name)) {
    report.problem({ file: rel, rule: 'plugin-file', message: `config plugin "${name}" is not with-<capability>.ts`, fix: 'Name local config plugins with-<capability>.ts, e.g. with-storekit-test.ts.' });
  }
  if (/\/services\/save\/fixtures\/[^/]+\.json$/.test(rel) && !/^save-v\d+(\.[a-z0-9]+(-[a-z0-9]+)*)?\.json$/.test(name)) {
    report.problem({ file: rel, rule: 'save-fixture-file', message: `save fixture "${name}" is not save-v<N>[.<case>].json`, fix: 'Name frozen save fixtures save-v1.json, save-v1.full.json, ...' });
  }
}

function exportedNames(code) {
  const names = new Set();
  for (const match of code.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function\s*\*?|const|let|var|type|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of code.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const item of match[1].split(',')) {
      const alias = item.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim();
      if (alias) names.add(alias);
    }
  }
  return names;
}

/** The name a file's main export must have, or null when the file has no fixed pattern. */
function expectedExport(rel) {
  const want = expectedExportName(rel);
  if (!want) return null;
  const names = [want.name];
  // A nested screen may carry its parent screens in its name: settings/language/language-screen.tsx
  // exports LanguageScreen or SettingsLanguageScreen (the route is SettingsLanguage).
  const nested = /\/screens\/(.+)\/[^/]+$/.exec(rel)?.[1].split('/') ?? [];
  const isComponent = want.what === 'screen component' || want.what === 'component';
  if (isComponent && nested.length > 1) names.push(`${nested.slice(0, -1).map(pascalFromKebab).join('')}${want.name}`);
  // A .tsx module whose main export is a JSX helper function (picture-path.tsx -> picturePath).
  if (want.what === 'component') names.push(camelFromKebab(stem(rel)));
  return { names, what: want.what };
}

function expectedExportName(rel) {
  const name = rel.split('/').at(-1);
  if (/\.(test|d)\.|\.golden\.|\.sim\./.test(name) || !/\.tsx?$/.test(name)) return null;
  const base = stem(name);
  if (/^use-[a-z0-9-]+$/.test(base)) return { name: camelFromKebab(base), what: 'hook' };
  if (/-screen$/.test(base) && name.endsWith('.tsx')) return { name: pascalFromKebab(base), what: 'screen component' };
  if (/^packages\/shell\/plugins\//.test(rel) && /^with-/.test(base)) return { name: camelFromKebab(base), what: 'config plugin' };
  if (/^fake-[a-z0-9-]+$/.test(base)) return { name: `create${pascalFromKebab(base)}`, what: 'fake factory' };
  if (/-adapter$/.test(base) || (/-save-store$/.test(base) && base !== 'save-store') || (/-sql-driver$/.test(base) && base !== 'sql-driver')) {
    return { name: `create${pascalFromKebab(base)}`, what: 'adapter factory' };
  }
  if (/-port$/.test(base)) return { name: pascalFromKebab(base), what: 'port type' };
  if (/\/stores\//.test(rel) && /-store$/.test(base)) return { name: `use${pascalFromKebab(base)}`, what: 'store hook' };
  if (/-reducer$/.test(base)) return { name: camelFromKebab(base), what: 'reducer' };
  if (name.endsWith('.tsx') && /\/(ui|screens)\//.test(rel)) return { name: pascalFromKebab(base), what: 'component' };
  return null;
}

function checkSource(root, rel, report) {
  const text = readFileSync(join(root, rel), 'utf8');
  const first = (text.split('\n')[0] ?? '').trimEnd();
  // The path is the first thing on line 1; a short note after it is tolerated.
  if (HEADER_SCOPE.some((glob) => matchGlob(rel, glob)) && first !== `// ${rel}` && !first.startsWith(`// ${rel} `)) {
    report.problem({ file: rel, line: 1, rule: 'path-header', message: `line 1 is not "// ${rel}"`, fix: `Make line 1: // ${rel}` });
  }
  if (rel.startsWith('__mocks__/')) return;
  const { code } = scanSource(text);
  const exported = exportedNames(code);
  const defaulted = /\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;/.exec(code)?.[1];
  if (defaulted) exported.add(defaulted);
  const want = expectedExport(rel);
  if (want && !want.names.some((name) => exported.has(name))) {
    report.problem({ file: rel, rule: 'export-name', message: `the ${want.what} in "${rel.split('/').at(-1)}" must export ${want.names.join(' or ')}`, fix: `Name the main export ${want.names[0]} (the file name alone must tell what to import), or rename the file after its export.` });
  }
  for (const match of code.matchAll(/\bexport\s+type\s+([A-Z][A-Za-z0-9]*Port)\b/g)) {
    const expected = `${kebabFromPascal(match[1])}.ts`;
    if (rel.split('/').at(-1) !== expected) {
      report.problem({ file: rel, rule: 'port-file', message: `port type ${match[1]} is declared outside ${expected}`, fix: `Move it to packages/shell/src/services/<port>/${expected}; one port per file.` });
    }
  }
}

function checkWorkspaces(root, report) {
  const packages = workspacePackages(root);
  const scopes = new Map();
  for (const entry of packages) {
    const folder = entry.dir.split('/')[1];
    const match = /^@([a-z0-9-]+)\/([a-z0-9-]+)$/.exec(entry.name);
    if (!match || match[2] !== folder) {
      report.problem({ file: `${entry.dir}/package.json`, line: 1, rule: 'package-name', message: `name "${entry.name}" is not @<scope>/${folder}`, fix: `Set "name": "@<scope>/${folder}" (the folder name, kebab-case).` });
      continue;
    }
    scopes.set(match[1], [...(scopes.get(match[1]) ?? []), entry.dir]);
  }
  if (scopes.size > 1) {
    const list = [...scopes.entries()].map(([scope, dirs]) => `@${scope} (${dirs.join(', ')})`).join('; ');
    report.problem({ file: 'package.json', line: 1, rule: 'package-name', message: `workspaces use more than one scope: ${list}`, fix: 'Use one scope for every workspace package; rename it with one search-and-replace.' });
  }
  for (const entry of packages.filter((item) => item.dir.startsWith('apps/'))) checkGameConfig(root, entry.dir, report);
}

function checkGameConfig(root, dir, report) {
  const file = `${dir}/game.config.ts`;
  if (!existsSync(join(root, file))) return;
  const folder = dir.split('/')[1];
  const text = readFileSync(join(root, file), 'utf8');
  const { codeKeep, lineOf } = scanSource(text);
  const field = (key) => {
    const match = new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`).exec(codeKeep);
    return match ? { value: match[1], line: lineOf(match.index) } : null;
  };
  const id = field('id');
  if (id && id.value !== folder) report.problem({ file, line: id.line, rule: 'game-id', message: `id '${id.value}' differs from the folder apps/${folder}`, fix: `Set id: '${folder}'; the game id, folder, slug and commit scope are one kebab-case name, stable forever.` });
  const bundle = field('bundleId');
  if (bundle && !BUNDLE_ID.test(bundle.value)) report.problem({ file, line: bundle.line, rule: 'game-id', message: `bundleId '${bundle.value}' does not match ${BUNDLE_ID.source}`, fix: `Use lowercase letters and digits in dot-separated segments: '${bundleIdFor(folder)}' (valid on iOS and Android).` });
  const expected = bundleIdFor(folder);
  if (bundle === null || bundle.value !== expected) {
    report.problem({ file, line: bundle?.line ?? 1, rule: 'bundle-id-applander', message: bundle === null ? `no bundleId: apps/${folder} must use '${expected}'` : `bundleId '${bundle.value}' is not '${expected}'`, fix: `Set bundleId: '${expected}' and premium.productId: '${premiumIdFor(folder)}' (owner decision O4: io.applander.<game id without hyphens>, all lowercase; withShell uses it as the Android package too).` });
  }
  const product = field('productId');
  if (bundle && product && product.value !== `${bundle.value}.premium`) report.problem({ file, line: product.line, rule: 'game-id', message: `premium productId '${product.value}' is not '${bundle.value}.premium'`, fix: `Set productId: '${premiumIdFor(folder)}' (the bundle id io.applander.<game id without hyphens> + .premium).` });
}

function checkScripts(root, report) {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return;
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  for (const name of Object.keys(pkg.scripts ?? {})) {
    if (!NPM_SCRIPT.test(name)) report.problem({ file: 'package.json', line: 1, rule: 'npm-script-name', message: `script "${name}" is not <verb> or <area>:<verb>`, fix: 'Use kebab-case words joined by ":" (test:golden, build:ios:sim); the canonical names are fixed.' });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-file-names', json: options.json });
  const files = walk(root, { ignore: IGNORE });
  checkNames(root, files, report);
  let checked = 0;
  for (const rel of files) {
    const inScope = ['apps', 'packages', 'test', '__mocks__'].includes(rel.split('/')[0]) || /^[^/]+\.ts$/.test(rel);
    if (!inScope || !/\.(ts|tsx|json|ya?ml)$/.test(rel)) continue;
    checked += 1;
    checkFilePatterns(rel, report);
    if (/\.tsx?$/.test(rel)) checkSource(root, rel, report);
  }
  checkWorkspaces(root, report);
  checkScripts(root, report);
  const manifests = workspacePackages(root).length + (existsSync(join(root, 'package.json')) ? 1 : 0);
  return report.finish({ checked: checked + manifests, unit: 'files and manifests' });
});
