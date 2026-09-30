#!/usr/bin/env node
// check-realtime-loop.mjs: checks real-time and simulate-then-replay code of a Pocket Arcade app repo
// against the rules of the realtime-game-loop skill (fixed step, worklets, determinism, tick time,
// no per-tick allocation, batched events, lifecycle, replay tests, the stick table).
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-realtime-loop.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { balancedParens, hasWorkletDirective, isTestFile, readRepoFile, resolveSpecifier, valueImports } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-realtime-loop',
  summary: 'Checks the fixed-step loop kit, every real-time sim (apps/*/src/sim) and every simulate-then-replay rules file (apps/*/src/rules importing fixed-step.ts) for the real-time rules.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as one JSON line' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  loop-file-missing    the loop kit exists (fixed-step, geometry, replay helpers; the runner, hook and host when a sim exists)',
    '  step-constants       STEP_MS = 1000 / 120 and MAX_FRAME_MS = 250 in fixed-step.ts',
    '  loop-runner          run-loop-frame.ts plans steps, calls sim.modify(), batches events and catches errors',
    '  frame-callback-body  useFrameCallback((info) => { runLoopFrame(...); }, false)',
    '  worklet-directive    sim files, real-time board draw files and the UI-thread kit start with a file-level \'worklet\'; directive',
    '  worklet-import       a \'worklet\' module imports values only from other \'worklet\' modules or react-native-worklets',
    '  determinism          only + - * / % bitwise, sqrt, imul, floor, round, abs, min, max, PI; no **, Math.random, Date, performance.now, Intl',
    '  sim-ticks            sim code counts ticks: no timestamps, frame times or STEP_MS inside a sim',
    '  sim-isolated         sim files never talk to JS or the Shell (no scheduleOnRN, React, Shell imports)',
    '  sim-no-alloc         step functions and the helpers they call allocate nothing per tick (no new, Array.from, map, filter, slice, subarray, literals, push); a helper that wraps nextU32 is the documented exception',
    '  sim-module-state     a sim keeps every changing value in its typed arrays: no module-level let/var or mutable containers',
    '  sim-replay-test      every sim has a replay test and a frame-grouping test',
    '  stick-table          a sim STICK table equals (cos, sin) of (k-1)*22.5 degrees, in order, y down',
    '  loop-lifecycle       a component that runs useFixedStepLoop also calls useGameLifecycle',
    '  replay-events-timed  simulate-then-replay rules emit timed events (atMs)',
    '  replay-capped        simulate-then-replay rules stop at a hard tick cap (maxTicks), so a volley always ends',
    '  arena-draw-budget    a real-time board has a draw*.test.ts asserting a draw-call budget of at most 1000',
    '  arena-golden         a real-time board has test/goldens/boards/<id>-board.golden.test.ts (paintSimPng, 3 sizes, moments 0, 0.5, 1) and >= 9 baselines',
    '',
    'A repo whose every game module (apps/<id>/src/index.ts) says realtime: null and that has no sim, no replay',
    'rules and no loop kit is turn-based only: the check prints NOT APPLICABLE and RESULT: PASS (exit 0). With no',
    'game module at all it still stops with exit 2 (nothing to check).',
    '',
    'Example: node check-realtime-loop.mjs .',
  ].join('\n'),
};

const KIT = [
  'packages/game-kit/src/timeline/fixed-step.ts',
  'packages/game-kit/src/timeline/fixed-step.test.ts',
  'packages/game-kit/src/geom/vec2.ts',
  'packages/game-kit/src/geom/sweep.ts',
  'packages/game-kit/src/geom/spatial-hash.ts',
  'packages/game-kit/src/testing/replay-commands.ts',
];
const HOST = [
  'packages/shell/src/game-host/run-loop-frame.ts',
  'packages/shell/src/game-host/run-loop-frame.test.ts',
  'packages/shell/src/game-host/use-fixed-step-loop.ts',
  'packages/shell/src/game-host/record-sim.ts',
  'packages/shell/src/game-host/realtime-board-host.tsx',
  'packages/shell/src/game-host/realtime-board-host.test.tsx',
  'packages/shell/src/game-host/paint-sim-png.ts',
];
const UI_THREAD_KIT = [
  'packages/game-kit/src/timeline/fixed-step.ts',
  'packages/game-kit/src/geom/vec2.ts',
  'packages/game-kit/src/geom/sweep.ts',
  'packages/game-kit/src/geom/spatial-hash.ts',
  'packages/shell/src/game-host/run-loop-frame.ts',
  'packages/shell/src/game-host/record-sim.ts',
];
const ALLOWED_MATH = new Set(['sqrt', 'imul', 'floor', 'round', 'abs', 'min', 'max', 'PI']);
const FIXED_STEP_IMPORT = /from\s+['"]@e07\/game-kit\/timeline\/fixed-step\.ts['"]/;
const ALLOCATION = /\bnew\s+\w+|\bArray\.from\s*\(|\.(map|filter|slice|subarray|concat|push|unshift|splice)\s*\(|=\s*\[|=\s*\{|\(\s*\{|\[\s*\.\.\./;
/** Module-level mutable state in a sim file: a let/var, or a lower-case const holding a container (tables are UPPER_CASE). */
const MODULE_STATE = /^(?:export\s+)?(?:(?:let|var)\s+(\w+)|const\s+([a-z]\w*)\s*(?::[^=\n]+)?=\s*(?:\[|\{|new\s+\w+))/gm;
const MAX_DRAW_CALLS = 1000;

const read = (root, rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);
const tree = (root, rel, include) => (existsSync(join(root, rel)) ? walk(join(root, rel), { include }).map((f) => `${rel}/${f}`) : []);

function checkWorklet(root, rel, source, report) {
  if (!hasWorkletDirective(source)) {
    report.problem({ file: rel, line: 1, rule: 'worklet-directive', message: "UI-thread module has no file-level 'worklet'; directive (it would throw on the UI thread at runtime)", fix: "Put 'worklet'; as the first statement, right after the // path comment." });
    return;
  }
  for (const { spec, index } of valueImports(source)) {
    const target = resolveSpecifier(rel, spec);
    if (target === null) {
      if (spec !== 'react-native-worklets') report.problem({ file: rel, line: lineOf(source, index), rule: 'worklet-import', message: `'worklet' module imports a value from the package ${spec}`, fix: 'Use `import type` for types; keep third-party runtime code off the UI thread (only react-native-worklets is allowed).' });
      continue;
    }
    const targetSource = readRepoFile(root, target);
    if (targetSource !== null && !hasWorkletDirective(targetSource)) report.problem({ file: rel, line: lineOf(source, index), rule: 'worklet-import', message: `'worklet' module imports a value from ${target}, which is not a 'worklet' module`, fix: "Add 'worklet'; to that module if it is pure, or move the helper into a 'worklet' module." });
  }
}

function checkDeterminism(rel, code, report) {
  for (const match of code.matchAll(/\bMath\.(\w+)/g)) {
    if (!ALLOWED_MATH.has(match[1])) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'determinism', message: `uses Math.${match[1]}, which Hermes and V8 may compute differently (or is random)`, fix: 'Use only + - * / %, bitwise, Math.sqrt/imul/floor/round/abs/min/max/PI; take directions from committed tables and randomness from sfc32.' });
  }
  const banned = [
    [/\*\*=?/g, 'uses ** (Math.pow)', 'Multiply explicitly.'],
    [/\bDate\b|\bperformance\.now\b/g, 'reads a clock', 'Count ticks; time never enters simulation.'],
    [/\bIntl\./g, 'uses Intl (locale-dependent)', 'Keep formatting out of simulation code.'],
  ];
  for (const [re, message, fix] of banned) {
    for (const match of code.matchAll(re)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'determinism', message, fix });
  }
}

function checkSim(root, rel, source, report) {
  const code = maskComments(source);
  checkWorklet(root, rel, source, report);
  checkDeterminism(rel, code, report);
  for (const match of code.matchAll(/\b(timestamp|timeSincePreviousFrame|timeSinceFirstFrame|STEP_MS|dtMs|deltaMs|elapsedMs)\b/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'sim-ticks', message: `sim code uses ${match[1]}; gameplay counts ticks, never milliseconds`, fix: 'Express speeds per tick and timers in ticks (ints[TICK]); the loop turns frame time into ticks.' });
  for (const match of code.matchAll(/\b(scheduleOnRN|runOnJS|runOnUI)\s*\(/g)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'sim-isolated', message: `sim calls ${match[1]} itself`, fix: 'Push [kind, value, tick] events into the sim; runLoopFrame drains them once per frame and sends them to JS.' });
  for (const { spec, index } of valueImports(source)) {
    if (/^(react|react-native|@e07\/shell)(\/|$)/.test(spec)) report.problem({ file: rel, line: lineOf(source, index), rule: 'sim-isolated', message: `sim imports ${spec}`, fix: 'Keep the sim pure: typed arrays, game-kit worklets and its own constants only.' });
  }
  checkTickAllocations(rel, code, report);
  checkStickTable(rel, code, report);
  for (const match of code.matchAll(MODULE_STATE)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'sim-module-state', message: `sim keeps state outside the sim object (${match[1] ?? match[2]} at module level): the UI thread works on its own captured copy, and saves and replays never see it`, fix: 'Keep every changing value in the typed arrays created by create…Sim (a header slot in ints, or a buffer); module-level values are UPPER_CASE constants only.' });
}

/** Every top-level function of a file (declarations and `const f = (…) => {…}`): name → { bodyStart, body }. */
function functionsOf(code) {
  const out = new Map();
  const declarations = /(?:^|\n)\s*(?:export\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/g;
  const arrows = /(?:^|\n)\s*(?:export\s+)?const\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:<[^>]*>)?\s*\(/g;
  for (const [re, isArrow] of [[declarations, false], [arrows, true]]) {
    for (const match of code.matchAll(re)) {
      const open = match.index + match[0].length - 1;
      const params = balancedParens(code, open);
      if (params === null) continue;
      const afterParams = open + params.length + 2;
      const arrow = isArrow ? /^\s*(?::[^=]*?)?=>\s*\{/.exec(code.slice(afterParams)) : null;
      if (isArrow && arrow === null) continue; // not an arrow function with a block body
      const bodyStart = isArrow ? afterParams + arrow[0].length - 1 : code.indexOf('{', afterParams);
      out.set(match[1], { bodyStart, body: braceBody(code, bodyStart) });
    }
  }
  return out;
}

/**
 * The exported step…() functions and every same-file helper they reach run once per tick (up to 30
 * times a frame on the UI thread), so none of them may allocate. A helper that wraps nextU32 (the
 * sim's RNG draw, documented as fine for occasional spawns) is the one exception.
 */
/** Names a sim imports as values from the kit modules whose functions return a new object on every call. */
function allocatingImports(code) {
  const names = new Set();
  for (const match of code.matchAll(/^[ \t]*import\s+\{([^}]*)\}\s*from\s+['"]@e07\/game-kit\/geom\/(vec2|sweep)\.ts['"]/gm)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name && !part.trim().startsWith('type ') && !/^[A-Z]/.test(name)) names.add(name);
    }
  }
  return names;
}

function checkTickAllocations(rel, code, report) {
  const functions = functionsOf(code);
  const kitAllocators = allocatingImports(code);
  const queue = [...functions.keys()].filter((name) => /^step/.test(name) && new RegExp(`export\\s+function\\s+${name}\\b`).test(code));
  const seen = new Set(queue);
  while (queue.length > 0) {
    const name = queue.shift();
    const { bodyStart, body } = functions.get(name);
    if (/\bnextU32\s*\(/.test(body)) continue;
    const alloc = ALLOCATION.exec(body);
    if (alloc) report.problem({ file: rel, line: lineOf(code, bodyStart + 1 + alloc.index), rule: 'sim-no-alloc', message: `${name} runs every tick and allocates or grows an array (${alloc[0].trim()})`, fix: 'Allocate buffers once in create…Sim and write into them in place (events go into the ints queue); the loop may run 30 ticks in one frame.' });
    for (const call of body.matchAll(/\b(\w+)\s*\(/g)) {
      if (!kitAllocators.has(call[1])) continue;
      report.problem({ file: rel, line: lineOf(code, bodyStart + 1 + call.index), rule: 'sim-no-alloc', message: `${name} runs every tick and calls ${call[1]}() from the vec2/sweep kit, which returns a new object on every call`, fix: 'In a UI-thread sim write the maths with scalars on the typed arrays (dx * dx + dy * dy < r * r, v - 2(v.n)n per component); vec2 and sweep are for applyMove on the JS thread.' });
      break;
    }
    for (const call of body.matchAll(/\b(\w+)\s*\(/g)) {
      if (functions.has(call[1]) && !seen.has(call[1])) {
        seen.add(call[1]);
        queue.push(call[1]);
      }
    }
  }
}

function braceBody(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return code.slice(open + 1);
}

function checkStickTable(rel, code, report) {
  const match = /\bconst\s+STICK\w*\s*=\s*\[([^\]]*)\]/.exec(code);
  if (!match) return;
  const values = match[1].split(',').map((v) => v.trim()).filter(Boolean).map(Number);
  const expected = Array.from({ length: 16 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)]).flat();
  const isSame = values.length === 32 && values.every((v, i) => Math.abs(v - expected[i]) <= 1e-4);
  if (!isSame) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'stick-table', message: 'the STICK table is not the 16 unit vectors (cos, sin) of (k-1) x 22.5 degrees in order (y down)', fix: 'Copy the table from the template sim (the stick gesture uses the same order: 1 right, 5 down, 9 left, 13 up).' });
}

function checkSimTests(root, id, report) {
  const tests = tree(root, `apps/${id}/src/sim`, ['*.test.ts']);
  const titles = tests.flatMap((rel) => [...(read(root, rel) ?? '').matchAll(/\bit\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]));
  if (!titles.some((t) => /replay/i.test(t))) report.problem({ file: `apps/${id}/src/sim`, rule: 'sim-replay-test', message: 'no test replays a recorded (tick, command) log and compares the world', fix: 'Copy the template __GAME_ID__-sim.test.ts: play with a bot, replay the command log, compare fingerprints.' });
  if (!titles.some((t) => /group|frames|60 vs 120/i.test(t))) report.problem({ file: `apps/${id}/src/sim`, rule: 'sim-replay-test', message: 'no test proves the world is the same however ticks are grouped into frames', fix: 'Step one tick at a time and in 1-3 tick frames with the same bot; the fingerprints must be equal.' });
}

/** A real-time board is a board too: a draw-call budget test and pixel goldens at 3 sizes x 3 moments. */
function checkArenaBoard(root, id, report) {
  const dir = `apps/${id}/src/board`;
  const drawTests = tree(root, dir, ['draw*.test.ts']);
  const texts = drawTests.map((rel) => maskComments(read(root, rel) ?? ''));
  const budgets = texts.flatMap((text) => [...text.matchAll(/DRAW_CALL_BUDGET\s*=\s*(\d+)|toBeLessThanOrEqual\(\s*(\d+)\s*\)/g)].map((m) => Number(m[1] ?? m[2])));
  // Asserted, not just declared: toBeLessThanOrEqual(<number> | <…BUDGET…>); toBeLessThanOrEqual(width) proves nothing.
  if (!texts.some((text) => /toBeLessThanOrEqual\(\s*(\d+|[A-Z][A-Z0-9_]*BUDGET[A-Z0-9_]*)\s*\)/.test(text))) report.problem({ file: `${dir}/draw-arena.test.ts`, rule: 'arena-draw-budget', message: 'the real-time board has no draw test asserting a draw-call budget', fix: "Copy templates/game/board/draw-arena.test.ts: count canvas calls with every entity slot in play and assert <= the game's budget." });
  for (const budget of budgets.filter((n) => n > MAX_DRAW_CALLS)) report.problem({ file: drawTests[0] ?? dir, line: 1, rule: 'arena-draw-budget', message: `draw-call budget ${budget} is above the Shell cap of ${MAX_DRAW_CALLS}`, fix: 'Draw hundreds of identical sprites as one atlas call; raising a budget needs an on-device frame report.' });
  const rel = `test/goldens/boards/${id}-board.golden.test.ts`;
  const text = read(root, rel);
  if (text === null) {
    report.problem({ file: rel, rule: 'arena-golden', message: 'the real-time board has no pixel golden', fix: "Copy templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts, fill it in, run 'npx jest <file> --selectProjects golden -u', and open every PNG." });
    return;
  }
  const code = maskComments(text);
  const sizes = new Set([...code.matchAll(/\bwidth\s*:\s*(\d+)/g)].map((m) => m[1])).size;
  if (!/\bpaintSimPng\s*\(/.test(code) || !/\btoMatchImageSnapshot\s*\(/.test(code)) report.problem({ file: rel, line: 1, rule: 'arena-golden', message: 'the golden does not render through paintSimPng and toMatchImageSnapshot', fix: "Render with paintSimPng(Skia, { draw, sim, … }) (the device's draw) and assert toMatchImageSnapshot with the skia-golden matcher." });
  if (sizes < 3 || !/\[\s*0\s*,\s*0\.5\s*,\s*1\s*\]/.test(code)) report.problem({ file: rel, line: 1, rule: 'arena-golden', message: `the golden renders ${sizes} canvas size(s) or not the moments [0, 0.5, 1] of a scripted run`, fix: 'Render 390x560, 1024x700 and 320x400 at MOMENTS = [0, 0.5, 1] of RUN_TICKS.' });
  const snapshots = 'test/goldens/boards/__image_snapshots__';
  const pngs = existsSync(join(root, snapshots)) ? readdirSync(join(root, snapshots)).filter((name) => name.startsWith(`${id}-`) && name.endsWith('.png')) : [];
  if (pngs.length < 9) report.problem({ file: `${snapshots}/${id}-*.png`, rule: 'arena-golden', message: `${pngs.length} baseline PNG(s) for ${id}; 9 (3 sizes x 3 moments) are required`, fix: `Run npx jest ${rel} --selectProjects golden -u, open every PNG with the Read tool, and commit with a Gate-Change: trailer.` });
}

function checkKit(root, report) {
  const fixed = read(root, 'packages/game-kit/src/timeline/fixed-step.ts');
  if (fixed !== null) {
    if (!/STEP_MS\s*=\s*1000\s*\/\s*120\b/.test(fixed)) report.problem({ file: 'packages/game-kit/src/timeline/fixed-step.ts', line: 1, rule: 'step-constants', message: 'STEP_MS is not 1000 / 120', fix: 'Keep export const STEP_MS = 1000 / 120; ticks, not frames, define gameplay speed.' });
    if (!/MAX_FRAME_MS\s*=\s*250\b/.test(fixed)) report.problem({ file: 'packages/game-kit/src/timeline/fixed-step.ts', line: 1, rule: 'step-constants', message: 'MAX_FRAME_MS is not 250', fix: 'Keep export const MAX_FRAME_MS = 250 (the catch-up clamp after a stall).' });
  }
  const runner = read(root, 'packages/shell/src/game-host/run-loop-frame.ts');
  if (runner !== null) {
    const code = maskComments(runner);
    for (const [re, what] of [[/\bplanSteps\s*\(/, 'plan steps with planSteps()'], [/\.modify\s*\(\s*\)/, 'call sim.modify() after mutating in place'], [/\bcatch\s*\(/, 'catch errors'], [/\bscheduleOnRN\s*\(\s*wiring\.onEvents/, 'send events to JS once per frame']]) {
      if (!re.test(code)) report.problem({ file: 'packages/shell/src/game-host/run-loop-frame.ts', line: 1, rule: 'loop-runner', message: `the loop runner does not ${what}`, fix: "Restore run-loop-frame.ts from this skill's template." });
    }
  }
  for (const rel of UI_THREAD_KIT) {
    const source = read(root, rel);
    if (source === null) continue;
    checkWorklet(root, rel, source, report);
    if (rel.startsWith('packages/game-kit/')) checkDeterminism(rel, maskComments(source), report);
  }
}

function checkComponents(root, files, report) {
  for (const rel of files.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
    if (isTestFile(rel)) continue;
    const code = maskComments(read(root, rel) ?? '');
    for (const match of code.matchAll(/\buseFrameCallback\s*\(/g)) {
      const args = balancedParens(code, match.index + match[0].length - 1) ?? '';
      if (/runLoopFrame/.test(args) && !/^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*runLoopFrame\s*\([^;{}]*\)\s*;?\s*\}\s*,\s*false\s*$/.test(args)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'frame-callback-body', message: 'the loop frame callback is not a single runLoopFrame call that starts inactive', fix: 'Write useFrameCallback((info) => { runLoopFrame(wiring, info.timeSincePreviousFrame); }, false).' });
    }
    if (/\buseFixedStepLoop\s*\(/.test(code) && !/\buseGameLifecycle\s*\(/.test(code)) report.problem({ file: rel, line: lineOf(code, code.search(/\buseFixedStepLoop\s*\(/)), rule: 'loop-lifecycle', message: 'runs the fixed-step loop without useGameLifecycle (it would keep simulating in the background and under ads)', fix: 'Call useGameLifecycle: stop the loop, take a save point and show Pause; never auto-resume.' });
  }
}

/**
 * The game ids when every game module (apps/<id>/src/index.ts) declares `realtime: null`, else null
 * (no game module at all, or one that is real-time or does not say).
 */
function turnBasedGames(root, apps) {
  const modules = apps.filter((id) => existsSync(join(root, 'apps', id, 'src', 'index.ts')));
  if (modules.length === 0) return null;
  const isTurnBased = (id) => /\brealtime\s*:\s*null\b/.test(maskComments(read(root, `apps/${id}/src/index.ts`)));
  return modules.every(isTurnBased) ? modules : null;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-realtime-loop', json: options.json });
  const apps = existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')).sort() : [];
  const simGames = apps.filter((id) => existsSync(join(root, 'apps', id, 'src', 'sim')));
  const replayFiles = apps.flatMap((id) => tree(root, `apps/${id}/src/rules`, ['*.ts'])).filter((rel) => !isTestFile(rel) && FIXED_STEP_IMPORT.test(read(root, rel)));
  const hasKit = KIT.concat(HOST).some((rel) => existsSync(join(root, rel)));
  if (simGames.length === 0 && replayFiles.length === 0 && !hasKit) {
    const turnBased = turnBasedGames(root, apps);
    if (turnBased !== null) return report.notApplicable(`every game module has realtime: null (${turnBased.join(', ')}), and no sim, replay rules or loop kit exists`);
    fail('nothing to check: no apps/<id>/src/sim, no rules file importing fixed-step.ts, no loop kit, and no game module that says realtime: null', 'Run from the app repo root (or pass it as the argument).');
  }
  const required = simGames.length > 0 ? KIT.concat(HOST) : KIT;
  for (const rel of required) if (!existsSync(join(root, rel))) report.problem({ file: rel, rule: 'loop-file-missing', message: 'loop kit file is missing', fix: "Copy it from this skill's templates (templates/game-kit or templates/shell/game-host) and run its tests." });
  checkKit(root, report);
  let checked = 0;
  for (const id of simGames) {
    for (const rel of tree(root, `apps/${id}/src/sim`, ['*.ts']).filter((f) => !isTestFile(f))) {
      checkSim(root, rel, read(root, rel), report);
      checked += 1;
    }
    checkSimTests(root, id, report);
    checkArenaBoard(root, id, report);
    // The real-time picture calls the game's draw on the UI thread (recordSim inside useDerivedValue).
    for (const rel of tree(root, `apps/${id}/src/board`, ['*.ts']).filter((f) => /\/draw[^/]*\.ts$/.test(f) && !isTestFile(f))) {
      checkWorklet(root, rel, read(root, rel), report);
      checked += 1;
    }
  }
  for (const rel of replayFiles) {
    const code = maskComments(read(root, rel));
    checkDeterminism(rel, code, report);
    if (!/\batMs\b/.test(code)) report.problem({ file: rel, line: 1, rule: 'replay-events-timed', message: 'simulate-then-replay code emits no timed events (atMs)', fix: 'Emit { kind, …, atMs: Math.round(tick * STEP_MS) } at every change of motion so buildTimeline can replay it.' });
    if (!/\bmax_?ticks\b/i.test(code)) report.problem({ file: rel, line: 1, rule: 'replay-capped', message: 'simulate-then-replay code has no hard tick cap (maxTicks)', fix: 'Loop while bodies move AND tick <= maxTicks, and end every body at the cap, so a volley always ends and a bot never hangs.' });
    checked += 1;
  }
  const shellFiles = tree(root, 'packages/shell/src', ['*.ts', '*.tsx']);
  checkComponents(root, shellFiles.concat(apps.flatMap((id) => tree(root, `apps/${id}/src`, ['*.tsx']))), report);
  return report.finish({ checked: checked + required.length, unit: 'loop files' });
});
