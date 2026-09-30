#!/usr/bin/env node
// check-stores.mjs: checks the app-state stores and the per-run session store of a Pocket Arcade
// repo against the store rules (factories, reduce -> persist -> publish, pure reducers, selectors
// and useShallow, no second persistence path). Static: it reads source text, it runs nothing.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-stores.mjs [repo-root]

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { buildsNewValue, findCalls, objectBuildingSelectors } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-stores',
  summary:
    'Checks the Zustand stores (settings, progress, stats, premium) and the GameSession store of a Pocket Arcade app repo: store factories, persist-before-publish, pure tested reducers, imperative action names, selectors with useShallow, and no persistence outside SaveService.',
  usage: '[repo-root] [--json]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  missing-file          a store file of the standard layout is missing',
    '  store-singleton       zustand create() or a module-level createStore(): stores come from factories',
    '  store-created-twice   a domain store factory called outside create-shell-stores.ts (and tests)',
    '  store-persist-order   dispatch must write (save.update / persist) before set()',
    '  reducer-impure        a reducer or selector imports React/RN/zustand/expo/services or reads time/randomness',
    '  reducer-untested      a *-reducer.ts without *-reducer.test.ts, or a persisting store without a store test',
    '  action-name           action types are kebab-case imperative verbs (set-theme, not theme-changed)',
    '  selector-missing      a store hook called without a selector',
    '  selector-new-object   a selector that builds a new object/array is not wrapped in useShallow',
    '  shallow-v4            useStore(store, selector, shallow): Zustand 5 has no equality argument',
    '  second-persistence    zustand/middleware, AsyncStorage or MMKV: the save document is the only persistence',
    '  store-bypasses-save   a store or the game host touches SQLite or the SaveStore directly',
    '  cross-section-write   a run end or reset written with save.update instead of updateAndPublish (stores go stale)',
    '',
    'The repo root is the positional argument (default ".").',
    '',
    'Example: node check-stores.mjs .',
  ].join('\n'),
};

const SHELL = 'packages/shell/src';
const REQUIRED = [
  'app/stores-context.tsx',
  'stores/settings-reducer.ts',
  'stores/settings-store.ts',
  'stores/settings-selectors.ts',
  'stores/progress-reducer.ts',
  'stores/progress-store.ts',
  'stores/progress-selectors.ts',
  'stores/stats-reducer.ts',
  'stores/stats-store.ts',
  'stores/stats-selectors.ts',
  'stores/create-shell-stores.ts',
  'stores/update-and-publish.ts',
  'game-host/game-session-types.ts',
  'game-host/game-session-reducer.ts',
  'game-host/game-session-store.ts',
  'game-host/saved-run.ts',
  'game-host/run-writer.ts',
].map((rel) => `${SHELL}/${rel}`);

const DOMAIN_FACTORIES = /\bcreate(Settings|Progress|Stats|Premium)Store\s*\(/g;
const STORE_HOOK = 'use[A-Z][A-Za-z]*Store|useStore|useGameSession';
const isTest = (rel) => /\.test\.tsx?$/.test(rel);
const isPremium = (rel) => rel.includes('/stores/premium/');

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  requireDir(join(root, SHELL), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-stores', json: options.json });
  // The Shell source and the apps; the shared repo-scan ignores keep out the skill library, .claude/
  // and each app's generated ios/, android/, build/ and out/.
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: REPO_SCAN_IGNORES }).filter(
    (rel) => rel.startsWith(`${SHELL}/`) || rel.startsWith('apps/'),
  );
  const text = new Map(files.map((rel) => [rel, maskComments(readFileSync(join(root, rel), 'utf8'))]));
  const problem = (file, index, rule, message, fix) =>
    report.problem({ file, line: index === 0 ? 1 : lineOf(text.get(file) ?? '', index), rule, message, fix });

  for (const rel of REQUIRED) {
    if (!text.has(rel)) {
      report.problem({ file: rel, line: 0, rule: 'missing-file', message: 'required store file is missing', fix: 'Copy it from the skill templates (templates/packages/shell/src/...) and adapt it.' });
    }
  }
  const builders = collectBuilders(text);
  for (const [rel, source] of text) {
    checkImports(rel, source, problem);
    if (!isTest(rel)) checkSingletons(rel, source, problem);
    if (/\/(stores|game-host)\/.*-store\.ts$/.test(rel) && !isPremium(rel)) checkPersistOrder(rel, source, problem);
    if (/-(reducer|selectors)\.ts$/.test(rel) && !isTest(rel)) checkPurity(rel, source, problem);
    if (/\/stores\/[^/]+-reducer\.ts$/.test(rel) || rel.endsWith('/game-host/game-session-types.ts')) checkActionNames(rel, source, problem);
    checkSelectors(rel, source, builders, problem);
    if (!isTest(rel)) checkCrossSectionWrites(rel, source, problem);
  }
  checkTests(text, problem);
  return report.finish({ checked: files.length, unit: 'source files' });
});

function collectBuilders(text) {
  const builders = new Map();
  for (const [rel, source] of text) {
    if (!rel.endsWith('-selectors.ts')) continue;
    for (const [name] of objectBuildingSelectors(source)) builders.set(name, rel);
  }
  return builders;
}

function checkImports(rel, source, problem) {
  for (const match of source.matchAll(/from\s+'(zustand\/middleware|@react-native-async-storage\/async-storage|react-native-mmkv)'/g)) {
    problem(rel, match.index, 'second-persistence', `imports ${match[1]}: a second place to persist state`, 'Persist through SaveService.update (the save document is the only persistence); stores are hydrated from save.doc().');
  }
  const isStoreOrHost = /\/(stores|game-host)\//.test(rel) && !isTest(rel);
  if (!isStoreOrHost) return;
  for (const match of source.matchAll(/import\s+(?!type\b)[^;]*?from\s+'(expo-sqlite[^']*|@e07\/shell\/services\/save\/(?:sqlite-save-store|sql-driver|expo-sqlite-sql-driver|fake-save-store)\.ts)'/g)) {
    problem(rel, match.index, 'store-bypasses-save', `imports ${match[1]}`, 'Stores and the game host write only through SaveService.update(recipe); only services/save talks to SQLite.');
  }
  for (const match of source.matchAll(/\b\w*[sS]tore\.write\s*\(/g)) {
    problem(rel, match.index, 'store-bypasses-save', 'writes a SaveStore row directly', 'Call save.update(recipe) instead: it validates, guards Premium and writes in one transaction.');
  }
}

function checkSingletons(rel, source, problem) {
  for (const match of source.matchAll(/import\s*\{[^}]*\bcreate\b[^}]*\}\s*from\s*'zustand'/g)) {
    problem(rel, match.index, 'store-singleton', "imports create from 'zustand' (a module-level hook store)", "Use createStore from 'zustand/vanilla' inside a create<Domain>Store(save) factory, provided through StoresProvider.");
  }
  // The one allowed module-level store mirrors OS switches (not save data): the a11y mirror.
  const isOsMirror = rel === `${SHELL}/app/system-a11y-store.ts`;
  for (const match of isOsMirror ? [] : source.matchAll(/^(?:export\s+)?const\s+\w+\s*=\s*createStore\b/gm)) {
    problem(rel, match.index, 'store-singleton', 'a store created at module level (a singleton shared by every test and every app start)', 'Wrap it in a factory function and create it once in createShellStores(save) (or per run in the game host).');
  }
  if (rel.endsWith('/stores/create-shell-stores.ts')) return;
  for (const match of source.matchAll(DOMAIN_FACTORIES)) {
    if (/function\s+$/.test(source.slice(Math.max(0, match.index - 12), match.index))) continue;
    problem(rel, match.index, 'store-created-twice', `calls create${match[1]}Store outside create-shell-stores.ts`, 'Create every domain store once with createShellStores(save) (composition root and renderWithShell); read them through useStores().');
  }
}

function checkPersistOrder(rel, source, problem) {
  const start = source.search(/\bdispatch\s*:/);
  if (start === -1) return;
  const body = source.slice(start);
  const write = body.search(/\b(save\.update|persist)\s*\(/);
  const publish = body.search(/\bset\s*\(/);
  if (write === -1) {
    problem(rel, start, 'store-persist-order', 'dispatch never writes the save', 'Reduce -> save.update(recipe) (or the persist callback) -> set(next): the screen must never show a value that is not on disk.');
  } else if (publish !== -1 && publish < write) {
    problem(rel, start + publish, 'store-persist-order', 'dispatch publishes (set) before it writes the save', 'Move save.update(...) / persist(...) above set(...): persist first, publish second.');
  }
}

function checkPurity(rel, source, problem) {
  for (const match of source.matchAll(/import\s+(?!type\b)[^;]*?from\s+'([^']+)'/g)) {
    const spec = match[1];
    const isBanned = /^(react|react-native|zustand|expo)(\/|$)|^expo-|^@e07\/shell\/(app|services)\//.test(spec) && !spec.startsWith('@e07/shell/services/save/schema/');
    if (isBanned) {
      problem(rel, match.index, 'reducer-impure', `imports ${spec}`, 'Reducers and selectors are pure functions over plain data: import only types and other pure modules (schema defaults are fine).');
    }
  }
  for (const match of source.matchAll(/\b(Date\.now|new\s+Date|Math\.random|performance\.now)\s*\(/g)) {
    problem(rel, match.index, 'reducer-impure', `calls ${match[1].replace(/\s+/g, ' ')}()`, 'Pass the time in the action (for example { type: "use-free-hint", today }); the clock is ClockPort.');
  }
}

function checkActionNames(rel, source, problem) {
  for (const match of source.matchAll(/\btype\s*:\s*'([^']+)'/g)) {
    const name = match[1];
    const words = name.split('-');
    const isEvent = [words[0], words.at(-1)].some((word) => /(?<!e)ed$/.test(word ?? ''));
    if (!/^[a-z]+(-[a-z0-9]+)*$/.test(name)) {
      problem(rel, match.index, 'action-name', `action "${name}" is not kebab-case`, 'Use lowercase words joined by hyphens: set-theme, record-level-result.');
    } else if (isEvent || ['on', 'handle', 'did', 'was'].includes(words[0])) {
      problem(rel, match.index, 'action-name', `action "${name}" is not an imperative verb`, 'Name the command, not the event: set-<field>, toggle-<flag>, reset-<thing>, record-<fact>, use-<thing>.');
    }
  }
}

function checkSelectors(rel, source, builders, problem) {
  for (const call of findCalls(source, STORE_HOOK)) {
    const { callee, args } = call;
    if (/^use[A-Z]\w*Store$/.test(callee) && args.length === 0) {
      problem(rel, call.index, 'selector-missing', `${callee}() without a selector re-renders on every change`, `Pass a selector: ${callee}((state) => state.some.primitive).`);
      continue;
    }
    if (callee === 'useStore' || callee === 'useGameSession') {
      if (args.length < 2) {
        problem(rel, call.index, 'selector-missing', `${callee}(store) without a selector`, `Pass a selector: ${callee}(store, (state) => ...).`);
        continue;
      }
      if (args.length > 2) {
        problem(rel, call.index, 'shallow-v4', `${callee} with an equality argument (Zustand 4 style)`, 'Zustand 5 ignores it: wrap the selector in useShallow instead.');
      }
    }
    const selector = /^use[A-Z]\w*Store$/.test(callee) ? args[0] : args[1];
    if (selector === undefined || /^useShallow\s*\(/.test(selector)) continue;
    const builder = [...builders.keys()].find((name) => new RegExp(`\\b${name}\\b`).test(selector));
    if (builder !== undefined || (/=>/.test(selector) && buildsNewValue(selector.slice(selector.indexOf('=>'))))) {
      problem(rel, call.index, 'selector-new-object', `${callee}(${abbreviate(selector)}) builds a new ${builder ? `value (${builder})` : 'object or array'} on every call`, `Wrap it: ${callee}(useShallow((state) => ...)) with useShallow from 'zustand/shallow', or select primitives one by one.`);
    }
  }
}

/** Writes that change several sections must re-publish every section store (updateAndPublish). */
function checkCrossSectionWrites(rel, source, problem) {
  if (rel.endsWith('/stores/update-and-publish.ts')) return;
  const CROSS_SECTION = /\b(applyRunEnd|resetAllProgress)\s*\(/;
  const writes = findCalls(source, 'save\\.update');
  const direct = writes.find((call) => CROSS_SECTION.test(call.args[0] ?? ''));
  // A recipe held in a variable (save.update(recipe, ...)) is the indirect form; an inline recipe
  // without applyRunEnd is another write (the game host's per-move run writes) and passes.
  const passesRecipe = (call) => /^[A-Za-z_$][\w$.]*$/.test((call.args[0] ?? '').trim());
  const isIndirect = direct === undefined && writes.some(passesRecipe) && CROSS_SECTION.test(source) && !/\bupdateAndPublish\s*\(/.test(source);
  const indirectCall = writes.find(passesRecipe);
  const call = direct ?? (isIndirect ? indirectCall : undefined);
  if (call === undefined) return;
  const what = CROSS_SECTION.exec(direct?.args[0] ?? source)?.[1];
  problem(rel, call.index, 'cross-section-write', `writes ${what}(...) with save.update, so the progress, stats and settings stores keep their old sections`, 'Call updateAndPublish(save, stores, { recipe: (doc) => ' + what + '(doc, ...), refreshBackup: true }): one validated write, then every section store re-reads the document.');
}

function checkTests(text, problem) {
  for (const rel of text.keys()) {
    if (isTest(rel)) continue;
    const dir = dirname(rel);
    const stem = basename(rel).replace(/\.tsx?$/, '');
    const hasTest = text.has(`${dir}/${stem}.test.ts`) || text.has(`${dir}/${stem}.test.tsx`);
    if (/-reducer$/.test(stem) && rel.startsWith(`${SHELL}/`) && !hasTest) {
      problem(rel, 0, 'reducer-untested', `${stem}.ts has no ${stem}.test.ts`, 'Write one example test per action (and fast-check properties where they apply) next to the reducer.');
    }
    if (/\/stores\/[^/]+-store\.ts$/.test(rel) && /\bsave\.update\s*\(/.test(text.get(rel)) && !hasTest) {
      problem(rel, 0, 'reducer-untested', `${stem}.ts persists but has no ${stem}.test.ts`, 'Add a thin store test: a subscriber sees the value already on disk (persist before publish).');
    }
  }
}

function abbreviate(selector) {
  const flat = selector.replace(/\s+/g, ' ');
  return flat.length > 48 ? `${flat.slice(0, 45)}...` : flat;
}

