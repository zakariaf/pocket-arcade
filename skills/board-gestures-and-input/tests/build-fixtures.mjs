#!/usr/bin/env node
// build-fixtures.mjs: rebuilds tests/fixtures/ for check-board-input.mjs from this skill's templates, so
// the good fixture IS the composed template set: the input kit verbatim, and the Tap Flip template game's
// intent-to-move.ts (+ test) and hit-targets.test.ts filled in for apps/tap-flip. tests/fixture-base/
// holds what the templates do not ship: stand-ins for files other skills own (board-layout.ts,
// board-types.ts, board-canvas.tsx, the Tap Flip rules and layout), the app root, the app's
// package.json and a real-time board. Each bad-* case is the good fixture with ONE planted bug; its
// EXPECT.txt names the rule and the file:line computed from the planted text.
//
//   node tests/build-fixtures.mjs           rebuild (after changing a template or a case)
//   node tests/build-fixtures.mjs --check   exit 1 when the good fixture no longer matches the templates
//                                           (scripts/selftest.mjs runs this first)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, '..');
const TEMPLATES = join(SKILL, 'templates');
const BASE = join(HERE, 'fixture-base');
const FIXTURES = join(HERE, 'fixtures');
const GAME = 'tap-flip';
const FILL = [
  ['__GAME_ID__', GAME],
  ['__GAME_PASCAL__', 'TapFlip'],
  ['__GAME_CAMEL__', 'tapFlip'],
];
const GESTURES = 'packages/shell/src/game-host/use-board-gestures.ts';
const PAN = 'packages/shell/src/game-host/pan-intent.ts';
const CANVAS = 'packages/shell/src/game-host/board-canvas.tsx';
const INTENT = `apps/${GAME}/src/rules/intent-to-move.ts`;

const fill = (text) => FILL.reduce((out, [from, to]) => out.replaceAll(from, to), text);

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).filter((rel) => statSync(join(dir, rel)).isFile()).sort();
}

/** [fixture path, contents] for every template file, placed where the SKILL.md workflow puts it. */
function templateFiles() {
  const out = [];
  const add = (fromDir, toDir, isFilled) => {
    for (const rel of filesUnder(join(TEMPLATES, fromDir))) {
      const text = readFileSync(join(TEMPLATES, fromDir, rel), 'utf8');
      out.push([join(toDir, rel), isFilled ? fill(text) : text]);
    }
  };
  add('game-kit', 'packages/game-kit/src', false);
  add('shell/game-host', 'packages/shell/src/game-host', false);
  add('game/rules', `apps/${GAME}/src/rules`, true);
  add('game/board', `apps/${GAME}/src/board`, true);
  return out;
}

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

function read(dir, rel) {
  return readFileSync(join(dir, rel), 'utf8');
}

function edit(dir, rel, from, to) {
  const text = read(dir, rel);
  if (!text.includes(from)) throw new Error(`build-fixtures: "${from}" not found in ${rel}`);
  writeFileSync(join(dir, rel), text.replace(from, to));
}

/** 1-based line of the first occurrence of `marker` in a fixture file. */
function lineOf(dir, rel, marker) {
  const text = read(dir, rel);
  const index = text.indexOf(marker);
  if (index === -1) throw new Error(`build-fixtures: marker "${marker}" not found in ${rel}`);
  return text.slice(0, index).split('\n').length;
}

const remove = (dir, rel) => rmSync(join(dir, rel), { recursive: true, force: true });

function buildGood(dir) {
  rmSync(dir, { recursive: true, force: true });
  cpSync(BASE, dir, { recursive: true });
  for (const [rel, text] of templateFiles()) write(dir, rel, text);
}

const TAP_SEND = "if (target !== null) scheduleOnRN(onIntent, { kind: 'tap', target, selected: null });";

/** [case, plant(dir) → EXPECT lines]. */
const CASES = [
  ['gesture-elsewhere', (d) => {
    write(d, `apps/${GAME}/src/board/tap-layer.tsx`, `// apps/${GAME}/src/board/tap-layer.tsx\nimport { Gesture, GestureDetector } from 'react-native-gesture-handler';\n\nimport type { ReactNode } from 'react';\n\nconst tap = Gesture.Tap();\n\nexport function TapLayer(props: { readonly children: ReactNode }): ReactNode {\n  return <GestureDetector gesture={tap}>{props.children}</GestureDetector>;\n}\n`);
    return ['gesture-one-file', 'tap-layer.tsx:6', 'Gesture.Tap'];
  }],
  ['hit-test-no-slop', (d) => {
    edit(d, GESTURES, 'const target = hitTest(layout.get(), event, HIT_SLOP);\n      // The host', 'const target = hitTest(layout.get(), event);\n      // The host');
    return ['hit-test-slop', `use-board-gestures.ts:${lineOf(d, GESTURES, 'const target = hitTest(layout.get(), event);')}`];
  }],
  ['impure-intent', (d) => {
    edit(d, INTENT, `// ${INTENT}\n`, `// ${INTENT}\nimport { Platform } from 'react-native';\n\n`);
    return ['intent-pure', 'imports react-native'];
  }],
  ['input-missing', (d) => {
    remove(d, PAN);
    return ['input-file-missing', PAN];
  }],
  ['input-no-worklet', (d) => {
    edit(d, PAN, "'worklet';\n\n", '');
    return ['input-worklet', `${PAN}:1`, "no file-level 'worklet'; directive"];
  }],
  ['intent-not-exhaustive', (d) => {
    edit(d, INTENT, "    case 'long-press':\n    case 'swipe':\n    case 'drag-end':\n    case 'aim':\n      return null;", '    default:\n      return null;');
    return ['intent-exhaustive', 'long-press, swipe, drag-end, aim'];
  }],
  ['intent-on-update', (d) => {
    edit(d, GESTURES, '      pointer.set({ ...previous, x: aim.x, y: aim.y, hover });\n', "      pointer.set({ ...previous, x: aim.x, y: aim.y, hover });\n      if (hover !== null) scheduleOnRN(handlers.onIntent, { kind: 'tap', target: hover, selected: null });\n");
    return ['intent-on-update', '.onUpdate() emits an intent'];
  }],
  ['missing-intent-to-move', (d) => {
    remove(d, `apps/${GAME}/src/rules`);
    return ['intent-to-move', INTENT];
  }],
  ['no-root-view', (d) => {
    remove(d, 'packages/shell/src/app');
    return ['gesture-root', 'packages/shell/src/app', 'no <GestureHandlerRootView> wraps the app'];
  }],
  ['no-test-id', (d) => {
    edit(d, GESTURES, "    .withTestId('board.tap')\n", '');
    return ['gesture-test-id', '4 gesture builders but only 3'];
  }],
  ['no-touch-test', (d) => {
    remove(d, `apps/${GAME}/src/board/hit-targets.test.ts`);
    return ['touch-target-test', `apps/${GAME}/src/board/hit-targets.test.ts`];
  }],
  ['pressable-in-detector', (d) => {
    edit(d, CANVAS, "import { StyleSheet } from 'react-native';", "import { Pressable, StyleSheet } from 'react-native';");
    edit(d, CANVAS, '        <Picture picture={picture} />\n      </Canvas>\n', '        <Picture picture={picture} />\n      </Canvas>\n      <Pressable accessibilityRole="button" onPress={() => undefined} />\n');
    return ['pressable-in-detector', `board-canvas.tsx:${lineOf(d, CANVAS, '<Pressable accessibilityRole')}`, '<Pressable>'];
  }],
  ['rngh-v3-api', (d) => {
    edit(d, GESTURES, "import { Gesture } from 'react-native-gesture-handler';", "import { Gesture, useTapGesture } from 'react-native-gesture-handler';");
    write(d, GESTURES, `${read(d, GESTURES)}\nexport const tapHook = (): unknown => useTapGesture({});\n`);
    return ['rngh-api-version', 'installs Gesture Handler ~2.32.0, but the gesture file uses the v3 hook API'];
  }],
  ['rtl-in-gestures', (d) => {
    edit(d, PAN, "return { kind: 'aim', dx: release.translationX, dy: release.translationY };", "return { kind: 'aim', dx: layout.isMirrored ? -release.translationX : release.translationX, dy: release.translationY };");
    return ['physical-coords', `pan-intent.ts:${lineOf(d, PAN, 'layout.isMirrored ?')}`, 'isMirrored'];
  }],
  ['run-on-js', (d) => {
    edit(d, GESTURES, TAP_SEND, "if (target !== null) runOnJS(onIntent)({ kind: 'tap', target, selected: null });");
    return ['worklets-api', `use-board-gestures.ts:${lineOf(d, GESTURES, 'runOnJS(onIntent)')}`, 'uses the deprecated runOnJS'];
  }],
  ['value-accessor', (d) => {
    edit(d, GESTURES, 'pointer.set(IDLE_POINTER);', 'pointer.value = IDLE_POINTER;');
    return ['worklets-api', `use-board-gestures.ts:${lineOf(d, GESTURES, 'pointer.value = IDLE_POINTER')}`, 'shared value pointer is accessed with .value'];
  }],
];

/**
 * The game-first suite (run with --game tap-flip): shell-slice.json says "screens": [] and there is no
 * app root yet, so gesture-root prints SKIP; a half-built second game outside the scope stays silent.
 */
function buildGameFirstGood(good, dir) {
  rmSync(dir, { recursive: true, force: true });
  cpSync(good, dir, { recursive: true });
  remove(dir, 'packages/shell/src/app');
  write(dir, 'shell-slice.json', '{ "screens": [], "why": "game-first repo: the board and its input come before the Shell app" }\n');
  write(dir, 'apps/half-done/src/board/layout-board.ts', read(dir, `apps/${GAME}/src/board/layout-board.ts`).replaceAll(`apps/${GAME}/`, 'apps/half-done/'));
  // The in-repo skill library holds planted findings on purpose; the checker reads only apps/ and packages/.
  write(dir, ['skills', 'some-skill', 'tests', 'fixtures', 'bad', 'packages', 'shell', 'src', 'ui', 'tap.tsx'].join('/'), "const tap = Gesture.Tap();\n");
}

const GAME_FIRST_CASES = [
  ['scoped-touch-test', (d) => {
    remove(d, `apps/${GAME}/src/board/hit-targets.test.ts`);
    return ['SKIP packages/shell/src/app [gesture-root] no Shell app', 'touch-target-test', `apps/${GAME}/src/board/hit-targets.test.ts`, 'RESULT: FAIL (1 problems)'];
  }],
  ['slice-root-in-slice', (d) => {
    write(d, 'shell-slice.json', '{ "screens": ["S4", "S5"], "why": "Home and Game slice: the Shell app exists, so its root must wrap gestures" }\n');
    return ['gesture-root', 'no <GestureHandlerRootView> wraps the app'];
  }],
];

function buildCases(suiteDir, good, cases) {
  for (const name of readdirSync(suiteDir)) if (name.startsWith('bad-')) rmSync(join(suiteDir, name), { recursive: true, force: true });
  for (const [name, plant] of cases) {
    const dir = join(suiteDir, `bad-${name}`);
    cpSync(good, dir, { recursive: true });
    writeFileSync(join(dir, 'EXPECT.txt'), `${plant(dir).join('\n')}\n`);
  }
}

/** Every template-derived file of the good fixture still equals the template (after the fill). */
function drift() {
  const good = join(FIXTURES, 'good');
  return templateFiles().filter(([rel, text]) => !existsSync(join(good, rel)) || readFileSync(join(good, rel), 'utf8') !== text).map(([rel]) => `${relative(SKILL, good)}/${rel}`);
}

if (process.argv.includes('--check')) {
  const drifted = drift();
  for (const rel of drifted) console.log(`FAIL ${rel} [fixture-drift] differs from its template Fix: node tests/build-fixtures.mjs, then rerun the self-test.`);
  console.log(drifted.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${drifted.length} problems)`);
  process.exitCode = drifted.length === 0 ? 0 : 1;
} else {
  const good = join(FIXTURES, 'good');
  buildGood(good);
  buildCases(FIXTURES, good, CASES);
  const gameFirst = join(FIXTURES, 'game-first');
  mkdirSync(gameFirst, { recursive: true });
  buildGameFirstGood(good, join(gameFirst, 'good'));
  buildCases(gameFirst, join(gameFirst, 'good'), GAME_FIRST_CASES);
  console.log(`build-fixtures: rebuilt the good fixture, ${CASES.length} cases, and the game-first suite with ${GAME_FIRST_CASES.length} cases`);
}
