#!/usr/bin/env node
// check-board-input.mjs: checks the board input code of a Pocket Arcade app repo against the rules of
// the board-gestures-and-input skill (one gesture file, one intent per gesture, hit-testing, pure
// intentToMove, touch targets, Gesture Handler API version).
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs [repo-root] [--game <id>]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, readShellSlice, requireDir, run, sliceSkipReason, walk } from './check-lib.mjs';
import { balancedParens, hasWorkletDirective, isTestFile, readRepoFile, resolveSpecifier, valueImports } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-board-input',
  summary: 'Checks board input code (packages/shell/src, apps/*/src) for the input rules: gestures only in use-board-gestures.ts, at most one intent per gesture, hit-testing through the board layout with slop, physical coordinates, pure and exhaustive intentToMove, 44 pt touch targets, and the Gesture Handler API matching the installed major version.',
  usage: '[options] [repo-root]',
  options: {
    game: { type: 'string', multiple: true, value: 'id', help: "Only check these games' files (apps/<id>/src) beside the Shell input kit (default: every apps/<id> with src/)" },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  input-file-missing     the input kit exists: input-intent.ts, classify-swipe.ts, stick-command.ts, pan-intent.ts, use-board-gestures.ts (+ test), board-gesture-probe.tsx',
    '  input-worklet          classify-swipe.ts, stick-command.ts and pan-intent.ts (called from gesture worklets) start with \'worklet\'; and import values only from \'worklet\' modules',
    '  gesture-one-file       board gesture builders and hooks appear only in packages/shell/src/game-host/use-board-gestures.ts (ui/ controls such as the Slider excepted)',
    '  gesture-test-id        every board gesture builder has .withTestId(\'board.<kind>\')',
    '  intent-on-update       onUpdate/onChange never emit an intent (one intent per gesture, on start or end)',
    '  hit-test-slop          hitTest(...) reads the shared board layout and passes HIT_SLOP',
    '  physical-coords        gesture code never flips for RTL (BoardLayout mirrors positions)',
    '  pressable-in-detector  no Pressable or Shell button inside a <GestureDetector>',
    '  gesture-root           the Shell wraps the app in <GestureHandlerRootView> (SKIP while shell-slice.json has "screens": [])',
    '  intent-to-move         every turn-based game has rules/intent-to-move.ts exporting intentToMove, with a test',
    '  intent-pure            intent-to-move.ts imports no React, React Native, Expo, Skia or Shell code',
    '  intent-exhaustive      intent-to-move.ts handles every intent kind (tap, long-press, swipe, drag-end, aim)',
    '  touch-target-test      every game with tappable regions tests its smallest hit region >= 44 pt at 402 x 874 pt',
    '  rngh-api-version       builder API with Gesture Handler 2.x, hook API with 3.x, never mixed',
    '  worklets-api           input code talks to JS with scheduleOnRN (never runOnJS/runOnUI) and to shared values with .get()/.set() (never .value)',
    '',
    'A game-first repo (shell-slice.json with "screens": []) has no Shell app yet: gesture-root prints SKIP and counts as a pass.',
    'Examples: node check-board-input.mjs .   node check-board-input.mjs . --game line-siege',
  ].join('\n'),
};

const GESTURE_FILE = 'packages/shell/src/game-host/use-board-gestures.ts';
const INPUT_FILES = [
  'packages/game-kit/src/contract/input-intent.ts',
  'packages/game-kit/src/geom/classify-swipe.ts',
  'packages/game-kit/src/geom/stick-command.ts',
  'packages/shell/src/game-host/pan-intent.ts',
  GESTURE_FILE,
  'packages/shell/src/game-host/use-board-gestures.test.tsx',
  'packages/shell/src/game-host/board-gesture-probe.tsx',
];
/** Modules the gesture callbacks call on the UI thread: a plain JS function there throws at runtime. */
const UI_THREAD_INPUT = ['packages/game-kit/src/geom/classify-swipe.ts', 'packages/game-kit/src/geom/stick-command.ts', 'packages/shell/src/game-host/pan-intent.ts'];
const DIRECTION_FREE = [GESTURE_FILE, 'packages/shell/src/game-host/pan-intent.ts', 'packages/game-kit/src/geom/classify-swipe.ts', 'packages/game-kit/src/geom/stick-command.ts'];
const BUILDERS = /\bGesture\.(Tap|Pan|LongPress|Fling|Pinch|Rotation|Hover|Manual|Native|ForceTouch|Exclusive|Simultaneous|Race)\s*\(/g;
const V3_HOOKS = /\buse(Tap|Pan|LongPress|Fling|Pinch|Rotation|Hover|Manual|Native)Gesture\s*\(|\buse(Exclusive|Simultaneous|Competing)Gestures\s*\(/g;
const INTENT_KINDS = ['tap', 'long-press', 'swipe', 'drag-end', 'aim'];
const IMPURE = /^(react|react-native|react-native-.+|@react-native\/.+|expo|expo-.+|@expo\/.+|@shopify\/.+|@e07\/shell(\/.*)?)$/;

const read = (root, rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);

function checkEverywhere(root, files, report) {
  for (const rel of files) {
    if (rel === GESTURE_FILE || isTestFile(rel)) continue;
    const source = read(root, rel);
    const code = maskComments(source);
    // The Shell's ui/ controls (the Settings volume Slider) are not boards: they own their gesture.
    const isUiControl = rel.startsWith('packages/shell/src/ui/');
    for (const re of isUiControl ? [] : [BUILDERS, V3_HOOKS]) {
      for (const match of code.matchAll(re)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'gesture-one-file', message: `builds a gesture outside use-board-gestures.ts (${match[0].replace(/\s*\($/, '')})`, fix: 'Add the gesture to packages/shell/src/game-host/use-board-gestures.ts (the only gesture file) and consume its intents.' });
    }
    if (rel.endsWith('.tsx')) checkDetectorChildren(rel, code, report);
  }
}

function checkDetectorChildren(rel, code, report) {
  for (const open of code.matchAll(/<GestureDetector\b/g)) {
    const close = code.indexOf('</GestureDetector>', open.index);
    const inside = code.slice(open.index, close === -1 ? code.length : close);
    const touch = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Button|PrimaryButton|IconButton|TileButton)\b/.exec(inside);
    if (touch) report.problem({ file: rel, line: lineOf(code, open.index + touch.index), rule: 'pressable-in-detector', message: `<${touch[1]}> is rendered inside the board's GestureDetector`, fix: 'Make the canvas the only child of the GestureDetector and render Shell controls as its siblings.' });
  }
}

function checkGestureFile(root, report) {
  const source = read(root, GESTURE_FILE);
  if (source === null) return;
  const code = maskComments(source);
  const builders = [...code.matchAll(/\bGesture\.(Tap|Pan|LongPress|Fling|Manual)\s*\(\s*\)/g)];
  const ids = code.match(/\.withTestId\(\s*['"]board\.[a-z-]+['"]\s*\)/g) ?? [];
  if (ids.length < builders.length) report.problem({ file: GESTURE_FILE, line: lineOf(code, builders[0]?.index ?? 0), rule: 'gesture-test-id', message: `${builders.length} gesture builders but only ${ids.length} .withTestId('board.<kind>')`, fix: "Give every builder a test id: .withTestId('board.tap'), 'board.long-press', 'board.pan', 'board.stick'." });
  for (const match of code.matchAll(/\.(onUpdate|onChange)\s*\(/g)) {
    const body = balancedParens(code, match.index + match[0].length - 1) ?? '';
    if (/\bonIntent\b/.test(body)) report.problem({ file: GESTURE_FILE, line: lineOf(code, match.index), rule: 'intent-on-update', message: `.${match[1]}() emits an intent, so one gesture can produce many moves`, fix: 'Only update the pointer (and report hover changes) in onUpdate; emit the single intent in onEnd (or onStart for long press).' });
  }
  checkHitTests(GESTURE_FILE, code, report);
}

function checkHitTests(rel, code, report) {
  for (const match of code.matchAll(/\bhitTest\s*\(/g)) {
    const args = balancedParens(code, match.index + match[0].length - 1) ?? '';
    if (!/^\s*layout(\.get\(\))?\s*,/.test(args) || !/\bHIT_SLOP\b/.test(args)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'hit-test-slop', message: 'hitTest() does not use the shared board layout with HIT_SLOP', fix: 'Call hitTest(layout.get(), point, HIT_SLOP): the same layout the picture draws with, and 8 pt slop for edge taps.' });
  }
}

function checkPhysical(root, report) {
  for (const rel of DIRECTION_FREE) {
    const source = read(root, rel);
    if (source === null) continue;
    const code = maskComments(source);
    if (rel.endsWith('pan-intent.ts')) checkHitTests(rel, code, report);
    for (const match of code.matchAll(/\b(isRtl|isRTL|I18nManager|isMirrored|forceRTL)\b/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'physical-coords', message: `gesture code reads ${match[1]}; touches are physical and must not flip for RTL`, fix: 'Remove the direction logic: BoardLayout.hitTest mirrors positions for boards that opt in (isMirroredInRtl).' });
  }
}

function checkInputWorklets(root, report) {
  for (const rel of UI_THREAD_INPUT) {
    const source = read(root, rel);
    if (source === null) continue;
    if (!hasWorkletDirective(source)) {
      report.problem({ file: rel, line: 1, rule: 'input-worklet', message: "gesture callbacks call this module on the UI thread, but it has no file-level 'worklet'; directive (it would throw at runtime, not in Jest)", fix: "Put 'worklet'; as the first statement, right after the // path comment." });
      continue;
    }
    for (const { spec, index } of valueImports(source)) {
      const target = resolveSpecifier(rel, spec);
      const targetSource = target === null ? null : readRepoFile(root, target);
      if (target === null && spec !== 'react-native-worklets') report.problem({ file: rel, line: lineOf(source, index), rule: 'input-worklet', message: `'worklet' module imports a value from the package ${spec}`, fix: 'Use `import type` for types; only react-native-worklets may be imported as a value.' });
      else if (targetSource !== null && !hasWorkletDirective(targetSource)) report.problem({ file: rel, line: lineOf(source, index), rule: 'input-worklet', message: `'worklet' module imports a value from ${target}, which is not a 'worklet' module`, fix: "Add 'worklet'; to that module if it is pure, or move the helper into a 'worklet' module." });
    }
  }
}

/** The app root needs the Shell app itself: a game-first repo ("screens": []) skips it (D10). */
function checkRoot(root, shellFiles, report) {
  if (!existsSync(join(root, GESTURE_FILE))) return;
  const hasRoot = shellFiles.some((rel) => rel.endsWith('.tsx') && !isTestFile(rel) && /<GestureHandlerRootView\b/.test(read(root, rel)));
  if (hasRoot) return;
  const skip = sliceSkipReason(readShellSlice(root));
  if (skip !== null) report.skip({ file: 'packages/shell/src/app', rule: 'gesture-root', message: `${skip}: the app root comes with the Shell app` });
  else report.problem({ file: 'packages/shell/src/app', rule: 'gesture-root', message: 'no <GestureHandlerRootView> wraps the app, so board gestures never fire on device', fix: 'Wrap the Shell providers (the app root) in <GestureHandlerRootView style={{ flex: 1 }}>. In a game-first repo with no Shell app yet, declare shell-slice.json { "screens": [], "why": "..." }.' });
}

function checkIntentToMove(root, id, report) {
  const rel = `apps/${id}/src/rules/intent-to-move.ts`;
  const source = read(root, rel);
  if (source === null || !/export\s+function\s+intentToMove\b/.test(source)) {
    report.problem({ file: rel, rule: 'intent-to-move', message: 'the game has no pure intentToMove(state, intent) export', fix: "Copy this skill's templates/game/rules/intent-to-move.ts, adapt the legality, and test it." });
    return;
  }
  if (!existsSync(join(root, `apps/${id}/src/rules/intent-to-move.test.ts`))) report.problem({ file: `apps/${id}/src/rules/intent-to-move.test.ts`, rule: 'intent-to-move', message: 'intentToMove has no test', fix: "Copy templates/game/rules/intent-to-move.test.ts: each used intent kind, illegal targets, ignored kinds, and a legality property." });
  for (const { spec, index } of valueImports(source)) {
    if (IMPURE.test(spec)) report.problem({ file: rel, line: lineOf(source, index), rule: 'intent-pure', message: `intentToMove imports ${spec}; rules code is pure TypeScript`, fix: 'Import only @e07/game-kit and the game\'s own rules modules.' });
  }
  const code = maskComments(source);
  const missing = INTENT_KINDS.filter((kind) => !new RegExp(`['"]${kind}['"]`).test(code));
  if (missing.length > 0) report.problem({ file: rel, line: 1, rule: 'intent-exhaustive', message: `intentToMove does not name the intent kind(s) ${missing.join(', ')}`, fix: 'Switch over intent.kind and list every kind; return null explicitly for the ones this game ignores.' });
}

function checkTouchTargets(root, id, report) {
  const boardDir = `apps/${id}/src/board`;
  const layouts = readdirSync(join(root, boardDir)).filter((name) => /^layout[^.]*\.ts$/.test(name));
  const hasRegions = layouts.some((name) => /\bfitGrid\s*\(|\bregions\s*:\s*\[\s*\{/.test(read(root, `${boardDir}/${name}`)));
  if (!hasRegions) return; // free-form boards (aim, stick) have no tappable regions
  const tests = walk(join(root, `apps/${id}/src`), { include: ['*.test.ts', '*.test.tsx'] });
  const hasTest = tests.some((rel) => {
    const text = read(root, `apps/${id}/src/${rel}`);
    return /\b402\b/.test(text) && /\b874\b/.test(text) && /\b44\b/.test(text);
  });
  if (!hasTest) report.problem({ file: `apps/${id}/src/board/hit-targets.test.ts`, rule: 'touch-target-test', message: 'no test proves the smallest hit region is at least 44 pt on a 402 x 874 pt phone', fix: "Copy templates/game/board/hit-targets.test.ts and set LARGEST_VIEW to the game's biggest grid." });
}

/** Worklets 0.10 and React Compiler: scheduleOnRN instead of runOnJS, .get()/.set() instead of .value. */
function checkWorkletsApi(root, report) {
  for (const rel of [...new Set([...INPUT_FILES, ...DIRECTION_FREE, 'packages/shell/src/game-host/stick-gesture-probe.tsx'])]) {
    const source = read(root, rel);
    if (source === null || isTestFile(rel)) continue;
    const code = maskComments(source);
    for (const match of code.matchAll(/\brunOn(JS|UI)\b/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'worklets-api', message: `uses the deprecated runOn${match[1]}`, fix: 'Use scheduleOnRN(fn, ...args) from react-native-worklets (scheduleOnUI for the other direction).' });
    const shared = new Set([
      ...[...code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*use(?:SharedValue|DerivedValue)\b/g)].map((m) => m[1]),
      ...[...code.matchAll(/\b(\w+)\??\s*:\s*SharedValue\s*</g)].map((m) => m[1]),
      'pointer',
      'command',
    ]);
    for (const match of code.matchAll(/\b(\w+)\.value\b/g)) {
      if (shared.has(match[1])) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'worklets-api', message: `shared value ${match[1]} is accessed with .value`, fix: `Use ${match[1]}.get() / ${match[1]}.set(x) (React Compiler needs the accessors).` });
    }
  }
}

function checkApiVersion(root, report) {
  const source = read(root, GESTURE_FILE);
  if (source === null) return;
  const code = maskComments(source);
  for (const id of existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')) : []) {
    const pkg = read(root, `apps/${id}/package.json`);
    const version = pkg === null ? undefined : JSON.parse(pkg).dependencies?.['react-native-gesture-handler'];
    const major = /(\d+)\./.exec(version ?? '')?.[1];
    if (major === '2' && V3_HOOKS.test(code)) report.problem({ file: GESTURE_FILE, line: lineOf(code, code.search(V3_HOOKS)), rule: 'rngh-api-version', message: `apps/${id} installs Gesture Handler ${version}, but the gesture file uses the v3 hook API`, fix: 'Use the 2.x builder API (Gesture.Tap/Pan/LongPress, Gesture.Exclusive) until the SDK upgrade moves to 3.x.' });
    if (major === '3' && /\bGesture\.\w+\s*\(/.test(code)) report.problem({ file: GESTURE_FILE, line: lineOf(code, code.search(/\bGesture\.\w+\s*\(/)), rule: 'rngh-api-version', message: `apps/${id} installs Gesture Handler ${version}, but the gesture file uses the legacy builder API`, fix: 'Migrate use-board-gestures.ts to the v3 hooks as a whole (useTapGesture, usePanGesture, useExclusiveGestures).' });
    V3_HOOKS.lastIndex = 0;
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-board-input', json: options.json });
  const shellFiles = existsSync(join(root, 'packages/shell/src')) ? walk(join(root, 'packages/shell/src'), { include: ['*.ts', '*.tsx'] }).map((rel) => `packages/shell/src/${rel}`) : [];
  const allApps = existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')).filter((id) => existsSync(join(root, 'apps', id, 'src'))).sort() : [];
  for (const id of options.game) if (!allApps.includes(id)) fail(`game ${id} has no apps/${id}/src folder`, 'Pass an existing game id (the folder name under apps/).');
  // --game scopes the game side to those games; the Shell input kit is always checked.
  const apps = options.game.length > 0 ? [...new Set(options.game)].sort() : allApps;
  readShellSlice(root); // a malformed shell-slice.json stops here with exit 2
  const appFiles = apps.flatMap((id) => walk(join(root, 'apps', id, 'src'), { include: ['*.ts', '*.tsx'] }).map((rel) => `apps/${id}/src/${rel}`));
  const boards = apps.filter((id) => existsSync(join(root, 'apps', id, 'src', 'board')));
  const hasHost = existsSync(join(root, 'packages/shell/src/game-host'));
  if (!hasHost && boards.length === 0) fail('nothing to check: no packages/shell/src/game-host and no apps/<id>/src/board', 'Run from the app repo root (or pass it as the argument).');
  for (const rel of INPUT_FILES) {
    if (!existsSync(join(root, rel))) report.problem({ file: rel, rule: 'input-file-missing', message: 'board input file is missing', fix: "Copy it from this skill's templates (templates/game-kit or templates/shell/game-host) and run its tests." });
  }
  checkEverywhere(root, [...shellFiles, ...appFiles], report);
  checkGestureFile(root, report);
  checkPhysical(root, report);
  checkInputWorklets(root, report);
  checkRoot(root, shellFiles, report);
  for (const id of boards.filter((game) => !existsSync(join(root, 'apps', game, 'src', 'sim')))) {
    checkIntentToMove(root, id, report);
    checkTouchTargets(root, id, report);
  }
  checkApiVersion(root, report);
  checkWorkletsApi(root, report);
  return report.finish({ checked: shellFiles.length + appFiles.length, unit: 'source files' });
});
