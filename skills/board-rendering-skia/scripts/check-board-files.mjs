#!/usr/bin/env node
// check-board-files.mjs: checks that the Shell's game host and every game's board are complete:
// required files, palettes, timeline and draw-call tests, pixel goldens with baselines, 120 Hz.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-board-files.mjs [repo-root] [--game <id>]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { createReporter, fail, lineOf, maskComments, parseArgs, readShellSlice, requireDir, run, sliceSkipReason, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-board-files',
  summary: 'Checks that the board host (packages/shell/src/game-host) and each game board (apps/<id>/src/board) have every file, palette set, test and pixel golden the board-rendering-skia skill requires.',
  usage: '[options] [repo-root]',
  options: {
    game: { type: 'string', multiple: true, value: 'id', help: 'Only check these game ids (default: every apps/<id> with src/ or game.config.ts)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  host-file-missing   the Shell game-host, timeline kit, BoardLayout, golden matcher and worklet boundary files and their',
    '                      tests exist. Shell-stage files (board-canvas, board-layout-probe, game-board-host) print SKIP while',
    '                      shell-slice.json lacks S5; a repo with no host folder yet gets the whole list (exit 1)',
    '  host-import-unresolved  every import of a present host file resolves: an @e07/ or relative path that exists, or a',
    '                      package some package.json declares (AppText, renderWithShell and RNTL are prerequisites)',
    '  board-file-missing  a turn-based board has palettes (+ board-contrast.json, the pairs the accessibility check reads),',
    '                      to-view, build-timeline, layout, draw, <id>-board and their tests',
    '                      (a game with no src/board folder yet gets the whole list)',
    '  probe-contained     board-layout-probe.tsx clips its frame and spans its text box across it, so the probe text stays',
    '                      inside the board frame that a parity probe=board launch masks',
    '  palette-sets        board-palettes.json has light, dark, colorBlindLight, colorBlindDark with identical keys and #RRGGBB(AA) values',
    '  timeline-reduced    build-timeline.test.ts builds the reduced-motion timeline (buildTimeline and \'reduced\' in code,',
    '                      not only in a comment)',
    '  draw-budget         the draw test asserts a draw-call budget (toBeLessThanOrEqual) of at most 1000 and records drawText',
    '  board-object        <id>-board.ts sets isMirroredInRtl, toView, layout, draw, buildPaths and describe',
    '  golden-test         test/goldens/boards/<id>-board.golden.test.ts renders paintBoardPng at >= 3 sizes and moments 0, 0.5, 1',
    '  golden-baselines    test/goldens/boards/__image_snapshots__ holds >= 9 reviewed <id>-*.png baselines',
    '  plist-120hz         the Expo config sets ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true (SKIP for "screens": [])',
    '  jest-golden-project jest.config.js has a golden project on @shopify/react-native-skia/jestEnv.js',
    '',
    'A game with apps/<id>/src/sim/ is real-time: here its board needs palettes and a draw file only (its draw-call',
    'budget test and pixel goldens are checked by the realtime-game-loop skill\'s checker).',
    'Example: node check-board-files.mjs . --game line-siege',
  ].join('\n'),
};

/**
 * Host files and the stage they belong to. 'pure': compiles with game-kit, the audio/haptics ports
 * and the gesture kit only, so a game-first repo builds and golden-tests its board before the Shell.
 * 'shell': the Shell stage (S5, the Game screen): these import AppText, renderWithShell and the canvas.
 */
const GH = 'packages/shell/src/game-host';
const HOST_FILES = [
  ...['track.ts', 'sample.ts', 'sample.test.ts', 'particles.ts', 'particles.test.ts'].map((f) => [`packages/game-kit/src/timeline/${f}`, 'pure']),
  ['packages/game-kit/src/geom/board-layout.ts', 'pure'],
  ['packages/game-kit/src/geom/board-layout.test.ts', 'pure'],
  ['packages/shell/src/app/use-is-app-active.ts', 'pure'],
  ['packages/shell/src/app/use-is-app-active.test.ts', 'pure'],
  ...[
    'board-types.ts', 'board-kit.ts', 'board-kit.test.ts', 'board-scene.ts', 'board-scene.test.ts', 'describe-error.ts', 'describe-error.test.ts',
    'board-clock-state.ts', 'board-clock-state.test.ts', 'board-clock-traces.test.ts',
    'run-board-frame.ts', 'run-board-frame.test.ts', 'use-board-clock.ts', 'record-board.ts', 'record-board.test.ts', 'draw-centered-text.ts',
    'draw-centered-text.test.ts', 'present-move.ts', 'present-move.test.ts', 'cue-scheduler.ts', 'cue-scheduler.test.ts', 'paint-board-png.ts',
    'use-game-lifecycle.ts', 'use-game-lifecycle.test.ts',
  ].map((f) => [`${GH}/${f}`, 'pure']),
  ...['board-canvas.tsx', 'board-canvas.test.tsx', 'board-layout-probe.tsx', 'board-layout-probe.test.tsx', 'game-board-host.tsx', 'game-board-host.test.tsx'].map((f) => [`${GH}/${f}`, 'shell']),
  ['test/goldens/boards/skia-golden.ts', 'pure'],
  // The repo-level worklet boundary gate that runs inside `npm test`.
  ['packages/tooling/src/quality/check-worklet-boundary.ts', 'pure'],
  ['packages/tooling/src/quality/check-worklet-boundary.test.ts', 'pure'],
  ['packages/tooling/src/quality/worklet-transform.test.ts', 'pure'],
];
/** Where a missing import comes from, for the fix text: [path or package pattern, owner]. */
const IMPORT_OWNERS = [
  [/ui\/app-text\.tsx$|theme\//, 'toybox-design-system (AppText, the theme and type styles)'],
  [/testing\/render-with-shell\.tsx$/, 'unit-and-component-tests (renderWithShell and its providers)'],
  [/services\/(audio|haptics)\//, 'game-audio-and-haptics (the audio and haptics ports and their fakes)'],
  [/use-board-gestures|pan-intent|input-intent|classify-swipe|stick-command/, 'board-gestures-and-input (the gesture kit)'],
  [/game-kit\/src\/(contract|rng|testing)\//, 'game-rules-engine (the game-kit contract and RNG)'],
  [/^@testing-library\/react-native$/, 'dependency-management: plan-dependency @testing-library/react-native (RNTL 14.0.1 with test-renderer 1.2.0)'],
];
const NODE_BUILTIN = /^(node:|(assert|buffer|child_process|crypto|events|fs|os|path|process|stream|url|util|zlib)$)/;
const PALETTE_SETS = ['light', 'dark', 'colorBlindLight', 'colorBlindDark'];
const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_DRAW_CALLS = 1000;

const read = (root, rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);
/** Source with comments blanked: a rule is met by code, never by a mention in a comment. */
const readCode = (root, rel) => {
  const text = read(root, rel);
  return text === null ? null : maskComments(text);
};
const list = (root, rel) => (existsSync(join(root, rel)) ? readdirSync(join(root, rel)) : []);

/** Every package name any package.json in the repo declares (dependencies, dev, peer). */
function declaredPackages(root) {
  const files = ['package.json', ...['packages', 'apps'].flatMap((base) => list(root, base).map((name) => `${base}/${name}/package.json`))];
  const names = new Set();
  for (const rel of files) {
    const text = read(root, rel);
    if (text === null) continue;
    try {
      const pkg = JSON.parse(text);
      for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) for (const name of Object.keys(pkg[key] ?? {})) names.add(name);
    } catch {
      // A broken package.json is another checker's business (check-monorepo); nothing is declared here.
    }
  }
  return names;
}

/** Repo-relative file an '@e07/…' or relative specifier points at, or null for a package. */
function localTarget(fromRel, spec) {
  if (spec.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fromRel), spec));
  const match = /^@e07\/([^/]+)\/(.+)$/.exec(spec);
  if (match === null) return null;
  return `${['game-kit', 'shell', 'tooling'].includes(match[1]) ? 'packages' : 'apps'}/${match[1]}/src/${match[2]}`;
}

function ownerOf(target) {
  return IMPORT_OWNERS.find(([pattern]) => pattern.test(target))?.[1] ?? 'the skill that owns that file (see references/architecture.md, Prerequisites)';
}

/** Every import of a present host file resolves: a repo file that exists, or a declared package. */
function checkImports(root, rel, packages, report) {
  const code = readCode(root, rel);
  if (code === null) return;
  const specs = [
    ...code.matchAll(/^[ \t]*(?:import|export)\b[^;'"]*?\bfrom\s+['"]([^'"]+)['"]/gm),
    ...code.matchAll(/^[ \t]*import\s+['"]([^'"]+)['"]/gm),
  ];
  for (const match of specs) {
    const spec = match[1];
    if (NODE_BUILTIN.test(spec)) continue;
    const target = localTarget(rel, spec);
    const line = lineOf(code, match.index);
    if (target !== null) {
      if (!existsSync(join(root, target))) report.problem({ file: rel, line, rule: 'host-import-unresolved', message: `imports ${spec}, but ${target} does not exist (the host would not compile)`, fix: `Build it first with ${ownerOf(target)}, or leave this Shell-stage file for the Shell step (see Prerequisites).` });
      continue;
    }
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!packages.has(name)) report.problem({ file: rel, line, rule: 'host-import-unresolved', message: `imports the package ${name}, which no package.json in the repo declares`, fix: `Add it the pinned way: ${ownerOf(name)}.` });
  }
}

/**
 * The layout probe also runs in parity launches with probe=board, where S5-S7 compare the Shell
 * chrome and mask only the board: its text must stay inside the board frame. The frame clips
 * (overflow hidden) and the text box spans the frame from start to end, so the text wraps inside.
 */
function checkProbeContained(root, report) {
  const rel = `${GH}/board-layout-probe.tsx`;
  const code = readCode(root, rel);
  if (code === null) return;
  const frame = /\bframe\s*:\s*\{([^}]*)\}/.exec(code)?.[1] ?? '';
  const probe = /\bprobe\s*:\s*\{([^}]*)\}/.exec(code)?.[1] ?? '';
  const missing = [
    [/overflow\s*:\s*['"]hidden['"]/.test(frame), "the frame style has no overflow: 'hidden'"],
    [/position\s*:\s*['"]absolute['"]/.test(probe) && /insetInlineStart\s*:\s*0\b/.test(probe) && /insetInlineEnd\s*:\s*0\b/.test(probe), 'the probe style does not span the frame (absolute, insetInlineStart: 0, insetInlineEnd: 0)'],
  ].filter(([isMet]) => !isMet).map(([, what]) => what);
  if (missing.length > 0) report.problem({ file: rel, line: 1, rule: 'probe-contained', message: `the layout probe's text can spill outside the board frame: ${missing.join('; ')}`, fix: "Copy templates/shell/game-host/board-layout-probe.tsx and its test again: frame { flex: 1, overflow: 'hidden' }, probe { position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, insetInlineEnd: 0 }. A parity board mask covers only the board frame." });
}

function checkHost(root, slice, report) {
  const shellSkip = sliceSkipReason(slice, 'S5');
  const packages = declaredPackages(root);
  for (const [rel, stage] of HOST_FILES) {
    if (stage === 'shell' && shellSkip !== null) {
      report.skip({ file: rel, rule: 'host-file-missing', message: `${shellSkip} (Shell-stage board host file)` });
      continue;
    }
    if (!existsSync(join(root, rel))) {
      report.problem({ file: rel, rule: 'host-file-missing', message: `board host file is missing (${stage === 'shell' ? 'Shell stage, S5' : 'pure/golden stage'})`, fix: "Copy it verbatim from this skill's templates (templates/shell, templates/game-kit, templates/test or templates/tooling) and run its tests." });
      continue;
    }
    checkImports(root, rel, packages, report);
  }
  checkProbeContained(root, report);
  const jest = read(root, 'jest.config.js');
  if (jest === null || !jest.includes('@shopify/react-native-skia/jestEnv.js') || !/golden/.test(jest)) {
    report.problem({ file: 'jest.config.js', rule: 'jest-golden-project', message: 'no Jest golden project on the Skia CanvasKit environment', fix: "Add a 'golden' project: testEnvironment '@shopify/react-native-skia/jestEnv.js', setupFilesAfterEnv ['@shopify/react-native-skia/jestSetup.js'], testMatch *.golden.test.ts." });
  }
  const configDir = 'packages/shell/src/config';
  const configs = [
    ...(existsSync(join(root, configDir)) ? walk(join(root, configDir), { include: ['*.ts'] }).map((rel) => `${configDir}/${rel}`) : []),
    ...list(root, 'apps').map((id) => `apps/${id}/app.config.ts`),
  ];
  const sets120 = configs.some((rel) => /CADisableMinimumFrameDurationOnPhone['"]?\s*:\s*true/.test(readCode(root, rel) ?? ''));
  const configSkip = sliceSkipReason(slice, null);
  if (sets120) return;
  if (configSkip !== null) report.skip({ file: 'packages/shell/src/config/with-shell.ts', rule: 'plist-120hz', message: `${configSkip} (withShell comes with the Shell app)` });
  else report.problem({ file: 'packages/shell/src/config/with-shell.ts', rule: 'plist-120hz', message: 'no Expo config sets CADisableMinimumFrameDurationOnPhone: true (iOS caps the app at 60 fps on ProMotion phones)', fix: 'In withShell, set ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true.' });
}

function checkPalettes(root, dir, report) {
  const rel = `${dir}/board-palettes.json`;
  const text = read(root, rel);
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    report.problem({ file: rel, line: 1, rule: 'palette-sets', message: `not valid JSON: ${error.message}`, fix: 'Fix the JSON.' });
    return;
  }
  const keysOf = (set) => Object.keys(data?.[set] ?? {}).sort().join(',');
  const reference = keysOf('light');
  for (const set of PALETTE_SETS) {
    if (typeof data?.[set] !== 'object' || data[set] === null || Object.keys(data[set]).length === 0) {
      report.problem({ file: rel, line: 1, rule: 'palette-sets', message: `palette set "${set}" is missing or empty`, fix: `Add "${set}" with the same semantic tokens as "light".` });
      continue;
    }
    if (keysOf(set) !== reference) report.problem({ file: rel, line: 1, rule: 'palette-sets', message: `"${set}" tokens (${keysOf(set)}) differ from "light" (${reference})`, fix: 'Give all four sets exactly the same token names.' });
    for (const [token, value] of Object.entries(data[set])) {
      if (typeof value !== 'string' || !HEX.test(value)) report.problem({ file: rel, line: 1, rule: 'palette-sets', message: `"${set}.${token}" is ${JSON.stringify(value)}, not #RRGGBB or #RRGGBBAA`, fix: 'Write the colour as a hex string, for example "#2f6fd6" or "#2f6fd680".' });
    }
  }
  const extra = Object.keys(data ?? {}).filter((key) => !PALETTE_SETS.includes(key));
  if (extra.length > 0) report.problem({ file: rel, line: 1, rule: 'palette-sets', message: `unexpected palette sets: ${extra.join(', ')}`, fix: `Use exactly ${PALETTE_SETS.join(', ')}.` });
}

function requireFiles(root, dir, names, report) {
  const files = list(root, dir);
  // No board folder yet: every file is listed, so the output is the copy list.
  for (const [label, test] of names) {
    if (!files.some((name) => test.test(name))) report.problem({ file: `${dir}/${label}`, rule: 'board-file-missing', message: `board file ${label} is missing`, fix: 'Copy it from this skill\'s templates/game/board, fill the __PLACEHOLDERS__, and make its tests pass.' });
  }
}

function checkTests(root, dir, report) {
  const timelineTest = readCode(root, `${dir}/build-timeline.test.ts`);
  const buildsReduced = timelineTest !== null && /\bbuildTimeline\s*\(/.test(timelineTest) && /['"`]reduced['"`]/.test(timelineTest);
  if (timelineTest !== null && !buildsReduced) report.problem({ file: `${dir}/build-timeline.test.ts`, line: 1, rule: 'timeline-reduced', message: 'the timeline test never builds the reduced-motion timeline', fix: "Assert that buildTimeline(events, 'reduced') has no burst tracks, no out-back easing and is shorter." });
  const drawTest = list(root, dir).find((name) => /^draw[^/]*\.test\.ts$/.test(name));
  if (drawTest === undefined) return;
  const text = readCode(root, `${dir}/${drawTest}`) ?? '';
  const budgets = [...text.matchAll(/toBeLessThanOrEqual\(\s*(\d+)\s*\)|DRAW_CALL_BUDGET\s*=\s*(\d+)/g)].map((m) => Number(m[1] ?? m[2]));
  // The budget must be asserted: toBeLessThanOrEqual(<number>) or toBeLessThanOrEqual(<…BUDGET…>); a bound on a
  // coordinate (toBeLessThanOrEqual(width)) or a declared but unused constant proves nothing.
  const hasBudget = /toBeLessThanOrEqual\(\s*(\d+|[A-Z][A-Z0-9_]*BUDGET[A-Z0-9_]*)\s*\)/.test(text);
  if (!hasBudget) report.problem({ file: `${dir}/${drawTest}`, line: 1, rule: 'draw-budget', message: 'the draw test asserts no draw-call budget', fix: 'Count canvas calls with a recording canvas on the busiest frame and assert total <= the game budget (<= 1000).' });
  for (const budget of budgets.filter((n) => n > MAX_DRAW_CALLS)) report.problem({ file: `${dir}/${drawTest}`, line: 1, rule: 'draw-budget', message: `draw-call budget ${budget} is above the Shell cap of ${MAX_DRAW_CALLS}`, fix: 'Reduce draw calls (Atlas for many sprites, fewer layers); raising a budget needs an on-device frame report.' });
  if (!/drawText/.test(text)) report.problem({ file: `${dir}/${drawTest}`, line: 1, rule: 'draw-budget', message: 'the draw test does not record drawText, so a missing localised label goes unnoticed', fix: 'Record drawText strings in the recording canvas and assert the localised labels.' });
}

function checkBoardObject(root, dir, id, report) {
  const rel = `${dir}/${id}-board.ts`;
  const text = readCode(root, rel);
  if (text === null) return;
  for (const member of ['isMirroredInRtl', 'toView', 'layout', 'draw', 'buildPaths', 'describe']) {
    if (!new RegExp(`\\b${member}\\b\\s*[:,(]|^\\s*${member},?\\s*$`, 'm').test(text)) report.problem({ file: rel, line: 1, rule: 'board-object', message: `the GameBoard object has no ${member}`, fix: `Add ${member} to the exported GameBoard object.` });
  }
}

function checkGolden(root, id, report) {
  const rel = `test/goldens/boards/${id}-board.golden.test.ts`;
  const text = readCode(root, rel);
  if (text === null) {
    report.problem({ file: rel, rule: 'golden-test', message: 'the board has no pixel golden test', fix: "Copy templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts, fill it in, run 'npx jest <file> --selectProjects golden -u', and review the PNGs." });
    return;
  }
  const sizes = (/SIZES\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(text)?.[1].match(/\bwidth\s*:/g) ?? []).length;
  const moments = /MOMENTS\s*=\s*\[([^\]]*)\]/.exec(text)?.[1].split(',').map((v) => Number(v.trim())) ?? [];
  if (!/paintBoardPng\s*\(/.test(text) || !/toMatchImageSnapshot\s*\(/.test(text)) report.problem({ file: rel, line: 1, rule: 'golden-test', message: 'the golden does not render through paintBoardPng and toMatchImageSnapshot', fix: 'Render with paintBoardPng(Skia, …) (the device draw()) and assert toMatchImageSnapshot with the skia-golden matcher.' });
  if (sizes < 3) report.problem({ file: rel, line: 1, rule: 'golden-test', message: `the golden renders ${sizes} canvas size(s); 3 are required`, fix: 'Render phone-portrait 390x560, tablet-landscape 1024x700 and small 320x400.' });
  if (![0, 0.5, 1].every((m) => moments.includes(m))) report.problem({ file: rel, line: 1, rule: 'golden-test', message: 'the golden does not render the moments 0, 0.5 and 1 of the timeline', fix: 'Use const MOMENTS = [0, 0.5, 1] as const.' });
  const pngs = list(root, 'test/goldens/boards/__image_snapshots__').filter((name) => name.startsWith(`${id}-`) && name.endsWith('.png'));
  if (pngs.length < 9) report.problem({ file: `test/goldens/boards/__image_snapshots__/${id}-*.png`, rule: 'golden-baselines', message: `${pngs.length} baseline PNG(s) for ${id}; 9 (3 sizes x 3 moments) are required`, fix: `Run npx jest ${rel} --selectProjects golden -u, open every PNG with the Read tool, and commit with a Gate-Change: trailer.` });
}

function checkGame(root, id, report) {
  const dir = `apps/${id}/src/board`;
  const isRealtime = existsSync(join(root, `apps/${id}/src/sim`));
  const needed = isRealtime
    ? [['board-palettes.json', /^board-palettes\.json$/], ['board-palettes.ts', /^board-palettes\.ts$/], ['board-contrast.json', /^board-contrast\.json$/], ['draw-*.ts', /^draw[^.]*\.ts$/]]
    : [
        ['board-palettes.json', /^board-palettes\.json$/], ['board-palettes.ts', /^board-palettes\.ts$/], ['board-contrast.json', /^board-contrast\.json$/], ['to-view.ts', /^to-view\.ts$/],
        ['build-timeline.ts', /^build-timeline\.ts$/], ['build-timeline.test.ts', /^build-timeline\.test\.ts$/], ['layout-*.ts', /^layout[^.]*\.ts$/],
        ['layout-*.test.ts', /^layout[^.]*\.test\.ts$/], ['draw-*.ts', /^draw[^.]*\.ts$/], ['draw-*.test.ts', /^draw[^.]*\.test\.ts$/], [`${id}-board.ts`, new RegExp(`^${id}-board\\.ts$`)],
      ];
  requireFiles(root, dir, needed, report);
  checkPalettes(root, dir, report);
  if (isRealtime) return;
  checkTests(root, dir, report);
  checkBoardObject(root, dir, id, report);
  checkGolden(root, id, report);
}

/** Games are apps/<id> folders with a src/ folder or a game.config.ts (the scaffold writes both). */
function gameIds(root) {
  return list(root, 'apps').filter((id) => statSync(join(root, 'apps', id)).isDirectory() && (existsSync(join(root, 'apps', id, 'src')) || existsSync(join(root, 'apps', id, 'game.config.ts')))).sort();
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-board-files', json: options.json });
  const allGames = gameIds(root);
  for (const id of options.game) if (!allGames.includes(id)) fail(`game ${id} has no apps/${id} folder with src/ or game.config.ts`, 'Pass an existing game id (the folder name under apps/).');
  const games = options.game.length > 0 ? options.game : allGames;
  const hasHost = existsSync(join(root, GH));
  if (games.length === 0 && !hasHost) fail('nothing to check: no game under apps/ and no packages/shell/src/game-host', 'Run from the app repo root (or pass it as the argument).');
  const slice = readShellSlice(root);
  // A missing host or board folder is not "nothing to check": every expected file is reported, so
  // the list of files to copy comes from this checker (exit 1).
  checkHost(root, slice, report);
  for (const id of games) checkGame(root, id, report);
  // Items = the Shell host plus each game board (so a host-only repo still counts as one item).
  return report.finish({ checked: games.length + 1, unit: `items (host + ${games.length} board${games.length === 1 ? '' : 's'})` });
});
