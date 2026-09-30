#!/usr/bin/env node
// build-fixtures.mjs: rebuilds the good fixtures of both checkers and every bad-* fixture of
// check-board-files from this skill's templates, so the fixtures ARE the composed template set:
// the host files verbatim, and the template board filled in for the template game (Tap Flip, id
// tap-flip) with its golden test and its 9 reviewed baselines. tests/fixture-base/ holds what the
// templates do not ship: stand-ins for files other skills own, package.json, the Expo config, a
// real-time board and the baselines. Each bad-* case is the good fixture with ONE planted bug.
// check-board-code's bad-* fixtures are small hand-written trees and are left alone.
//
//   node tests/build-fixtures.mjs           rebuild (after changing a template or a case)
//   node tests/build-fixtures.mjs --check   exit 1 when a good fixture no longer matches the templates
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

const fill = (text) => FILL.reduce((out, [from, to]) => out.replaceAll(from, to), text);

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map(String).filter((rel) => statSync(join(dir, rel)).isFile()).sort();
}

/** [fixture path, contents] for every template file, placed where the SKILL.md workflow puts it. */
function templateFiles({ withTooling, withGolden }) {
  const out = [];
  const add = (fromDir, toDir, { isFilled = false } = {}) => {
    for (const rel of filesUnder(join(TEMPLATES, fromDir))) {
      const text = readFileSync(join(TEMPLATES, fromDir, rel), 'utf8');
      out.push([join(toDir, isFilled ? fill(rel) : rel), isFilled ? fill(text) : text]);
    }
  };
  add('game-kit', 'packages/game-kit/src');
  add('shell/game-host', 'packages/shell/src/game-host');
  add('shell/app', 'packages/shell/src/app');
  add('game/board', `apps/${GAME}/src/board`, { isFilled: true });
  if (withTooling) add('tooling/quality', 'packages/tooling/src/quality');
  if (withGolden) {
    const golden = 'test/goldens/boards';
    out.push([`${golden}/skia-golden.ts`, readFileSync(join(TEMPLATES, golden, 'skia-golden.ts'), 'utf8')]);
    const test = readFileSync(join(TEMPLATES, golden, '__GAME_ID__-board.golden.test.ts'), 'utf8');
    out.push([`${golden}/${GAME}-board.golden.test.ts`, fill(test)]);
  }
  return out;
}

const SUITES = {
  'check-board-code': { bases: ['common'], withTooling: false, withGolden: false },
  'check-board-files': { bases: ['common', 'check-board-files'], withTooling: true, withGolden: true },
};

function write(dir, rel, text) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

function buildGood(suite) {
  const spec = SUITES[suite];
  const good = join(FIXTURES, suite, 'good');
  rmSync(good, { recursive: true, force: true });
  for (const base of spec.bases) cpSync(join(BASE, base), good, { recursive: true });
  for (const [rel, text] of templateFiles(spec)) write(good, rel, text);
  return good;
}

// ---------------------------------------------------------------------------------------------
// check-board-files: one planted bug per case
// ---------------------------------------------------------------------------------------------

const BOARD = `apps/${GAME}/src/board`;
const GOLDEN = `test/goldens/boards/${GAME}-board.golden.test.ts`;

function edit(dir, rel, from, to) {
  const path = join(dir, rel);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(from)) throw new Error(`build-fixtures: "${from}" not found in ${rel}`);
  writeFileSync(path, text.replace(from, to));
}

const remove = (dir, rel) => rmSync(join(dir, rel), { recursive: true, force: true });

/** [case, plant(dir), EXPECT lines]. */
const FILES_CASES = [
  ['board-object', (d) => edit(d, `${BOARD}/${GAME}-board.ts`, '  isMirroredInRtl: false,\n', ''), ['board-object', 'has no isMirroredInRtl']],
  ['draw-budget', (d) => edit(d, `${BOARD}/draw-board.test.ts`, 'DRAW_CALL_BUDGET = 250', 'DRAW_CALL_BUDGET = 1500'), ['draw-budget', 'budget 1500 is above the Shell cap']],
  ['draw-budget-unasserted', (d) => edit(d, `${BOARD}/draw-board.test.ts`, 'toBeLessThanOrEqual(DRAW_CALL_BUDGET)', 'toBeGreaterThan(0)'), ['draw-budget', 'the draw test asserts no draw-call budget', 'draw-board.test.ts']],
  ['golden-baselines', (d) => {
    for (const name of readdirSync(join(d, 'test/goldens/boards/__image_snapshots__'))) if (!name.endsWith('-small-0.png')) remove(d, `test/goldens/boards/__image_snapshots__/${name}`);
  }, ['golden-baselines', `1 baseline PNG(s) for ${GAME}`]],
  ['golden-missing', (d) => remove(d, GOLDEN), ['golden-test', GOLDEN]],
  ['golden-sizes', (d) => edit(d, GOLDEN, "  { name: 'small', width: 320, height: 400 },\n", ''), ['golden-test', 'renders 2 canvas size(s)']],
  ['host-missing', (d) => remove(d, 'packages/shell/src/game-host/board-scene.ts'), ['host-file-missing', 'packages/shell/src/game-host/board-scene.ts']],
  ['missing-timeline', (d) => remove(d, `${BOARD}/build-timeline.ts`), ['board-file-missing', `${BOARD}/build-timeline.ts`]],
  ['missing-contrast', (d) => remove(d, `${BOARD}/board-contrast.json`), ['board-file-missing', `${BOARD}/board-contrast.json`]],
  ['no-120hz', (d) => remove(d, 'packages/shell/src/config'), ['plist-120hz', 'packages/shell/src/config/with-shell.ts']],
  // The probe text is also shown in parity probe=board launches: it must stay inside the masked board frame.
  ['probe-spills', (d) => edit(d, 'packages/shell/src/game-host/board-layout-probe.tsx', "frame: { flex: 1, overflow: 'hidden' },", 'frame: { flex: 1 },'), ['probe-contained', 'packages/shell/src/game-host/board-layout-probe.tsx:1', "the frame style has no overflow: 'hidden'"]],
  ['no-reduced-test', (d) => {
    const rel = `${BOARD}/build-timeline.test.ts`;
    writeFileSync(join(d, rel), readFileSync(join(d, rel), 'utf8').replaceAll("'reduced'", "'full'"));
  }, ['timeline-reduced', 'build-timeline.test.ts:1']],
  ['reduced-in-comment', (d) => {
    const rel = `${BOARD}/build-timeline.test.ts`;
    const text = readFileSync(join(d, rel), 'utf8').replaceAll("'reduced'", "'full'");
    writeFileSync(join(d, rel), `// buildTimeline(TURN, 'reduced') is still to be written\n${text}`);
  }, ['timeline-reduced', 'build-timeline.test.ts:1']],
  ['palette-hex', (d) => edit(d, 'apps/demo-arena/src/board/board-palettes.json', '"player": "#4f86e8"', '"player": "blue"'), ['palette-sets', 'dark.player', 'apps/demo-arena/src/board/board-palettes.json']],
  ['palette-keys', (d) => edit(d, `${BOARD}/board-palettes.json`, '"colorBlindDark": {\n    "background"', '"colorBlindDark": {\n    "ground"'), ['palette-sets', '"colorBlindDark" tokens']],
  // A repo with a game but no host and no board folder yet: the output is the full copy list (exit 1).
  ['empty-game', (d) => {
    for (const name of readdirSync(d)) if (name !== 'apps' && name !== 'package.json') remove(d, name);
    remove(d, 'apps/demo-arena');
    remove(d, BOARD);
  }, ['host-file-missing', 'packages/shell/src/game-host/board-types.ts', 'board-file-missing', `${BOARD}/draw-*.ts`, 'golden-test', 'jest-golden-project']],
  // AppText does not exist yet: the Shell-stage layout probe would not compile.
  ['host-import', (d) => remove(d, 'packages/shell/src/ui'), ['host-import-unresolved', 'board-layout-probe.tsx', 'packages/shell/src/ui/app-text.tsx', 'toybox-design-system']],
  // RNTL is not installed: the lifecycle test (and every host test) would not run.
  ['host-package', (d) => edit(d, 'package.json', '    "@testing-library/react-native": "14.0.1",\n', ''), ['host-import-unresolved', 'use-game-lifecycle.test.ts', 'imports the package @testing-library/react-native']],
  // A game-first repo ("screens": []): the Shell-stage files are skipped, a missing pure file still fails.
  ['slice-pure-missing', (d) => {
    write(d, 'shell-slice.json', '{ "screens": [], "why": "Game-first repo: the board before the Shell app" }\n');
    for (const name of ['board-canvas.tsx', 'board-canvas.test.tsx', 'board-layout-probe.tsx', 'board-layout-probe.test.tsx', 'game-board-host.tsx', 'game-board-host.test.tsx']) remove(d, `packages/shell/src/game-host/${name}`);
    remove(d, 'packages/shell/src/game-host/paint-board-png.ts');
  }, ['SKIP packages/shell/src/game-host/board-canvas.tsx [host-file-missing] S5 not in shell-slice.json', 'packages/shell/src/game-host/paint-board-png.ts [host-file-missing]', 'RESULT: FAIL (1 problems)']],
];

function buildFilesCases(good) {
  const suite = join(FIXTURES, 'check-board-files');
  for (const name of readdirSync(suite)) if (name.startsWith('bad-')) rmSync(join(suite, name), { recursive: true, force: true });
  for (const [name, plant, expect] of FILES_CASES) {
    const dir = join(suite, `bad-${name}`);
    cpSync(good, dir, { recursive: true });
    plant(dir);
    writeFileSync(join(dir, 'EXPECT.txt'), `${expect.join('\n')}\n`);
  }
}

/** Every template-derived file of a good fixture still equals the template (after the fill). */
function driftOf(suite) {
  const good = join(FIXTURES, suite, 'good');
  return templateFiles(SUITES[suite]).filter(([rel, text]) => !existsSync(join(good, rel)) || readFileSync(join(good, rel), 'utf8') !== text).map(([rel]) => `${relative(SKILL, good)}/${rel}`);
}

if (process.argv.includes('--check')) {
  const drift = Object.keys(SUITES).flatMap(driftOf);
  for (const rel of drift) console.log(`FAIL ${rel} [fixture-drift] differs from its template Fix: node tests/build-fixtures.mjs, then rerun the self-test.`);
  console.log(drift.length === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${drift.length} problems)`);
  process.exitCode = drift.length === 0 ? 0 : 1;
} else {
  buildGood('check-board-code');
  buildFilesCases(buildGood('check-board-files'));
  console.log(`build-fixtures: rebuilt 2 good fixtures and ${FILES_CASES.length} check-board-files cases`);
}
