#!/usr/bin/env node
// check-perf-code.mjs: checks Pocket Arcade code for the performance rules a machine can see:
// no Skia allocation or React state per frame, frame callbacks that can stop, the recorder never
// owning a callback, draw-call budgets under the ceiling, canvases per screen, no runtime code
// generation, Hermes kept, only en/de/fa/ckb Intl data, and Jest perf timing from node:perf_hooks.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-perf-code.mjs [--root <app repo>]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { SHELL_DUE_TARGETS, createReporter, dueSkipReason, fail, lineOf, parseArgs, readShellSlice, run, sliceSkipReason, toPosix, walk } from './check-lib.mjs';
import { loadBudgets } from './lib/budgets.mjs';
import { findCalls, findClosing, findImports, findJsxTags, maskCode } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-perf-code',
  summary: 'Checks Pocket Arcade source (packages/shell, packages/game-kit, apps/*, root test/) for performance mistakes that are visible in code.',
  usage: '[repo-root] (or --root <dir>)',
  options: {
    root: { type: 'string', default: '.', value: 'dir', help: 'App repo root (reads quality-gates.json for drawCallsPerFrameMax)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  skia-alloc-per-frame   Skia.Paint/Color/Path/Font/ParagraphBuilder/PictureRecorder/Surface made inside a',
    "                         'worklet' function or a useFrameCallback/useDerivedValue callback",
    '  react-state-per-frame  a React state setter called inside a frame callback (setX(...), or handed to',
    '                         scheduleOnRN/runOnJS)',
    '  frame-callback-stop    a file starts useFrameCallback but never calls setActive (it can never stop)',
    '  recorder-callback      use-frame-recorder.ts owns a frame callback (the board host samples frames)',
    '  draw-call-budget       a game draw-board.ts without a budget test, or a budget over drawCallsPerFrameMax',
    '  canvas-per-item        a Skia <Canvas> rendered inside .map() (one canvas per list item)',
    '  canvases-per-screen    more than skiaCanvasesPerScreenMax <Canvas> in one screen file',
    '  runtime-codegen        eval, new Function or a string passed to setTimeout/setInterval',
    '  hermes-engine          jsEngine other than hermes, or RCT_HERMES_V1_ENABLED set',
    '  intl-locale-data       FormatJS locale data other than en, de, fa, ckb',
    '  perf-clock-in-tests    a test times with the global performance.now() (a 1 ms mock in Jest)',
    '  promotion-plist        packages/shell/src/config/with-shell.ts without',
    '                         CADisableMinimumFrameDurationOnPhone: true (iOS then caps the app at 60 fps)',
    '  perf-layer             the cold-start layer is incomplete. JS half (Shell step 7, due once',
    '                         packages/shell/src/app/start-shell.ts exists): app/perf/*.ts, markJsEntry() in',
    '                         start-shell.ts, createPerfLog in TestOnlyApi and in createDebugParts, and',
    "                         useColdStartMark in Home's model hook (SKIP while S4 is outside shell-slice.json).",
    '                         Native half (Shell step 8, due once packages/shell/src/config/shell-plugins.ts exists):',
    '                         expo-module.config.json, ios/E07Shell.podspec, ios/ProcessStartModule.swift.',
    '                         Both SKIP with "screens": [] (no Shell app).',
    '  debug-perf-wired       the debug menu cannot reach its Performance actions: createDebugPerfActions is not a',
    '                         TestOnlyApi member, or createDebugParts never builds it (due with start-shell.ts).',
  ].join('\n'),
};

const SKIA_ALLOC = /\bSkia\.(Paint|Color|Font|ParagraphBuilder|PictureRecorder|RuntimeEffect|Surface|Path\.Make\w*|Image\.Make\w*|XYWHRect|RRectXY)\s*\(/g;
const FRAME_HOOKS = ['useFrameCallback', 'useDerivedValue', 'useAnimatedReaction'];
const LOCALES = new Set(['en', 'de', 'fa', 'ckb']);

function collectFiles(root) {
  const files = [];
  const add = (dir, include = ['*.ts', '*.tsx']) => {
    if (!existsSync(join(root, dir))) return;
    for (const rel of walk(join(root, dir), { include, ignore: ['*.d.ts', 'ios', 'android', 'build', 'dist'] })) files.push(`${dir}/${rel}`);
  };
  add('packages/shell/src');
  add('packages/game-kit/src');
  add('test');
  const apps = join(root, 'apps');
  if (existsSync(apps)) {
    for (const id of readdirSync(apps).sort()) {
      if (!statSync(join(apps, id)).isDirectory()) continue;
      add(`apps/${id}/src`);
      for (const file of ['app.config.ts', 'app.json']) if (existsSync(join(apps, id, file))) files.push(`apps/${id}/${file}`);
    }
  }
  return files;
}

/** [open, close] ranges of per-frame code: 'worklet' function bodies and frame-hook callbacks. */
function frameRanges(masked, source) {
  const ranges = [];
  for (const hook of FRAME_HOOKS) {
    for (const call of findCalls(masked, hook)) ranges.push({ open: call.open, close: call.close, what: `${hook} callback` });
  }
  for (const match of source.matchAll(/(['"])worklet\1\s*;?/g)) {
    // The directive opens the body it sits in: find the nearest unclosed "{" before it.
    let depth = 0;
    for (let i = match.index; i >= 0; i -= 1) {
      if (masked[i] === '}') depth += 1;
      else if (masked[i] === '{') {
        if (depth === 0) {
          const close = findClosing(masked, i);
          if (close !== -1) ranges.push({ open: i, close, what: "'worklet' function" });
          break;
        }
        depth -= 1;
      }
    }
  }
  return ranges;
}

/**
 * The perf layer, in two halves (D52). The JS half (app/perf/*.ts: the perf log, the cold-start
 * mark, the frame recorder, the save benchmark and the debug menu's actions) lands at Shell step 7
 * as Shell core, with start-shell.ts and the composition root that import it. The native half
 * (the process-start module, its podspec and module config) lands at step 8 with the native
 * plugin list and the rebuild, before the E2E evidence run measures cold start.
 */
const PERF_JS_FILES = [
  ...['cold-start', 'perf-log', 'use-cold-start-mark', 'frame-report', 'use-frame-recorder', 'save-benchmark', 'large-save-doc', 'debug-perf-actions'].flatMap((name) => [`packages/shell/src/app/perf/${name}.ts`, `packages/shell/src/app/perf/${name}.test.ts`]),
  ...['process-start', 'frame-histogram', 'share-perf-report', 'debug-perf-device'].map((name) => `packages/shell/src/app/perf/${name}.ts`),
];
const PERF_NATIVE_FILES = [
  'packages/shell/expo-module.config.json',
  'packages/shell/ios/E07Shell.podspec',
  'packages/shell/ios/ProcessStartModule.swift',
];
const PERF_WIRING = [
  { file: 'packages/shell/src/app/start-shell.ts', pattern: /\bmarkJsEntry\s*\(\s*\)/, message: 'start-shell.ts does not call markJsEntry() (the first JS timestamp of a launch)', fix: 'Call markJsEntry() inside startShell (start-shell.ts), right after readParityLaunch() (rtl-and-direction owns the file).' },
  { file: 'packages/shell/src/app/test-only-api.ts', pattern: /\bcreatePerfLog\s*:/, message: 'TestOnlyApi has no createPerfLog member (test builds cannot keep the perf log)', fix: 'Sync the shared test-only pair: createPerfLog (from app/perf/perf-log.ts) joins it once perf-log.ts exists.' },
  { file: 'packages/shell/src/app/create-debug-parts.ts', pattern: /\bcreatePerfLog\s*\(/, message: 'createDebugParts creates no perf log (Home has nothing to write its cold-start mark to)', fix: 'In createDebugParts: perfLog = TEST_ONLY.createPerfLog(saveDriver), exposed on DebugServices as perfLog (e2e-maestro owns the file).' },
];
/** The debug menu's Performance section (S15): its actions reach test builds through the pair. */
const DEBUG_PERF_WIRING = [
  { file: 'packages/shell/src/app/test-only-api.ts', pattern: /\bcreateDebugPerfActions\s*:/, message: 'TestOnlyApi has no createDebugPerfActions member (the debug menu has no Performance section)', fix: 'Sync the shared test-only pair: createDebugPerfActions (from app/perf/debug-perf-actions.ts) joins it once that file exists (e2e-maestro, the pair\'s one editor).' },
  { file: 'packages/shell/src/app/create-debug-parts.ts', pattern: /\bcreateDebugPerfActions\s*\(/, message: 'createDebugParts builds no debug perf actions (S15 cannot record frames, share the report or run the save benchmark)', fix: 'In createDebugParts: perf = TEST_ONLY.createDebugPerfActions({ perfLog, nowMs }), exposed on DebugServices (e2e-maestro owns the file).' },
];
const HOME_MARK = { file: 'packages/shell/src/screens/home/use-home-model.ts', pattern: /\buseColdStartMark\s*\(/, message: 'Home never marks cold start (the E2E run finds no cold-start entry)', fix: 'In use-home-model.ts: useColdStartMark(useOptionalDebugServices()?.perfLog ?? null) (toybox-screens owns the file; null in store builds).' };

function missingFiles(root, files, step, report) {
  for (const rel of files.filter((file) => !existsSync(join(root, file)))) {
    const where = rel.startsWith('packages/shell/src/app/perf/') ? 'templates/shell-perf/ into packages/shell/src/app/perf/' : 'templates/shell-native/ into packages/shell/';
    report.problem({ file: rel, line: 1, rule: 'perf-layer', message: 'a file of the cold-start layer is missing', fix: `Copy it from this skill (${where}) at Shell step ${step}${step === 8 ? ', then rebuild the simulator app' : ''}.` });
  }
}

function checkWiring(root, items, rule, report) {
  for (const item of items) {
    const path = join(root, item.file);
    const source = existsSync(path) ? readFileSync(path, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '') : '';
    if (!item.pattern.test(source)) report.problem({ file: item.file, line: 1, rule, message: existsSync(path) ? item.message : `${item.file} is missing, so ${item.message.charAt(0).toLowerCase()}${item.message.slice(1)}`, fix: item.fix });
  }
}

function checkPerfLayer(root, report) {
  const slice = readShellSlice(root);
  const noShell = sliceSkipReason(slice);
  const jsReason = noShell ?? dueSkipReason(root, SHELL_DUE_TARGETS.boot);
  if (jsReason !== null) {
    report.skip({ file: 'packages/shell/src/app/perf', rule: 'perf-layer', message: jsReason });
    report.skip({ file: 'packages/shell/src/app/perf/debug-perf-actions.ts', rule: 'debug-perf-wired', message: jsReason });
  } else {
    missingFiles(root, PERF_JS_FILES, 7, report);
    const homeSkip = sliceSkipReason(slice, 'S4');
    if (homeSkip !== null) report.skip({ file: HOME_MARK.file, rule: 'perf-layer', message: homeSkip });
    checkWiring(root, homeSkip === null ? [...PERF_WIRING, HOME_MARK] : PERF_WIRING, 'perf-layer', report);
    checkWiring(root, DEBUG_PERF_WIRING, 'debug-perf-wired', report);
  }
  const nativeReason = noShell ?? dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (nativeReason !== null) report.skip({ file: 'packages/shell/ios', rule: 'perf-layer', message: nativeReason });
  else missingFiles(root, PERF_NATIVE_FILES, 8, report);
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root);
  const files = collectFiles(root);
  if (files.length === 0) fail(`nothing to check: no source under ${options.root}/packages/shell/src, packages/game-kit/src, apps/* or test/`, 'Run from the app repo root, or pass --root <repo>.');
  const { budgets } = loadBudgets(root);
  const report = createReporter({ name: 'check-perf-code', json: options.json });
  const shown = (rel) => toPosix(relative(process.cwd(), join(root, rel))) || rel;

  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const problem = (index, rule, message, fix) => report.problem({ file: shown(rel), line: lineOf(source, index), rule, message, fix });
    if (rel.endsWith('.json')) {
      const engine = /"jsEngine"\s*:\s*"(\w+)"/.exec(source);
      if (engine && engine[1] !== 'hermes') problem(engine.index, 'hermes-engine', `jsEngine is "${engine[1]}"`, 'Remove jsEngine: Hermes is the default and runs precompiled bytecode.');
      continue;
    }
    const masked = maskCode(source);
    const isTest = /\.test\.tsx?$/.test(rel);

    if (!isTest) {
      for (const range of frameRanges(masked, source)) {
        const body = masked.slice(range.open, range.close + 1);
        for (const m of body.matchAll(SKIA_ALLOC)) problem(range.open + m.index, 'skia-alloc-per-frame', `Skia.${m[1]}() is created inside a ${range.what}, so every frame allocates a native object`, 'Create paints, colours, paths, fonts and recorders once (module scope, useState initializer or the render kit) and reuse them.');
        if (range.what.startsWith('useFrameCallback')) {
          for (const m of body.matchAll(/(?<![\w$.])set[A-Z]\w*\s*\(/g)) problem(range.open + m.index, 'react-state-per-frame', `${m[0].replace(/\s*\($/, '')}() sets React state from a frame callback`, 'Keep per-frame data in shared values and Skia pictures; React re-renders only on events (batch a real-time score once per frame with scheduleOnRN).');
          for (const m of body.matchAll(/\b(scheduleOnRN|runOnJS)\s*\(\s*(set[A-Z]\w*)\b/g)) problem(range.open + m.index, 'react-state-per-frame', `${m[1]}(${m[2]}) sets React state from a frame callback`, 'Never hand a useState setter to scheduleOnRN/runOnJS per frame: write the value to the session store (throttled to the display) or keep it in a shared value.');
        }
      }
      if (/\buseFrameCallback\s*\(/.test(masked) && !/\.setActive\s*\(/.test(masked) && basename(rel) !== 'use-frame-recorder.ts') {
        problem(masked.search(/\buseFrameCallback\s*\(/), 'frame-callback-stop', 'useFrameCallback is started but never stopped', 'Keep the returned handle and call setActive(false) when the timeline ends, on background, while a full-screen ad shows and when the screen loses focus.');
      }
      if (basename(rel) === 'use-frame-recorder.ts' && /\buseFrameCallback\s*\(/.test(masked)) {
        problem(masked.search(/\buseFrameCallback\s*\(/), 'recorder-callback', 'the frame recorder owns a frame callback', 'Call sampleFrame(histogram, isRecording, frameInfo.timeSincePreviousFrame) from the board host\'s existing callback instead; an extra display link keeps idle screens rendering.');
      }
      for (const m of masked.matchAll(/(?<![\w$.])eval\s*\(|\bnew\s+Function\s*\(|\bset(Timeout|Interval)\s*\(\s*['"`]/g)) {
        problem(m.index, 'runtime-codegen', `${m[0].replace(/\s*\($/, '').trim()} generates code at runtime`, 'Hermes runs precompiled bytecode; pass a function instead of a string and never eval.');
      }
      if (/\bRCT_HERMES_V1_ENABLED\b/.test(source)) problem(source.indexOf('RCT_HERMES_V1_ENABLED'), 'hermes-engine', 'RCT_HERMES_V1_ENABLED is set', 'Remove it: Hermes V1 is the default engine in React Native 0.86.');
      const engine = /\bjsEngine\s*:\s*['"](\w+)['"]/.exec(source);
      if (engine && engine[1] !== 'hermes') problem(engine.index, 'hermes-engine', `jsEngine is '${engine[1]}'`, 'Remove jsEngine: Hermes is the default and runs precompiled bytecode.');
    }

    for (const imp of findImports(source, masked)) {
      const data = /^@formatjs\/intl-[\w-]+\/locale-data\/([\w-]+)(\.js)?$/.exec(imp.from);
      if (data && !LOCALES.has(data[1])) problem(imp.index, 'intl-locale-data', `locale data "${data[1]}" is imported`, 'Load only en, de, fa and ckb data: every extra locale is startup weight in the bundle.');
    }

    if (rel === 'packages/shell/src/config/with-shell.ts' && !/\bCADisableMinimumFrameDurationOnPhone['"]?\s*:\s*true\b/.test(source.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ''))) {
      problem(0, 'promotion-plist', 'withShell does not set ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true', 'Add CADisableMinimumFrameDurationOnPhone: true to the iOS infoPlist that withShell writes; without it ProMotion phones run the app at 60 fps and frame reports say refreshHz 60.');
    }
    if (isTest && /\bperformance\.now\s*\(/.test(masked) && !findImports(source, masked).some((imp) => imp.from === 'node:perf_hooks')) {
      problem(masked.search(/\bperformance\.now\s*\(/), 'perf-clock-in-tests', 'the test times with the global performance.now(), which the React Native Jest preset replaces with a 1 ms Date.now mock', "Import { performance } from 'node:perf_hooks' (tests that use Node built-ins live under the root test/ folder).");
    }

    if (rel.endsWith('.tsx') && !isTest) {
      const canvases = findJsxTags(source, masked).filter((tag) => tag.name === 'Canvas');
      for (const m of masked.matchAll(/\.map\s*\(/g)) {
        const open = m.index + m[0].length - 1;
        const close = findClosing(masked, open);
        for (const tag of canvases) if (tag.start > open && tag.start < close) problem(tag.start, 'canvas-per-item', 'a Skia <Canvas> is rendered once per list item', 'Draw repeated icons as rasterized Icon images (one path, tinted), or all items on one canvas; each canvas costs about 0.18 MB and 2.8 ms to mount.');
      }
      const isBoard = /(^|\/)(board|game-host)\//.test(rel) || /board/.test(basename(rel));
      if (!isBoard && canvases.length > budgets.skiaCanvasesPerScreenMax) {
        problem(canvases[budgets.skiaCanvasesPerScreenMax].start, 'canvases-per-screen', `${canvases.length} Skia canvases in one screen file (budget ${budgets.skiaCanvasesPerScreenMax})`, 'Keep Skia canvases for multi-colour or animated art (at most 8 per screen outside the board); use Icon for single-colour glyphs.');
      }
    }

    if (/^apps\/[^/]+\/src\/.*draw-board\.ts$/.test(rel)) {
      const testRel = join(dirname(rel), 'draw-board.test.ts');
      if (!existsSync(join(root, testRel))) {
        problem(0, 'draw-call-budget', 'draw-board.ts has no draw-board.test.ts budget test', 'Add the recording-canvas test: draw the busiest frame of a turn and expect(total).toBeLessThanOrEqual(<the game\'s budget>).');
      } else {
        const testSource = maskCode(readFileSync(join(root, testRel), 'utf8'));
        const numbers = [...testSource.matchAll(/toBeLessThanOrEqual\(\s*([\d_]+)\s*\)|DRAW_CALL_BUDGET\s*=\s*([\d_]+)/g)].map((m) => Number((m[1] ?? m[2]).replace(/_/g, '')));
        if (numbers.length === 0) {
          report.problem({ file: shown(testRel), line: 1, rule: 'draw-call-budget', message: 'the draw-board test asserts no numeric draw-call budget', fix: 'Assert expect(total).toBeLessThanOrEqual(<budget>) or declare const DRAW_CALL_BUDGET = <budget>.' });
        } else if (Math.max(...numbers) > budgets.drawCallsPerFrameMax) {
          report.problem({ file: shown(testRel), line: 1, rule: 'draw-call-budget', message: `the draw-call budget ${Math.max(...numbers)} is over the ceiling ${budgets.drawCallsPerFrameMax}`, fix: 'Bring the busiest frame under the ceiling (Atlas for many sprites, a cached picture for the static layer); raising a game\'s budget needs an owner device report with hitch rate <= 10 ms/s.' });
        }
      }
    }
  }
  checkPerfLayer(root, report);
  return report.finish({ checked: files.length, unit: 'files' });
});
