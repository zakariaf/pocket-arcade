#!/usr/bin/env node
// check-harness.mjs: checks the app repo's side of screen parity without a simulator: the
// test-only parity harness is complete (every template file), knows exactly the design frames (keys,
// root testIDs, tall frames), reads the -parity launch argument, loads the design's player from a
// copy of the frames manifest's fixtureSave, types no price, is exported only through
// test-only-entry.ts and wired into the Shell's startup through TEST_ONLY, the component specs draw
// the edge widths the references draw, capture output is gitignored, the waiver and sign-off
// files are well formed, every frame state has its opener in the hook that owns it, the frozen-motion
// switch, the board probe and the consent hold are wired, every launch's nonce marker is drawn (by
// the parity root and inside every modal root), and parity/game-facts.json holds each app's facts
// (hasMusic, winLine, hasHints), pinned to the game module by apps/<id>/src/parity-game-facts.test.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, maskComments, parseArgs, readShellSlice, requireDir, run, sliceSkipReason, walk } from './check-lib.mjs';
import { compareComponentBorders, referenceLayouts } from './lib/component-borders.mjs';
import { DESIGN_GAMES, FACT_VALUES, FACTS_FILE, loadCatalogue } from './lib/frames.mjs';
import { DEFAULTS, readJson } from './lib/paths.mjs';
import { readWaivers } from './lib/runs.mjs';

const PARITY_DIR = 'packages/shell/src/app/parity';
// Test-only code that the test-only entry reaches (architecture-and-boundaries' testOnlyFolders).
const TEST_ONLY_FOLDERS = ['packages/shell/src/screens/debug/'];
const STARTUP = 'packages/shell/src/app/parity-startup.tsx';
/** Where the held S1 splash is registered (rtl-and-direction's start-shell template). */
const HELD_SPLASH_FILE = 'packages/shell/src/app/start-shell.ts';
const SPECS = 'packages/shell/src/ui/component-specs.json';
const FILES = {
  plans: `${PARITY_DIR}/parity-plans.ts`,
  request: `${PARITY_DIR}/parity-request.ts`,
  reader: `${PARITY_DIR}/read-parity-request.ts`,
  fixtureSave: `${PARITY_DIR}/parity-fixture-save.json`,
  fixture: `${PARITY_DIR}/parity-fixture.ts`,
  doc: `${PARITY_DIR}/parity-doc.ts`,
  session: `${PARITY_DIR}/parity-session.ts`,
  ads: `${PARITY_DIR}/parity-ads.tsx`,
  purchase: `${PARITY_DIR}/parity-purchase.ts`,
  start: `${PARITY_DIR}/parity-start.ts`,
  errorView: `${PARITY_DIR}/parity-error-view.tsx`,
  root: `${PARITY_DIR}/parity-root.tsx`,
  startup: STARTUP,
  marker: 'packages/shell/src/app/parity-launch-marker.tsx',
  entry: 'packages/shell/src/app/test-only-entry.ts',
};

/** What test-only-entry.ts exports for the harness (TestOnlyApi members of the same names). */
const ENTRY_EXPORTS = [
  'readParityRequest',
  'startParitySession',
  'createParityErrorRoot',
  'parityDoc',
  'createParityAds',
  'createParityPurchase',
  'parityInitialState',
  'isHeldParityStart',
  'ParityFrameRoot',
  'parityBuildNumber',
  'parityFrameState',
  'isParityMotionFrozen',
  'isParityBoardProbeOn',
  'parityGameFixture',
];

/** What parity-session.ts exports for the model hooks and hosts (the session side of the harness). */
const SESSION_EXPORTS = ['startParitySession', 'parityBuildNumber', 'parityFrameState', 'isParityMotionFrozen', 'isParityBoardProbeOn', 'parityGameFixture'];

/**
 * Who opens each frame state: the model hook that owns the state applies parityFrameState() once on
 * mount, through the handler a player's tap would use. The opener is found as
 * `parityFrameState() === '<state>'` in that hook file or a use-*.ts helper next to it. The screen
 * is the one whose slice membership decides whether the opener is due; `fails` says what a capture
 * without the opener shows when its root is still reached (a switch in the wrong position).
 */
const OPENERS = {
  'pause-open': { screen: 'S6', file: 'packages/shell/src/game-host/use-game-session-controls.ts', how: 'pause() once, after debugControls().applyFixtureHud(parityGameFixture())' },
  'result-win': { screen: 'S7', file: 'packages/shell/src/game-host/use-game-session-controls.ts', how: 'host.debugControls().showFixtureResult(parityGameFixture())' },
  'result-lose': { screen: 'S7', file: 'packages/shell/src/game-host/use-game-session-controls.ts', how: 'host.debugControls().showFixtureResult(parityGameFixture())' },
  'levels-locked-tile-tapped': { screen: 'S8', file: 'packages/shell/src/screens/levels/use-levels-model.ts', how: 'the first locked tile\'s tap handler, once' },
  'how-to-play-step-2': { screen: 'S13', file: 'packages/shell/src/screens/how-to-play/use-how-to-play-model.ts', how: 'Next once (step 2 of 4)' },
  'premium-purchasing': { screen: 'S12', file: 'packages/shell/src/screens/premium/use-premium-model.ts', how: 'Buy once' },
  'premium-pending-approval': { screen: 'S12', file: 'packages/shell/src/screens/premium/use-premium-model.ts', how: 'Buy once' },
  'premium-success': { screen: 'S12', file: 'packages/shell/src/screens/premium/use-premium-model.ts', how: 'Buy once' },
  'premium-error': { screen: 'S12', file: 'packages/shell/src/screens/premium/use-premium-model.ts', how: 'Buy once' },
  'premium-restore-toasts': { screen: 'S12', file: 'packages/shell/src/screens/premium/use-premium-model.ts', how: 'the four restore toasts, stacked' },
  'reset-progress-dialog-held': { screen: 'S11', file: 'packages/shell/src/screens/settings/use-settings-model.ts', how: 'the reset dialog with useHoldToConfirm frozenProgress 0.46' },
  'restart-dialog': { screen: 'S11a', file: 'packages/shell/src/screens/settings/language/use-settings-language-model.ts', how: 'the restart dialog' },
  'save-restored-dialog': { screen: 'S4', file: 'packages/shell/src/screens/home/use-home-model.ts', how: 'the progress-restored dialog' },
  // S15 is test-only and still a design frame (L12): its frame draws "Always show test ads" on.
  'debug-ads-always-test': { screen: 'S15', file: 'packages/shell/src/screens/debug/use-debug-model.ts', how: "parityFrameState() === 'debug-ads-always-test', read from app/parity/parity-session.ts (S15 is reached through the test-only entry, so never useParityOpener, which would close an import loop through the gate), turning the 'Always show test ads' switch on once on mount through its own handler (debug ads override 'always-test')", fails: 'the capture draws the switch off and fails structure on debug.ads-always-test-switch.toggle' },
};
/** States the parity store port produces on its own (no opener). */
const PORT_STATES = ['premium-loading-price', 'premium-store-unavailable', 'premium-already-owned'];

/**
 * The state each design frame draws on top of its start screen (every other frame: none). A plan
 * without it can never match its reference (S15 drawn with "Always show test ads" off), however
 * complete the openers are, so the plan's state is compared with this table (rule harness-frame-state).
 */
const FRAME_STATES = {
  's6-pause': 'pause-open',
  's7-result-win': 'result-win',
  's7-result-lose': 'result-lose',
  's8-levels': 'levels-locked-tile-tapped',
  's12-loading-price': 'premium-loading-price',
  's12-store-unavailable-offline': 'premium-store-unavailable',
  's12-purchase-in-progress': 'premium-purchasing',
  's12-pending-approval': 'premium-pending-approval',
  's12-success': 'premium-success',
  's12-error': 'premium-error',
  's12-already-owned': 'premium-already-owned',
  's12-restore-results-toasts': 'premium-restore-toasts',
  's13-how-to-play': 'how-to-play-step-2',
  's14-reset-all-progress': 'reset-progress-dialog-held',
  's14-restart-to-apply': 'restart-dialog',
  's14-progress-restored': 'save-restored-dialog',
  's15-debug-menu': 'debug-ads-always-test',
};

/** Wiring outside the harness: file, the call it must make, the screens that need it. */
const WIRING = [
  { name: 'isParityMotionFrozen', file: 'packages/shell/src/app/use-reduce-motion.ts', pattern: /\bisParityMotionFrozen\s*\(/, screens: null, fix: 'useReduceMotion() returns true while TEST_ONLY?.isParityMotionFrozen() is true (the one frozen-motion switch); the saved setting stays as it is.' },
  { name: 'isParityBoardProbeOn', file: null, pattern: /\bisParityBoardProbeOn\s*\(/, screens: ['S5', 'S6', 'S7'], fix: "The host's isLayoutProbeOn closure (create-shell-parts.ts) is also true while TEST_ONLY?.isParityBoardProbeOn() is, so the probe=board launch renders game.board-layout." },
];

/**
 * The modal roots of the Shell: a modal layer hides everything outside it from the accessibility
 * tree Maestro reads, so each draws the launch's nonce marker inside itself (the parity root draws
 * one for every other frame). The screen decides whether the file is due in a partial Shell.
 */
const MODAL_ROOTS = [
  { file: 'packages/shell/src/ui/scrim.tsx', screen: 'S14', what: 'the Scrim (S6 Pause and the S14 dialogs)' },
  { file: 'packages/shell/src/screens/result/result-overlay.tsx', screen: 'S7', what: 'the Result overlay (S7)' },
  { file: 'packages/shell/src/app/consent-moment.tsx', screen: 'S3', what: 'the consent cover (S3)' },
];

/** The startup steps (parity-startup.tsx) the Shell calls; a harness nobody applies draws nothing. */
const STARTUP_CALLS = {
  readParityLaunch: 'start-shell.ts, before the direction check',
  parityLaunchFor: 'start-shell.ts, as the launch it passes to createShellApp',
};

/** The ShellLaunch members the composition root runs (parityLaunchFor fills them for a frame). */
const LAUNCH_MEMBERS = {
  prepareSave: 'right after hydrateSave (the frame\'s player data and date)',
  purchasePort: 'as the Premium store port',
  adsPort: 'as the ads port',
  initialState: 'for the navigator\'s first state',
  wrapRoot: 'around the root component it returns',
  isConsentMomentHeld: 'in the consent moment host, which shows ConsentIntroScreen and holds it while it returns true (S3)',
};
/** Launch members only a screen of the slice needs. */
const LAUNCH_MEMBER_SCREENS = { isConsentMomentHeld: 'S3' };

/** The premium skill's price pattern: a price is never typed, not even in the harness. */
const PRICE = /(?:[€$£]\s?\d)|(?:\d+[.,]\d{2}\s?(?:€|EUR|USD|\$))|(?:\bEUR\s?\d)/;

const SPEC = {
  name: 'check-harness',
  summary:
    'Checks the app repo for screen parity: the test-only parity harness (packages/shell/src/app/parity/) has one plan ' +
    'per design frame with the right root testID, reads the -parity launch argument, is reachable only through ' +
    'test-only-entry.ts and is called from the Shell (TEST_ONLY?.readParityRequest()), .parity/ is gitignored, and ' +
    'parity/waivers.json and parity/signoff.json are well formed.',
  usage: '[app-repo-root] [options]',
  options: {
    frames: { type: 'string', value: 'file', help: 'Frames manifest', default: DEFAULTS.frames },
    map: { type: 'string', value: 'file', help: 'Screen testID map', default: DEFAULTS.map },
    reference: { type: 'string', value: 'dir', help: 'Reference root whose .layout.json borders the component specs must match', default: DEFAULTS.reference },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Copy the harness from templates/packages/shell/src/app/parity/ and templates/packages/shell/src/app/parity-startup.tsx,',
    'use the shared test-only-entry.ts and test-only-api.ts (templates/packages/shell/src/app/), call readParityLaunch and parityLaunchFor from start-shell.ts',
    '(the composition root runs the launch\'s members), and add ".parity/" to .gitignore.',
    '',
    'Example: node check-harness.mjs .',
  ].join('\n'),
};

/** { key: { root, tall, state, line } } from parity-plans.ts ('<key>': plan('<root>', '<Start>', { ... tall: true })). */
function readPlans(text) {
  const plans = new Map();
  const clean = maskComments(text);
  const re = /'([a-z0-9-]+)':\s*plan\(\s*'([^']+)'\s*,\s*'(\w+)'\s*(?:,\s*\{([^}]*)\})?\s*\)/g;
  for (const m of clean.matchAll(re)) {
    const line = clean.slice(0, m.index).split('\n').length;
    const state = /\bstate:\s*'([a-z0-9-]+)'/.exec(m[4] ?? '')?.[1] ?? null;
    plans.set(m[1], { root: m[2], start: m[3], tall: /\btall:\s*true\b/.test(m[4] ?? ''), state, line, count: (plans.get(m[1])?.count ?? 0) + 1 });
  }
  return plans;
}

/** The first path where two JSON values differ, or null. */
function firstDifference(want, got, path = 'fixtureSave') {
  if (typeof want !== typeof got || Array.isArray(want) !== Array.isArray(got) || (want === null) !== (got === null)) return { path, want, got };
  if (want === null || typeof want !== 'object') return want === got ? null : { path, want, got };
  const keys = [...new Set([...Object.keys(want), ...Object.keys(got)])];
  for (const key of keys) {
    const diff = firstDifference(want[key], got[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}

/** Names a file exports: export { a, b as c } [from ...], export const/function/class d. */
function exportedNames(text) {
  const clean = maskComments(text);
  const names = new Set();
  for (const m of clean.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).at(-1)?.trim();
      if (name) names.add(name.replace(/^type\s+/, ''));
    }
  }
  for (const m of clean.matchAll(/export\s+(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return names;
}

/** String literals of a source (comments masked) with their line numbers. */
function stringLiterals(text) {
  const clean = maskComments(text);
  const out = [];
  for (const m of clean.matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)) {
    out.push({ literal: m[0], line: clean.slice(0, m.index).split('\n').length });
  }
  return out;
}

const isTest = (rel) => /\.test\.tsx?$/.test(rel);

function importsOf(text) {
  const out = [];
  const clean = maskComments(text);
  const re = /^\s*(import|export)\s+(type\s+)?[^;'"]*?from\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;
  for (const m of clean.matchAll(re)) {
    const at = m.index + Math.max(0, m[0].search(/\S/));
    out.push({ spec: m[3] ?? m[4] ?? m[5], typeOnly: Boolean(m[2]), line: clean.slice(0, at).split('\n').length });
  }
  return out;
}

/** The app folders that hold a game module (apps/<id>/src/index.ts). */
function gameApps(root) {
  const dir = join(root, 'apps');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'src', 'index.ts'))).map((d) => d.name).sort();
}

/** Every file under a folder whose name matches, as text (comments masked). */
function textsUnder(root, rel, pattern) {
  const out = [];
  if (!existsSync(join(root, rel))) return out;
  for (const file of walk(join(root, rel), { include: ['*.ts', '*.json'], ignore: ['*.test.ts', '*.golden.test.ts'] })) {
    if (pattern.test(file)) out.push(maskComments(readFileSync(join(root, rel, file), 'utf8')));
  }
  return out;
}

/**
 * parity/game-facts.json: one entry per game app, valid facts, and equal to the PARITY_GAME_FACTS of
 * apps/<id>/src/parity-game-facts.test.ts, which pins them to the module through the Shell's
 * hasMusicOf and isScoreRatedOf. A quick static look at the module catches a plain contradiction
 * here already: a sound in category music, or a score stars rule.
 */
function checkGameFacts({ root, slice, frames, report, problem, read }) {
  const screens = [...new Set([...frames.values()].filter((f) => Object.keys(f.variants ?? {}).length).flatMap((f) => f.entries.map((e) => e.screen)))];
  const needed = screens.filter((id) => !sliceSkipReason(slice, id));
  if (needed.length === 0 || sliceSkipReason(slice)) {
    report.skip({ file: FACTS_FILE, rule: 'harness-game-facts', message: sliceSkipReason(slice) ?? `${screens.join(', ')} not in shell-slice.json` });
    return;
  }
  const text = read(FACTS_FILE);
  const fix = "Copy the skill's templates/parity/game-facts.json to parity/game-facts.json and give every game app its facts (designGame, hasMusic, winLine, hasHints).";
  if (text === null) {
    problem(FACTS_FILE, 0, 'harness-game-facts', `does not exist, so the reference variants of ${needed.join(', ')} cannot be chosen`, fix);
    return;
  }
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    problem(FACTS_FILE, 0, 'harness-game-facts', `not valid JSON: ${error.message}`, fix);
    return;
  }
  if (json?.version !== 1 || !json.games || typeof json.games !== 'object' || Array.isArray(json.games)) {
    problem(FACTS_FILE, 0, 'harness-game-facts', 'expected { "version": 1, "games": { "<app id>": { "designGame", "hasMusic", "winLine", "hasHints" } } }', fix);
    return;
  }
  for (const id of gameApps(root)) if (!json.games[id]) problem(FACTS_FILE, 0, 'harness-game-facts', `has no entry for the game app ${id}`, `Add "${id}": { "designGame": ..., "hasMusic": ..., "winLine": ..., "hasHints": ... } (its test apps/${id}/src/parity-game-facts.test.ts pins them).`);
  for (const [id, entry] of Object.entries(json.games)) {
    const at = `games.${id}`;
    if (!existsSync(join(root, 'apps', id))) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}: there is no app folder apps/${id}`, 'Key each entry by its app id (the apps/<id> folder).');
    if (!DESIGN_GAMES.includes(entry?.designGame)) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}.designGame must be one of ${DESIGN_GAMES.join(', ')}`, 'Name the design game whose references the app is compared with.');
    for (const [key, values] of Object.entries(FACT_VALUES)) {
      if (!values.includes(entry?.[key])) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}.${key} must be ${values.map((v) => JSON.stringify(v)).join(' or ')}`, 'Set the fact from the game module (the test pins it).');
    }
    const testRel = `apps/${id}/src/parity-game-facts.test.ts`;
    const test = read(testRel);
    if (test === null) {
      if (existsSync(join(root, 'apps', id))) problem(testRel, 0, 'harness-game-facts', 'does not exist, so nothing pins the facts of this app to its module', "Copy the skill's templates/apps/__GAME_ID__/src/parity-game-facts.test.ts and fill in the game.");
      continue;
    }
    const clean = maskComments(test);
    if (!/\bhasMusicOf\s*\(/.test(clean) || !/\bisScoreRatedOf\s*\(/.test(clean) || !/\bhasHintsOf\s*\(/.test(clean)) problem(testRel, 0, 'harness-game-facts', 'does not compare the facts with hasMusicOf(game), isScoreRatedOf(game) and hasHintsOf(game)', 'Copy the template test again: it pins the facts through the Shell helpers of game-host/game-facts.ts.');
    const block = /PARITY_GAME_FACTS\s*=\s*\{([^}]*)\}/.exec(clean)?.[1] ?? '';
    const inTest = {
      designGame: /designGame:\s*'([^']*)'/.exec(block)?.[1],
      hasMusic: /hasMusic:\s*(true|false)/.exec(block)?.[1],
      winLine: /winLine:\s*'([^']*)'/.exec(block)?.[1],
      hasHints: /hasHints:\s*(true|false)/.exec(block)?.[1],
    };
    const inFile = { designGame: entry?.designGame, hasMusic: String(entry?.hasMusic), winLine: entry?.winLine, hasHints: String(entry?.hasHints) };
    const differ = Object.keys(inTest).filter((k) => inTest[k] !== inFile[k]);
    if (differ.length) problem(FACTS_FILE, 0, 'harness-game-facts', `${at} disagrees with PARITY_GAME_FACTS in ${testRel} on ${differ.map((k) => `${k} (${inFile[k]} vs ${inTest[k] ?? 'missing'})`).join(', ')}`, 'The test pins the facts to the module: fix the one that is wrong, keep both equal (a Gate-Change trailer names the change).');
    const hasMusicSound = textsUnder(root, `apps/${id}/src/sounds`, /./).some((t) => /category:\s*'music'/.test(t));
    if (entry?.hasMusic === false && hasMusicSound) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}.hasMusic is false, but apps/${id}/src/sounds has a sound in category music (the module disagrees)`, 'Set hasMusic true (the Music rows and key show), or remove the music sound.');
    const scoreRule = textsUnder(root, `apps/${id}/src/levels`, /./).some((t) => /kind['"]?\s*:\s*['"]score['"]/.test(t));
    if (entry?.winLine === 'moves' && scoreRule) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}.winLine is moves, but apps/${id}/src/levels rates levels by score (the module disagrees)`, 'Set winLine "score": the win card shows the score line, not moves with par.');
    const hintPolicy = textsUnder(root, `apps/${id}/src/rules`, /./).map((t) => /hints\s*:\s*\{\s*kind\s*:\s*['"](\w+)['"]/.exec(t)?.[1]).find(Boolean);
    if (hintPolicy && (hintPolicy === 'solver') !== (entry?.hasHints === true)) problem(FACTS_FILE, 0, 'harness-game-facts', `${at}.hasHints is ${entry?.hasHints}, but apps/${id}/src/rules gives hints: { kind: '${hintPolicy}' } (the module disagrees)`, `Set hasHints ${hintPolicy === 'solver'} (true exactly when the hint policy is a solver: the S5 top bar then has its hint key).`);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(resolve(positionals[0] ?? '.'), 'app repo root');
  requireDir(join(root, 'packages', 'shell'), 'packages/shell (the Shell package of the app repo)');
  const { frames, manifest } = loadCatalogue({ mapPath: resolve(options.map), framesPath: resolve(options.frames) });
  const report = createReporter({ name: 'check-harness' });
  const problem = (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix });
  // A partial Shell (shell-slice.json) checks only what its screens need; no file means every rule.
  const slice = readShellSlice(root);
  const skipFor = (screen) => sliceSkipReason(slice, screen) ?? (screen && sliceSkipReason(slice));
  const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);
  let checked = 0;

  // 1. The harness files exist.
  const texts = Object.fromEntries(Object.entries(FILES).map(([k, rel]) => [k, read(rel)]));
  for (const [k, rel] of Object.entries(FILES)) {
    if (texts[k] === null) problem(rel, 0, 'harness-missing', 'does not exist', `Copy templates/${rel} from the skill${k === 'entry' ? ' (the shared test-only-entry.ts, which also ships with ios-simulator-build)' : ''}.`);
  }

  // 2. One plan per design frame, with the frame's root testID and tall flag.
  if (texts.plans !== null) {
    checked += 1;
    const plans = readPlans(texts.plans);
    const wanted = [...frames.values()].filter((f) => f.kind !== 'mock-only');
    for (const frame of wanted) {
      const plan = plans.get(frame.key);
      if (!plan) {
        problem(FILES.plans, 0, 'harness-frame-missing', `no plan for design frame ${frame.key} (root ${frame.root})`, `Add '${frame.key}': plan('${frame.root}', '<Start>', { ... }) with the state the frames manifest describes.`);
        continue;
      }
      if (plan.count > 1) problem(FILES.plans, plan.line, 'harness-frame-duplicate', `${frame.key} has ${plan.count} plans`, 'Keep one plan per frame.');
      if (plan.root !== frame.root) problem(FILES.plans, plan.line, 'harness-root', `${frame.key} has root "${plan.root}" but the design frame's root testID is "${frame.root}"`, `Use '${frame.root}': capture-app waits for it and check-parity proves the screen with it.`);
      const tall = frame.kind === 'phone-tall';
      if (plan.tall !== tall) problem(FILES.plans, plan.line, 'harness-tall', `${frame.key} is ${tall ? '' : 'not '}a tall frame in the design but its plan says tall: ${plan.tall}`, tall ? 'Add { tall: true }: the frame is captured at several scroll offsets.' : 'Remove tall: true.');
      const state = FRAME_STATES[frame.key] ?? null;
      if (plan.state !== state) {
        problem(FILES.plans, plan.line, 'harness-frame-state', `${frame.key} has state ${plan.state ? `'${plan.state}'` : 'none'}, but the design frame draws ${state ? `'${state}'` : 'no state'}, so its capture can never match the reference`, state ? `Copy the template parity-plans.ts again: '${frame.key}' plans { state: '${state}' }, which the hook that owns it opens once on mount.` : `Remove the state: the frame draws its start screen as it is.`);
      }
    }
    const known = new Set(wanted.map((f) => f.key));
    for (const [key, plan] of plans) {
      if (!known.has(key)) problem(FILES.plans, plan.line, 'harness-frame-unknown', `plan "${key}" is not a design frame`, `Use the frame keys of the design (${[...known].slice(0, 4).join(', ')}, ...).`);
    }
    if (plans.size === 0) problem(FILES.plans, 0, 'harness-frame-missing', 'no plan(...) entries found', 'Copy the template parity-plans.ts.');
  }

  // 3. The request parser and the launch argument.
  if (texts.request !== null) {
    checked += 1;
    if (!/export function parseParityRequest\s*\(/.test(texts.request)) problem(FILES.request, 0, 'harness-parser', 'does not export parseParityRequest()', 'Copy the template parity-request.ts.');
    else if (!/key:\s*'probe'/.test(maskComments(texts.request))) problem(FILES.request, 0, 'harness-parser', 'does not accept probe=board, the launch capture-app.mjs makes before a Game-route frame to read the board rectangle', 'Copy the template parity-request.ts (it parses probe=board into request.probe).');
  }
  if (texts.session !== null) {
    checked += 1;
    const exported = exportedNames(texts.session);
    const missing = SESSION_EXPORTS.filter((name) => !exported.has(name));
    if (missing.length) problem(FILES.session, 0, 'harness-session', `does not export ${missing.join(', ')}`, 'Copy the template parity-session.ts: the frozen-motion switch (isParityMotionFrozen), the board probe (isParityBoardProbeOn) and the design numbers of the Game frames (parityGameFixture) live there.');
  }
  if (texts.reader !== null) {
    checked += 1;
    const arg = /PARITY_LAUNCH_ARGUMENT\s*=\s*'([^']*)'/.exec(texts.reader)?.[1];
    if (arg !== 'parity') problem(FILES.reader, 0, 'harness-launch-arg', `reads the launch argument "${arg ?? '(none)'}", but capture-app.mjs passes -parity`, "Set PARITY_LAUNCH_ARGUMENT = 'parity'.");
    if (!/import\s*\{[^}]*\bSettings\b[^}]*\}\s*from\s*'react-native'/.test(texts.reader)) problem(FILES.reader, 0, 'harness-launch-arg', 'does not read launch arguments through React Native Settings', "Import { Settings } from 'react-native' (iOS puts -parity into NSUserDefaults).");
  }

  // 3b. The design's player in save terms: the app's copy equals the frames manifest's fixtureSave,
  // and no harness file types a price (the fixture's price and currency go through the Shell's
  // store formatting, like StoreKit's).
  if (texts.fixtureSave !== null) {
    checked += 1;
    let got = null;
    try {
      got = JSON.parse(texts.fixtureSave);
    } catch (error) {
      problem(FILES.fixtureSave, 0, 'harness-fixture', `not valid JSON: ${error.message}`, 'Copy the template parity-fixture-save.json again.');
    }
    const want = manifest.fixtureSave;
    const diff = got !== null && want !== undefined ? firstDifference(want, got) : null;
    if (diff) {
      problem(FILES.fixtureSave, 0, 'harness-fixture', `differs from the frames manifest's fixtureSave at ${diff.path}: ${JSON.stringify(diff.got) ?? 'missing'} where the manifest has ${JSON.stringify(diff.want) ?? 'nothing'}`, "Copy the template parity-fixture-save.json again: it is the design's player in save terms, and every number on screen comes from it (never edit it to make a frame pass).");
    }
  }
  for (const [k, rel] of Object.entries(FILES)) {
    if (texts[k] === null || k === 'fixtureSave' || k === 'entry') continue;
    for (const { literal, line } of stringLiterals(texts[k])) {
      if (PRICE.test(literal)) problem(rel, line, 'harness-typed-price', `price-like text ${literal} in the harness`, 'Take the price and currency from the fixture (parity-fixture-save.json, store) and let the Shell format it; a typed price would also fail the premium checker.');
    }
  }

  // 4. Reachable only through test-only-entry.ts (a value import anywhere else ships it in store builds).
  if (texts.entry !== null) {
    checked += 1;
    const exported = exportedNames(texts.entry);
    const missing = ENTRY_EXPORTS.filter((name) => !exported.has(name));
    if (missing.length) {
      problem(FILES.entry, 0, 'harness-not-exported', `does not export ${missing.join(', ')}`, "Copy the shared test-only-entry.ts and test-only-api.ts from the skill's templates/packages/shell/src/app/: they export each harness member, tagged /** @public */, with its TestOnlyApi member.");
    }
  }
  const sources = [];
  // The Shell and the apps, never the in-repo skill library or generated native folders.
  for (const rel of walk(root, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, 'dist'] })) {
    if (rel.startsWith('packages/') || rel.startsWith('apps/')) sources.push(rel);
  }
  let callers = 0;
  const wired = new Set();
  for (const rel of sources) {
    if (rel.startsWith(`${PARITY_DIR}/`) || rel === FILES.entry) continue;
    checked += 1;
    const source = readFileSync(join(root, rel), 'utf8');
    const clean = maskComments(source);
    if (!isTest(rel) && /\bTEST_ONLY\s*\??\.\s*readParityRequest\s*\(/.test(clean)) callers += 1;
    if (!isTest(rel) && rel !== STARTUP) {
      for (const name of Object.keys(STARTUP_CALLS)) if (new RegExp(`\\b${name}\\s*\\(`).test(clean)) wired.add(name);
      if (/\bwithParityRoot\s*\(/.test(clean)) wired.add('withParityRoot');
      for (const name of Object.keys(LAUNCH_MEMBERS)) if (new RegExp(`\\.${name}\\s*\\?\\.\\s*\\(`).test(clean)) wired.add(`launch.${name}`);
    }
    // Tests never ship, so they may import the harness directly. Neither does the test-only debug
    // module (S15): it is reached only through the test-only entry, so it reads a harness member
    // straight from its file (through TEST_ONLY it would close an import loop through the gate's
    // require(), check-boundaries' import-cycle), and the store-artifact gate proves the folder is
    // absent from store bundles.
    if (isTest(rel) || TEST_ONLY_FOLDERS.some((folder) => rel.startsWith(folder))) continue;
    for (const imp of importsOf(source)) {
      if (imp.typeOnly || !/(^|\/)app\/parity\/|^\.\/parity\/|^\.\.\/parity\//.test(imp.spec)) continue;
      problem(rel, imp.line, 'harness-leak', `imports the parity harness (${imp.spec}) directly`, 'Reach it only as TEST_ONLY?.readParityRequest(); a direct import puts test-only code into store builds.');
    }
  }
  // The harness is wired in: the Shell's startup reads the request (a harness nobody calls leaves
  // every capture on the normal start screen).
  if (texts.entry !== null && callers === 0) {
    problem('packages/shell/src', 0, 'harness-not-called', 'no runtime file calls TEST_ONLY?.readParityRequest()', "Read the request in the Shell's startup before the first screen renders and apply its plan (see the skill's parity-harness reference).");
  }

  // Every startup step is applied somewhere in the Shell (the template makes them; the Shell calls them).
  if (texts.startup !== null) {
    for (const [name, where] of Object.entries(STARTUP_CALLS)) {
      if (!wired.has(name)) problem(STARTUP, 0, 'harness-not-wired', `nothing in the Shell calls ${name}()`, `Call it from ${where} (the skill's parity-harness reference, "Wiring it in").`);
    }
    for (const [name, where] of Object.entries(LAUNCH_MEMBERS)) {
      if (wired.has(`launch.${name}`)) continue;
      const skip = LAUNCH_MEMBER_SCREENS[name] ? skipFor(LAUNCH_MEMBER_SCREENS[name]) : null;
      if (skip) report.skip({ file: STARTUP, rule: 'harness-not-wired', message: `launch.${name}: ${skip}` });
      else problem(STARTUP, 0, 'harness-not-wired', `nothing in the Shell calls launch.${name}?.()`, `The composition root (game-host-integration's create-shell-parts.ts) calls it ${where}; copy that template again.`);
    }
    // Every capture starts with no saved debug flag. The debug services restore theirs (offline,
    // the ads override, a seed, a consent geography) when they are made, after prepareSave, so a
    // startup that keeps them lets a frame inherit what an earlier launch saved: the S15 frame's
    // "Always show test ads", a debug link's offline switch on the S12 cards.
    if (!/\.set\(\s*'debug\.overrides'\s*,\s*null\s*\)/.test(maskComments(texts.startup))) {
      problem(STARTUP, 0, 'harness-debug-flags', 'applyParityData does not clear the saved debug flags (debug.overrides), so a capture inherits what an earlier launch saved (the S15 frame leaves "Always show test ads" on, a debug link can leave offline on)', "Copy the template parity-startup.tsx again: applyParityData sets 'debug.overrides' to null (TEST_ONLY.createSqliteKvDebugStoreAdapter()) before the debug services read it.");
    }
  }

  // 4a. Wiring outside the harness: the frozen-motion switch and the board probe.
  for (const w of WIRING) {
    const skip = w.screens ? (w.screens.some((id) => !skipFor(id)) ? null : skipFor(w.screens[0])) : sliceSkipReason(slice);
    if (skip) {
      report.skip({ file: w.file ?? 'packages/shell/src', rule: 'harness-not-wired', message: `${w.name}: ${skip}` });
      continue;
    }
    checked += 1;
    const candidates = w.file ? [w.file] : sources.filter((rel) => !isTest(rel) && !rel.startsWith(`${PARITY_DIR}/`) && rel !== FILES.entry);
    const found = candidates.some((rel) => {
      const text = read(rel);
      return text !== null && w.pattern.test(maskComments(text));
    });
    if (!found) problem(w.file ?? 'packages/shell/src', 0, 'harness-not-wired', `${w.file ? 'does not call' : 'nothing in the Shell calls'} TEST_ONLY?.${w.name}()`, w.fix);
  }

  // 4a'. The launch nonce marker: the parity root draws it and provides its context, and every modal
  // root draws one inside itself (a modal layer hides the rest from the hierarchy), so capture-app
  // can prove each dump came from its own launch. The held S1 splash is registered by start-shell
  // outside the Shell root, so start-shell wraps it in the parity root too (withParityRoot).
  if (texts.startup !== null && !wired.has('withParityRoot')) {
    const skip = skipFor('S1');
    if (skip) report.skip({ file: HELD_SPLASH_FILE, rule: 'harness-launch-marker', message: skip });
    else {
      checked += 1;
      problem(HELD_SPLASH_FILE, 0, 'harness-launch-marker', 'registers the held S1 splash (frame s1-splash) outside the Shell root, and nothing outside parity-startup.tsx calls withParityRoot(), so the S1 capture has no launch marker ("hierarchy from another simulator")', 'Register it wrapped: registerRootComponent(withParityRoot(parity.request, createStartupSplash({ game, language, restart: holdSplash }))), importing withParityRoot from parity-startup.tsx.');
    }
  }
  if (texts.root !== null) {
    checked += 1;
    const clean = maskComments(texts.root);
    if (!/<ParityLaunchContext\b/.test(clean) || !/<ParityLaunchMarker\b/.test(clean)) {
      problem(FILES.root, 0, 'harness-launch-marker', 'does not provide ParityLaunchContext with the request\'s nonce and draw <ParityLaunchMarker />', "Copy the template parity-root.tsx again: capture-app refuses a hierarchy without the launch's marker (\"hierarchy from another simulator\").");
    }
  }
  for (const m of MODAL_ROOTS) {
    const text = read(m.file);
    const skip = skipFor(m.screen);
    if (text === null || skip) {
      if (skip) report.skip({ file: m.file, rule: 'harness-launch-marker', message: skip });
      continue;
    }
    checked += 1;
    if (!/<ParityLaunchMarker\b/.test(maskComments(text))) {
      problem(m.file, 0, 'harness-launch-marker', `${m.what} is a modal root (accessibilityViewIsModal) but draws no <ParityLaunchMarker />, so a capture behind it has no nonce in its hierarchy`, 'Render <ParityLaunchMarker /> (packages/shell/src/app/parity-launch-marker.tsx) as the first child of the modal View: it draws nothing outside a parity capture.');
    }
  }

  // 4b. Frame-state openers: every state a plan names is opened by the hook that owns it.
  if (texts.plans !== null) {
    const states = [...new Set([...maskComments(texts.plans).matchAll(/\bstate:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))];
    for (const state of states) {
      if (PORT_STATES.includes(state)) continue;
      const opener = OPENERS[state];
      if (!opener) {
        problem(FILES.plans, 0, 'harness-opener', `the plans name the state "${state}", which no known hook opens`, 'Use the states of the template parity-plans.ts (parity-harness.md, "Frame states and who opens them").');
        continue;
      }
      const skip = skipFor(opener.screen);
      if (skip) {
        report.skip({ file: opener.file, rule: 'harness-opener', message: `${state}: ${skip}` });
        continue;
      }
      checked += 1;
      const dir = opener.file.slice(0, opener.file.lastIndexOf('/'));
      const helpers = existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => /^use-.*\.tsx?$/.test(f) && !isTest(f)).map((f) => `${dir}/${f}`) : [];
      // The opener reads the frame state (parityFrameState(), or the Shell's useParityOpener helper)
      // and names the state's literal: parityFrameState() === 'pause-open', a local compared with it,
      // a set of states, or useParityOpener('save-restored-dialog', open).
      const opens = [opener.file, ...helpers].some((rel) => {
        const text = read(rel);
        if (text === null) return false;
        const clean = maskComments(text);
        return /\b(parityFrameState|useParityOpener)\s*\(/.test(clean) && clean.includes(`'${state}'`);
      });
      if (!opens) {
        problem(opener.file, 0, 'harness-opener', `${read(opener.file) === null ? 'does not exist, so nothing opens' : 'does not open'} the frame state "${state}" (nothing in it or a use-*.ts helper next to it reads parityFrameState() or useParityOpener() and names '${state}'), so ${opener.fails ?? 'its frame fails screen-not-reached'}`,
          `Apply it once on mount in the model hook that owns the state: ${opener.how}, through the handler a player's tap would use (parity-harness.md, "Frame states and who opens them").`);
      }
    }
  }

  // 4c. Game facts: the reference variants of S6, S7 and S11 are chosen from parity/game-facts.json.
  checkGameFacts({ root, slice, frames, report, problem, read });
  checked += 1;

  // 4d. Edge widths: the component specs hold what the references draw (a CSS border of 1 px or
  // more renders floored), so no tab, segment or tile can fail [border] by design.
  checked += 1;
  const specsText = read(SPECS);
  if (specsText === null) {
    problem(SPECS, 0, 'component-border', 'does not exist, so the edge widths cannot be compared with the references', 'Write it with the toybox-components skill (write-component-specs.mjs) before any parity run.');
  } else {
    const specs = readJson(join(root, SPECS), 'component specs');
    const layouts = referenceLayouts(resolve(options.reference));
    if (layouts.length === 0) problem(SPECS, 0, 'component-border', `no reference layouts under ${options.reference}`, 'Pass --reference <root> holding <game>/<theme>-<lang>/*.layout.json (the committed set by default).');
    for (const p of compareComponentBorders(specs, layouts).problems) problem(SPECS, 0, 'component-border', `${p.path}: ${p.message}`, p.fix);
  }

  // 5. Capture output never enters git; the waiver and sign-off files are well formed.
  checked += 1;
  const gitignore = read('.gitignore');
  if (gitignore === null || !gitignore.split('\n').some((line) => /^\/?\.parity\/?\s*$/.test(line.trim()))) {
    problem('.gitignore', 0, 'harness-gitignore', gitignore === null ? 'does not exist' : 'does not ignore .parity/', 'Add the line ".parity/" (captures, reports and sheets are rebuilt on demand; about 3 MB per run).');
  }
  const waivers = readWaivers(join(root, 'parity', 'waivers.json'));
  for (const p of waivers.problems) problem('parity/waivers.json', 0, p.rule, p.message, p.fix);
  const ledger = read('parity/signoff.json');
  if (ledger !== null) {
    let json = null;
    try {
      json = JSON.parse(ledger);
    } catch (error) {
      problem('parity/signoff.json', 0, 'ledger-invalid', `not valid JSON: ${error.message}`, 'Fix the JSON syntax.');
    }
    if (json && (json.version !== 1 || !Array.isArray(json.entries))) problem('parity/signoff.json', 0, 'ledger-invalid', 'expected { "version": 1, "entries": [...] }', "Start from the skill's templates/parity/signoff.json.");
  }
  return report.finish({ checked, unit: 'harness files' });
});
