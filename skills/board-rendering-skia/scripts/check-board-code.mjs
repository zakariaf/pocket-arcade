#!/usr/bin/env node
// check-board-code.mjs: checks the board rendering code of a Pocket Arcade app repo against the rules
// of the board-rendering-skia skill (worklets, frame clock, pure draw, Skia API, canvas, lifecycle).
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-board-code.mjs [repo-root]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { balancedParens, hasWorkletDirective, isTestFile, openingTag, readRepoFile, resolveSpecifier, valueImports } from './lib/source-scan.mjs';

const SPEC = {
  name: 'check-board-code',
  summary: 'Checks board rendering code (packages/game-kit/src/timeline, packages/game-kit/src/geom/board-layout.ts, packages/shell/src/game-host, apps/*/src/board) for the rendering rules.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as one JSON line' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  worklet-directive      UI-thread modules start with a file-level \'worklet\'; directive',
    '  worklet-import         a \'worklet\' module imports values only from other \'worklet\' modules or react-native-worklets',
    '  frame-clock            no timeSinceFirstFrame in runtime code (it resets on re-activation); use timestamp + startAt',
    '  worklets-api           no runOnJS/runOnUI; use scheduleOnRN/scheduleOnUI',
    '  shared-value-accessor  shared values are read and written with .get()/.set(), never .value',
    '  frame-callback-body    useFrameCallback((info) => { runXFrame(...); }, false): one runner call, starts inactive',
    '  draw-pure              draw files import Skia types only and never create Skia objects or read clocks/random',
    '  skia-path-api          paths use Skia.PathBuilder (immutable), never Skia.Path.Make() + add*/moveTo mutators',
    '  measure-text           no SkFont.measureText (unimplemented in CanvasKit); sum glyph widths',
    '  canvas-onlayout        <Canvas onSize={sharedValue}>, never onLayout',
    '  text-direction         TextDirection.RTL is 0 (falsy): never combine it with && or ||',
    '  pixel-flip             boards never pixel-flip (scaleX -1); mirror positions in BoardLayout',
    '  canvas-a11y            a board <Canvas> with a <Picture> has accessibilityRole="image" and accessibilityLabel (on the Canvas or on the element around it)',
    '  lifecycle              a component that runs useBoardClock also calls useGameLifecycle',
    '  clock-runnable         use-board-clock.ts routes push, stop, resume and every done message through board-clock-state',
    '                         (pushScene, stopClock, resumeClock, finishRun), never switches the frame callback with a literal',
    '                         setActive(true|false) and never reads the scene shared value on JS (a stale read stopped the',
    '                         continue scene after a rewarded ad, 2026-10-01)',
    '  recorder-per-canvas    Skia.PictureRecorder() is created per canvas (useState), never at module scope',
    '  interpolate-color      board colours use Skia interpolateColors, not Reanimated interpolateColor',
    '  reduced-motion-source  board code never calls useReducedMotion() (read once at app start); the Shell passes motion to buildTimeline',
    '',
    'Example: node check-board-code.mjs .',
  ].join('\n'),
};

const SCOPE = [
  'packages/game-kit/src/timeline/**',
  'packages/game-kit/src/geom/board-layout.ts',
  'packages/shell/src/game-host/**',
  'packages/shell/src/app/use-is-app-active.ts',
  'apps/*/src/board/**',
];
const WORKLET_REQUIRED = [
  /^packages\/game-kit\/src\/timeline\/[^/]+\.ts$/,
  /^packages\/game-kit\/src\/geom\/board-layout\.ts$/,
  /^packages\/shell\/src\/game-host\/(board-scene|board-clock-state|run-board-frame|record-board|describe-error|draw-centered-text)\.ts$/,
  /^apps\/[^/]+\/src\/board\/(draw|layout)[^/]*\.ts$/,
];
const ALLOWED_WORKLET_PACKAGES = new Set(['react-native-worklets']);
const DRAW_FILE = /^apps\/[^/]+\/src\/board\/draw[^/]*\.ts$/;
const BOARD_CODE = /^(apps\/[^/]+\/src\/board\/|packages\/shell\/src\/game-host\/)/;

function checkWorklet(ctx) {
  const { rel, source, root, report } = ctx;
  const isWorklet = hasWorkletDirective(source);
  if (WORKLET_REQUIRED.some((re) => re.test(rel)) && !isTestFile(rel) && !isWorklet) {
    report.problem({ file: rel, line: 1, rule: 'worklet-directive', message: "UI-thread module has no file-level 'worklet'; directive (a plain function called on the UI thread crashes at runtime)", fix: "Put 'worklet'; as the first statement, right after the // path comment." });
  }
  if (!isWorklet) return;
  for (const { spec, index } of valueImports(source)) {
    const target = resolveSpecifier(rel, spec);
    if (target === null) {
      if (!ALLOWED_WORKLET_PACKAGES.has(spec)) report.problem({ file: rel, line: lineOf(source, index), rule: 'worklet-import', message: `'worklet' module imports a value from the package ${spec}`, fix: 'Use `import type` for types; move runtime package calls to the JS thread (only react-native-worklets is allowed).' });
      continue;
    }
    const targetSource = readRepoFile(root, target);
    if (targetSource !== null && !hasWorkletDirective(targetSource)) {
      report.problem({ file: rel, line: lineOf(source, index), rule: 'worklet-import', message: `'worklet' module imports a value from ${target}, which is not a 'worklet' module`, fix: "Add 'worklet'; to that module (if it is pure) or move the shared helper into a 'worklet' module such as board-ids.ts." });
    }
  }
}

function checkFrameCallbacks(ctx) {
  const { rel, code, report } = ctx;
  for (const match of code.matchAll(/\buseFrameCallback\s*\(/g)) {
    const args = balancedParens(code, match.index + match[0].length - 1) ?? '';
    const isRunnerCall = /^\s*\(\s*\w+\s*\)\s*=>\s*\{\s*run[A-Z]\w*Frame\s*\([^;{}]*\)\s*;?\s*\}\s*,\s*false\s*$/.test(args);
    if (!isRunnerCall) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'frame-callback-body', message: 'useFrameCallback body is not a single call into a run*Frame runner, or does not start inactive (false)', fix: 'Write useFrameCallback((info) => { runBoardFrame(wiring, info.timestamp); }, false) and keep try/catch inside the runner.' });
  }
}

/** Shared values the kit passes around inside objects (clock.scene, clock.now, wiring.sim, props.command …). */
const KIT_SHARED_VALUES = ['scene', 'now', 'pointer', 'layout', 'picture', 'sim', 'command', 'accMs'];

function checkSharedValues(ctx) {
  const { rel, code, report } = ctx;
  // Locals from the hooks, plus every name typed as a SharedValue (props, wiring fields, parameters).
  const locals = [...code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*use(?:SharedValue|DerivedValue)\b/g)].map((m) => m[1]);
  const typed = [...code.matchAll(/\b(\w+)\??\s*:\s*SharedValue\s*</g)].map((m) => m[1]);
  const names = new Set([...locals, ...typed]);
  const kitChain = new RegExp(`\\.(${KIT_SHARED_VALUES.join('|')})\\.value\\b`);
  for (const match of code.matchAll(/(\.?)\b(\w+)\.value\b/g)) {
    const isNamed = match[1] === '' && names.has(match[2]);
    const isKitMember = match[1] === '.' && (names.has(match[2]) || kitChain.test(match[0]));
    if (!isNamed && !isKitMember) continue;
    const name = match[2];
    report.problem({ file: rel, line: lineOf(code, match.index), rule: 'shared-value-accessor', message: `shared value ${name} is accessed with .value`, fix: `Use ${name}.get() / ${name}.set(x) (React Compiler needs the accessors).` });
  }
}

function checkDraw(ctx) {
  const { rel, source, code, report } = ctx;
  if (!DRAW_FILE.test(rel)) return;
  for (const { spec, index } of valueImports(source)) {
    if (spec === '@shopify/react-native-skia') report.problem({ file: rel, line: lineOf(source, index), rule: 'draw-pure', message: 'draw file imports a value from @shopify/react-native-skia', fix: 'Import Skia types only (import type { SkCanvas } ...); every Skia object comes in through frame.kit.' });
  }
  const banned = [
    [/\bSkia\.\w+/g, 'creates or uses the Skia API inside draw', 'Build paints, colours, paths and fonts once in the kit (makeBoardKit, buildPaths) and read them from frame.kit.'],
    [/\bMath\.random\s*\(/g, 'reads Math.random inside draw', 'Take randomness from the view or from hashU32(seed, index) (particles).'],
    [/\b(Date\.now|performance\.now)\s*\(|\bnew\s+Date\b/g, 'reads a clock inside draw', 'Time arrives as frame.fx (the timeline sample); draw never reads a clock.'],
  ];
  for (const [re, message, fix] of banned) {
    for (const match of code.matchAll(re)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'draw-pure', message: `draw file ${message}`, fix });
  }
}

const PATTERN_RULES = [
  { rule: 'frame-clock', re: /\btimeSinceFirstFrame\b/g, runtimeOnly: true, message: 'uses timeSinceFirstFrame, which Reanimated resets to 0 whenever a frame callback is re-activated', fix: 'Stamp startAt = info.timestamp on the first frame (tickClock) and use elapsed = timestamp - startAt.' },
  { rule: 'worklets-api', re: /\brunOn(JS|UI)\b/g, runtimeOnly: false, message: 'uses the deprecated runOnJS/runOnUI', fix: 'Use scheduleOnRN(fn, ...args) / scheduleOnUI(fn, ...args) from react-native-worklets.' },
  { rule: 'skia-path-api', re: /\b[sS]kia\.Path\.Make\s*\(|\.add(Circle|Rect|RRect|Oval|Arc|Path|Poly)\s*\(/g, runtimeOnly: true, message: 'uses the mutable Skia path API (deprecated in Skia 2.6, to be removed)', fix: 'Build unit-size paths once with Skia.PathBuilder.Make()...build() (or Skia.Path.Circle) and place them with canvas.translate/scale.' },
  { rule: 'measure-text', re: /\.measureText\s*\(/g, runtimeOnly: false, message: 'uses SkFont.measureText, which CanvasKit (Jest, Node) does not implement', fix: 'Sum font.getGlyphWidths(font.getGlyphIDs(text)) as textWidth() in draw-centered-text.ts does.' },
  { rule: 'text-direction', re: /(&&|\|\|)\s*TextDirection\.\w+|TextDirection\.\w+\s*(&&|\|\|)/g, runtimeOnly: false, message: 'combines TextDirection with && or ||, but TextDirection.RTL is 0 (falsy)', fix: 'Choose explicitly: isRtl ? TextDirection.RTL : TextDirection.LTR.' },
  { rule: 'interpolate-color', re: /\binterpolateColor\s*\(/g, runtimeOnly: true, message: 'uses Reanimated interpolateColor for a Skia colour', fix: 'Use Skia interpolateColors (a different colour format), or resolve colours once in the palette.' },
  { rule: 'reduced-motion-source', re: /\buseReducedMotion\s*\(/g, runtimeOnly: true, message: 'calls useReducedMotion(), which Reanimated reads once at app start, so a later Reduce motion change is missed', fix: "Take the Shell's Reduce motion setting (it defaults to the OS setting) and pass it as buildTimeline(events, motion)." },
  { rule: 'recorder-per-canvas', re: /^(?:export\s+)?(?:const|let)\s+\w+\s*=\s*Skia\.PictureRecorder\s*\(/gm, runtimeOnly: true, message: 'creates a PictureRecorder at module scope', fix: 'Create one recorder per canvas in render: const [recorder] = useState(() => Skia.PictureRecorder()).' },
];

function checkPatterns(ctx) {
  const { rel, code, report } = ctx;
  for (const spec of PATTERN_RULES) {
    if (spec.runtimeOnly && isTestFile(rel)) continue;
    for (const match of code.matchAll(spec.re)) report.problem({ file: rel, line: lineOf(code, match.index), rule: spec.rule, message: spec.message, fix: spec.fix });
  }
  if (BOARD_CODE.test(rel) && !isTestFile(rel)) {
    for (const match of code.matchAll(/scaleX\s*:\s*-\s*1\b|\.scale\(\s*-\s*1\s*,/g)) {
      report.problem({ file: rel, line: lineOf(code, match.index), rule: 'pixel-flip', message: 'pixel-flips the board (letters and digits would mirror)', fix: 'Set isMirroredInRtl on the board and let BoardLayout mirror positions (cellRect/hitTest).' });
    }
  }
}

/**
 * True when the Canvas sits inside an element that is itself the VoiceOver image (accessible,
 * accessibilityRole="image", accessibilityLabel), for example a View that measures the picture
 * before the Canvas exists: that element speaks for the whole picture.
 */
function hasImageWrapper(code, canvasIndex) {
  const before = code.slice(0, canvasIndex);
  const roles = [...before.matchAll(/accessibilityRole\s*=\s*["']image["']/g)];
  if (roles.length === 0) return false;
  const start = before.lastIndexOf('<', roles.at(-1).index);
  if (start === -1) return false;
  const tag = openingTag(code, start);
  const name = /^<([A-Za-z][\w.]*)/.exec(tag)?.[1];
  if (name === undefined || tag.endsWith('/>') || !/\baccessibilityLabel\s*=/.test(tag)) return false;
  return !code.slice(start + tag.length, canvasIndex).includes(`</${name}>`);
}

function checkComponents(ctx) {
  const { rel, code, report } = ctx;
  if (!rel.endsWith('.tsx') || isTestFile(rel)) return;
  for (const match of code.matchAll(/<Canvas\b/g)) {
    const tag = openingTag(code, match.index);
    if (/\bonLayout\s*=/.test(tag)) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'canvas-onlayout', message: '<Canvas onLayout> is deprecated on Fabric', fix: 'Pass a shared value: <Canvas onSize={size}>.' });
    const hasA11y = (/accessibilityRole\s*=\s*["']image["']/.test(tag) && /\baccessibilityLabel\s*=/.test(tag)) || hasImageWrapper(code, match.index);
    if (/<Picture\b/.test(code) && !hasA11y) report.problem({ file: rel, line: lineOf(code, match.index), rule: 'canvas-a11y', message: 'board canvas has no accessibilityRole="image" and accessibilityLabel (Skia content is invisible to VoiceOver)', fix: 'Add accessible accessibilityRole="image" accessibilityLabel={t(board.describe(view))} to the <Canvas>.' });
  }
  if (/\buseBoardClock\s*\(/.test(code) && !/\buseGameLifecycle\s*\(/.test(code)) {
    report.problem({ file: rel, line: lineOf(code, code.search(/\buseBoardClock\s*\(/)), rule: 'lifecycle', message: 'runs a board clock without useGameLifecycle (it would keep running in the background, under ads and when the screen loses focus)', fix: 'Call useGameLifecycle({ isFocused, isFullscreenAdShowing, onPause, onResume }) next to useBoardClock.' });
  }
}

const CLOCK_HOOK = 'packages/shell/src/game-host/use-board-clock.ts';
const CLOCK_DECISIONS = ['pushScene', 'stopClock', 'resumeClock', 'finishRun'];

/**
 * The board clock's JS side keeps its own record (board-clock-state) and asks it for every switch:
 * a scene pushed while the board is not runnable waits, every resume runs at least one frame, and a
 * done message names its run, so a stale one cannot stop a newer scene.
 */
function checkClockRunnable(ctx) {
  const { rel, source, code, report } = ctx;
  if (rel !== CLOCK_HOOK) return;
  const imported = new Set(
    [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/board-clock-state\.ts['"]/g)].flatMap((m) =>
      m[1].split(',').map((name) => name.trim().replace(/^type\s+/, '')),
    ),
  );
  const missing = CLOCK_DECISIONS.filter((name) => !imported.has(name));
  if (missing.length > 0) {
    report.problem({ file: rel, line: 1, rule: 'clock-runnable', message: `the clock hook does not route its decisions through board-clock-state (missing ${missing.join(', ')})`, fix: "Import pushScene, stopClock, resumeClock and finishRun from './board-clock-state.ts' and apply each step's setActive (the template's apply(step))." });
  }
  for (const match of code.matchAll(/\.setActive\(\s*(true|false)\s*\)/g)) {
    report.problem({ file: rel, line: lineOf(code, match.index), rule: 'clock-runnable', message: `switches the frame callback with a literal setActive(${match[1]}) instead of a board-clock-state step`, fix: 'Call apply(pushScene(...)), apply(stopClock(...)), apply(resumeClock(...)) or apply(finishRun(...)); apply sets the run, then setActive(step.setActive).' });
  }
  for (const match of code.matchAll(/\bscene\s*\.\s*get\s*\(/g)) {
    report.problem({ file: rel, line: lineOf(code, match.index), rule: 'clock-runnable', message: 'reads the scene shared value on the JS thread (until the UI applies a push, the read returns the old scene, so a stale done stopped the new one)', fix: "Keep the last push in the clock driver's ClockControl (board-clock-state) and let finishRun compare the done message's run with control.run." });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const report = createReporter({ name: 'check-board-code', json: options.json });
  const files = walk(root, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, '*.d.ts'] }).filter((rel) =>
    SCOPE.some((glob) => new RegExp(`^${glob.replace(/\./g, '\\.').replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+')}$`).test(rel)),
  );
  for (const rel of files) {
    const source = readFileSync(join(root, rel), 'utf8');
    const ctx = { rel, source, code: maskComments(source), root, report };
    checkWorklet(ctx);
    checkFrameCallbacks(ctx);
    checkSharedValues(ctx);
    checkDraw(ctx);
    checkPatterns(ctx);
    checkComponents(ctx);
    checkClockRunnable(ctx);
  }
  return report.finish({ checked: files.length, unit: 'board source files' });
});
