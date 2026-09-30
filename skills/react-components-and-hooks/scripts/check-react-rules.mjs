#!/usr/bin/env node
// check-react-rules.mjs: checks React components and hooks in the Shell and the apps for the
// Pocket Arcade React rules that are easy to break and that the lint config does not (or not
// fully) cover: memo APIs, shared values, hooks in the right files, read-only props, testIDs,
// store selectors, effects that clean up, pure renders, lists, canvases and banned imports.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-react-rules.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import {
  REPO_SCAN_IGNORES,
  createReporter,
  lineOf,
  maskComments,
  parseArgs,
  requireDir,
  run,
  toPosix,
  walk,
} from './check-lib.mjs';
import { extractBlock } from './lib/object-literal.mjs';

const SPEC = {
  name: 'check-react-rules',
  summary: 'Checks .ts/.tsx runtime files (tests excluded) against the React component and hook rules.',
  usage: '[options] [repo-root | folder...]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON before the RESULT line' } },
  positionals: { min: 0, max: Infinity },
  details: [
    'The repo root (default ".") is scanned in packages/shell/src and apps/, skipping the shared repo-scan',
    'ignores (skills/, .claude/, node_modules, Pods, .expo and each app\'s generated ios/, android/, build/,',
    'out/). A path without packages/shell/src (or several paths) is scanned as a source folder instead.',
    '',
    'Rules:',
    '  no-memo-apis          no useMemo, useCallback or memo: React Compiler memoizes',
    "  use-no-memo           'use no memo' only with a // use-no-memo-test: <test name> comment in the file",
    '  shared-value-get-set  Reanimated shared values are read and written with .get() / .set(), never .value',
    '  class-component       function components only (the one exception: app/shell-error-boundary.tsx)',
    '  hook-file             exported hooks live in use-<name>.ts(x) (or *-store.ts, *-context.ts(x), navigation *-guards.ts); use-<name> exports useName',
    '  props-readonly        every field of a *Props type is readonly',
    '  testid-required       a ui/ component that renders a Pressable takes a required testID: string',
    '  no-hitslop            touch boxes are 44 x 44 pt themselves; hitSlop is invisible and overlaps neighbours',
    '  pressed-destructure   write style={(state) => [..., state.pressed && ...]}, not ({ pressed })',
    '  no-isrtl              never read I18nManager.isRTL (use useDirection / readLayoutDirection)',
    '  banned-import         FlashList, react-native-svg, Dimensions, SafeAreaView and Text from react-native, FlatList/SectionList,',
    "                        Reanimated's useReducedMotion, Pressable outside ui/",
    '  list-key-index        list keys are stable ids, never the array index',
    '  canvas-budget         at most 8 Skia <Canvas> per file outside the board',
    '  effect-cleanup        an effect that subscribes (listener, subscribe, watch*, timer) returns its cleanup',
    '  render-impure         no Date.now(), new Date(), Math.random() or performance.now() in component files',
    '  ui-boundary           ui/ never imports stores/, screens/ or services/ (port type files *-port.ts excepted)',
    '  store-selector        store hooks always get a selector',
    '  object-selector       a selector that builds an object is wrapped in useShallow',
  ].join('\n'),
};

const read = (abs) => readFileSync(abs, 'utf8');
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function importsFrom(text, module) {
  const out = [];
  const re = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*['"]${module.replace(/[/.]/g, (c) => `\\${c}`)}['"]`, 'g');
  for (const match of text.matchAll(re)) {
    for (const name of match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '')).filter(Boolean)) {
      out.push({ name, index: match.index });
    }
  }
  return out;
}

function checkImports(ctx, file) {
  const { text, rel } = file;
  const add = (index, rule, message, fix) => ctx.problem(file, index, rule, message, fix);
  for (const { name, index } of importsFrom(text, 'react')) {
    if (['useMemo', 'useCallback', 'memo'].includes(name)) add(index, 'no-memo-apis', `imports ${name}`, 'Delete it: React Compiler memoizes JSX, handlers and derived values. A measured need goes through an ESLint exemption with the measurement.');
  }
  for (const match of text.matchAll(/\bReact\.(useMemo|useCallback|memo)\s*\(/g)) add(match.index, 'no-memo-apis', `calls React.${match[1]}`, 'Delete it: React Compiler memoizes.');
  const rn = importsFrom(text, 'react-native');
  for (const { name, index } of rn) {
    if (name === 'Dimensions') add(index, 'banned-import', 'imports Dimensions', 'Use useWindowDimensions()/useWindowClass() or onLayout: windows resize (iPad, iOS 27).');
    if (name === 'SafeAreaView') add(index, 'banned-import', "imports SafeAreaView from 'react-native' (deprecated)", 'Put the screen in ScreenFrame (react-native-safe-area-context).');
    if (['FlatList', 'SectionList', 'VirtualizedList'].includes(name)) add(index, 'banned-import', `imports ${name}`, 'v1 has no unbounded list: render a ScrollView with every item mounted (levels grid measured faster).');
    if (name === 'Text' && !rel.endsWith('ui/app-text.tsx')) add(index, 'banned-import', 'imports Text from react-native', 'Render text with AppText (direction, font, scaling in one place).');
    if (name === 'Pressable' && !/(^|\/)ui\//.test(rel)) add(index, 'banned-import', 'imports Pressable outside ui/', 'Use the ui/ primitives (RaisedSurface-based buttons, IconButton, ListRow).');
  }
  for (const { name, index } of importsFrom(text, 'react-native-reanimated')) {
    if (name === 'useReducedMotion') add(index, 'banned-import', "imports Reanimated's useReducedMotion (a load-time constant)", 'Use useReduceMotion() from app/use-reduce-motion.ts.');
  }
  for (const match of text.matchAll(/from\s+['"](@shopify\/flash-list|react-native-svg)['"]/g)) add(match.index, 'banned-import', `imports ${match[1]}`, match[1] === 'react-native-svg' ? 'Icons are Skia paths rendered by Icon; art is a Skia canvas.' : 'No v1 list needs recycling; use a ScrollView.');
  if (/(^|\/)ui\//.test(rel)) {
    for (const match of text.matchAll(/from\s+['"]@e07\/shell\/(stores|screens|services)\/([^'"]+)['"]/g)) {
      if (match[1] === 'services' && /-port\.ts$/.test(match[2])) continue;
      add(match.index, 'ui-boundary', `ui/ imports @e07/shell/${match[1]}/${match[2]}`, 'ui/ stays presentational: take data and callbacks as props (a port type file is the only exception).');
    }
  }
}

function checkPatterns(ctx, file) {
  const { text, raw, rel } = file;
  const add = (index, rule, message, fix) => ctx.problem(file, index, rule, message, fix);
  if (/['"]use no memo['"]/.test(text) && !/use-no-memo-test:/.test(raw)) {
    add(text.search(/['"]use no memo['"]/), 'use-no-memo', "'use no memo' without its failing test", 'Add // use-no-memo-test: <test name>, the Open-issues entry, and remove all three together later.');
  }
  for (const decl of text.matchAll(/\bconst\s+(\w+)\s*=\s*use(Shared|Derived)Value\s*\(/g)) {
    for (const use of text.matchAll(new RegExp(`\\b${decl[1]}\\.value\\b`, 'g'))) add(use.index, 'shared-value-get-set', `${decl[1]}.value`, `Use ${decl[1]}.get() / ${decl[1]}.set(...).`);
  }
  for (const match of text.matchAll(/\bclass\s+\w+\s+extends\s+(React\.)?(Component|PureComponent)\b/g)) {
    if (!rel.endsWith('app/shell-error-boundary.tsx')) add(match.index, 'class-component', 'a class component', 'Write a function component; the error boundary is the only class.');
  }
  for (const match of text.matchAll(/\bhitSlop\b/g)) add(match.index, 'no-hitslop', 'hitSlop on a touch target', 'Give the Pressable itself minWidth/minHeight MIN_TOUCH (44).');
  for (const match of text.matchAll(/\(\s*\{\s*pressed\s*\}\s*\)/g)) add(match.index, 'pressed-destructure', 'destructures ({ pressed })', 'Write style={(state) => [styles.base, state.pressed && styles.pressed]}.');
  for (const match of text.matchAll(/\bisRTL\b/g)) {
    if (!rel.endsWith('i18n/direction.ts')) add(match.index, 'no-isrtl', 'reads isRTL', 'Use useDirection() in components or readLayoutDirection() outside React.');
  }
  for (const index of indexKeys(text)) add(index, 'list-key-index', 'a list key is the array index', 'Key by a stable id (the level number, the row id).');
  const canvases = [...text.matchAll(/<Canvas\b/g)];
  if (canvases.length > 8) add(canvases[8].index, 'canvas-budget', `${canvases.length} Skia canvases in one file`, 'Rasterize repeated icons (Icon); keep canvases for art, at most 8 per screen.');
  if (rel.endsWith('.tsx')) {
    for (const match of text.matchAll(/\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bMath\.random\s*\(|\bperformance\.now\s*\(/g)) add(match.index, 'render-impure', `${match[0].replace(/\s*\($/, '')}() in a component file`, 'Take time from ClockPort and randomness from the seeded PRNG, outside render.');
  }
  for (const match of text.matchAll(/\buse[A-Z]\w*Store\s*\(\s*\)|\buseStore\s*\(\s*[\w.]+\s*\)/g)) add(match.index, 'store-selector', `${match[0]} without a selector`, 'Pass a selector: useSettingsStore(selectThemePreference).');
  for (const match of text.matchAll(/\buse(?:[A-Z]\w*)?Store\s*\(\s*(?:[\w.]+\s*,\s*)?\(\s*\w*\s*\)\s*=>\s*\(\s*\{/g)) add(match.index, 'object-selector', 'an inline selector builds a new object on every call', 'Wrap it: useXStore(useShallow((state) => ({ ... }))), or select primitives one by one.');
}

const ESCAPE = (name) => name.replace(/[$]/g, '\\$');

/**
 * Where a list callback keys its items by the callback's index parameter:
 * `items.map((item, index) => <X key={index} />)`, also `String(index)`, `index.toString()` and
 * templates holding `${index}`. A first parameter that happens to be called `index` (mapping a
 * constant list of numbers) is data, not an index, and passes; so does a positional series made
 * with Array.from({ length }, …), whose place is its only identity.
 */
function indexKeys(text) {
  const hits = [];
  // The first parameter may be a name or a destructuring pattern; the second is the index.
  const first = String.raw`(?:[A-Za-z_$][\w$]*|\{[^{}]*\}|\[[^\[\]]*\])\s*(?::[^,()]+)?`;
  // Lists of data: items.map(cb) and items.flatMap(cb). A positional series built with
  // Array.from({ length }, (_, i) => …) (pager dots, filler cells) has no identity but its place.
  const call = String.raw`\.(?:map|flatMap)\(`;
  const callbacks = new RegExp(
    String.raw`${call}\s*(?:\(\s*${first},\s*([A-Za-z_$][\w$]*)|function\s*\(\s*${first},\s*([A-Za-z_$][\w$]*))`,
    'g',
  );
  for (const match of text.matchAll(callbacks)) {
    const name = ESCAPE(match[1] ?? match[2]);
    const open = text.indexOf('(', match.index);
    const call = extractBlock(text, open);
    const body = call === null ? text.slice(open) : call.inner;
    const keyed = new RegExp(
      `\\bkey=\\{\\s*(?:${name}|String\\(\\s*${name}\\s*\\)|${name}\\.toString\\(\\s*\\)|\`[^\`]*\\$\\{\\s*(?:String\\(\\s*)?${name}\\b[^\`]*\`)\\s*\\}`,
      'g',
    );
    for (const key of body.matchAll(keyed)) hits.push(open + 1 + key.index);
  }
  return hits;
}

function checkEffects(ctx, file) {
  const { text } = file;
  for (const match of text.matchAll(/\buse(?:Layout)?Effect\s*\(\s*\(\s*\)\s*=>\s*\{/g)) {
    const block = extractBlock(text, match.index + match[0].length - 1);
    if (!block) continue;
    const subscribes = /addEventListener\s*\(|\.subscribe\s*\(|\bwatch[A-Z]\w*\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(/.test(block.inner);
    if (subscribes && !/\breturn\b/.test(block.inner)) ctx.problem(file, match.index, 'effect-cleanup', 'the effect subscribes but returns no cleanup', 'Return the unsubscribe (listener.remove(), unsubscribe(), clearInterval).');
  }
}

function checkHooksAndProps(ctx, file) {
  const { text, rel } = file;
  const name = basename(rel).replace(/\.(tsx?)$/, '');
  const exported = [...text.matchAll(/export\s+(?:function\s+(use[A-Z]\w*)|const\s+(use[A-Z]\w*)\s*=)/g)].map((match) => ({ hook: match[1] ?? match[2], index: match.index }));
  const allowedHost = name.startsWith('use-') || /-(store|context|guards)$/.test(name);
  for (const { hook, index } of exported) {
    if (!allowedHost) ctx.problem(file, index, 'hook-file', `exports ${hook} from ${basename(rel)}`, `Move it to ${kebab(hook)}.ts (one hook per use-<name> file).`);
  }
  if (name.startsWith('use-') && !rel.includes('.test.') && !exported.some(({ hook }) => kebab(hook) === name)) {
    ctx.problem(file, 0, 'hook-file', `${basename(rel)} does not export ${name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())}`, 'Name the file after the hook it exports: use-hold-to-confirm.ts exports useHoldToConfirm.');
  }
  for (const match of text.matchAll(/export\s+type\s+(\w+Props)\s*=\s*\{/g)) {
    const block = extractBlock(text, match.index + match[0].length - 1);
    if (!block) continue;
    let depth = 0;
    let offset = match.index + match[0].length;
    for (const line of block.inner.split('\n')) {
      if (depth === 0 && /^\s*(?!readonly\b)[A-Za-z_$][\w$]*\??\s*:/.test(line)) {
        ctx.problem(file, offset, 'props-readonly', `${match[1]}.${line.trim().split(/[?:]/)[0]} is not readonly`, 'Prefix every prop with readonly (and use readonly T[] for arrays): mutation then fails tsc.');
      }
      depth += (line.match(/[{(<[]/g) ?? []).length - (line.match(/[})>\]]/g) ?? []).length;
      offset += line.length + 1;
    }
    if (/(^|\/)ui\//.test(rel) && /<Pressable\b/.test(text) && !/readonly\s+testID\s*:\s*string/.test(block.inner)) {
      ctx.problem(file, match.index, 'testid-required', `${match[1]} has no required testID`, 'Add readonly testID: string: Maestro and the screen contract select by testID.');
    }
  }
}

const NOT_RUNTIME = ['*.d.ts', '*.test.ts', '*.test.tsx', '__mocks__', 'testing'];
const REPO_SOURCES = /^(packages\/shell\/src|apps)\//;

/** The runtime files to check, as [scan root, path under it]: a repo root, or given folders. */
function filesToCheck(positionals) {
  const only = positionals.length <= 1 ? requireDir(positionals[0] ?? '.', 'repo root') : null;
  if (only !== null && existsSync(join(only, 'packages', 'shell', 'src'))) {
    const files = walk(only, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, ...NOT_RUNTIME] });
    return files.filter((rel) => REPO_SOURCES.test(rel)).map((rel) => [only, rel]);
  }
  const roots = positionals.map((folder) => requireDir(folder, 'source folder'));
  return roots.flatMap((root) => walk(root, { include: ['*.ts', '*.tsx'], ignore: NOT_RUNTIME }).map((rel) => [root, rel]));
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const report = createReporter({ name: 'check-react-rules', json: options.json });
  let checked = 0;
  for (const [root, rel] of filesToCheck(positionals)) {
    const abs = join(root, rel);
    const raw = read(abs);
    const shown = toPosix(relative(process.cwd(), abs)) || rel;
    const file = { rel: toPosix(join(toPosix(relative(process.cwd(), root)), rel)), raw, text: maskComments(raw), shown };
    const ctx = {
      problem: (target, index, rule, message, fix) => report.problem({ file: target.shown, line: lineOf(target.text, index), rule, message, fix }),
    };
    checkImports(ctx, file);
    checkPatterns(ctx, file);
    checkEffects(ctx, file);
    checkHooksAndProps(ctx, file);
    checked += 1;
  }
  return report.finish({ checked, unit: 'files' });
});
