// host-checks.mjs: the checks behind check-game-host.mjs. Not an entry point.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { readShellSlice, readText, sliceSkipReason, walk } from '../check-lib.mjs';
import { errorText } from './app-modules.mjs';
import { code, exportNames, importsOf } from './ts-scan.mjs';

const HOST = 'packages/shell/src/game-host';

/** This skill's Shell files and the exports other code relies on. */
export const HOST_FILES = {
  'shell-game-module.ts': ['ShellGameTypes', 'GamePresentation', 'ShellGameModule'],
  'game-host.ts': ['createGameHost', 'GameHost', 'GameHostDeps', 'BoardHostFactory', 'BoardHostInput', 'BoardHostProps', 'OpenedSession', 'ExamplePictureFactory', 'ExamplePictureProps'],
  'host-counter.ts': ['HostCounter'],
  'game-facts.ts': ['hasMusicOf', 'isScoreRatedOf', 'hasHintsOf', 'isScoreRule'],
  'example-picture-aspect.ts': ['EXAMPLE_PICTURE_ASPECT', 'examplePictureAspectOf', 'ExampleAspectSource'],
  'game-debug-controls.ts': ['createGameDebugControls', 'GameDebugControls', 'EXAMPLE_RUN', 'endStateOf', 'StagedExample', 'DebugRuns'],
  'game-fixture.ts': ['GameFixture', 'FixtureResult', 'fixtureHudOf', 'fixtureSummaryOf', 'fixtureHudViewOf', 'fixtureResultViewOf'],
  'run-tracker.ts': ['createRunTracker', 'RunTracker'],
  'session-view-of.ts': ['sessionViewOf', 'ViewFixture', 'ViewExtras', 'ViewDeps'],
  'game-host-context.tsx': ['GameHostProvider', 'useGameHost'],
  'open-session.ts': ['sessionRulesFor', 'entryFor', 'startFor', 'newSession', 'resumeSession', 'SessionOpen'],
  'session-controller.ts': ['createSessionController', 'SessionController', 'ControllerDeps'],
  'session-view.ts': ['SessionView', 'SessionCommand', 'SessionHandle', 'ContinueState', 'continueStateOf'],
  'play-clock.ts': ['createPlayClock', 'PlayClock', 'MAX_PLAY_DELTA_MS'],
  'run-summary.ts': ['summarizeRun', 'runEndOf', 'RunSummary', 'RunEndContext'],
  'measure-counters.ts': ['measureCounters'],
  'hud-model.ts': ['hudView', 'HudView', 'GoalLine', 'MODE_LABEL_KEYS'],
  'top-bar-model.ts': ['topBarPropsOf', 'modeTextOf', 'progressTextOf', 'RunText', 'TopBarInput'],
  'result-model-of.ts': ['resultModelOf', 'ResultInput', 'ResultExtras', 'ResultGame'],
  'board-host-model.ts': ['createMoveResultSelector', 'motionOf', 'boardHandlersFor', 'BoardMoveResult', 'BoardSelection', 'selectedAt', 'routeIntent', 'hintedTargetsOf', 'highlightOf'],
  'use-board-selection.ts': ['useBoardSelection', 'BoardSelectionControls'],
  'tutorial-script.ts': ['coachStepsOf', 'isTutorialMoveAccepted', 'isSameMove', 'TutorialCoachStep', 'HowToPlayPage', 'howToPlayPagesOf', 'pointerTargets', 'exampleHighlightOf'],
  'create-example-picture.tsx': ['createExamplePicture'],
  'create-game-board-host.tsx': ['createGameBoardHost', 'BoardPorts'],
  'fullscreen-gate.ts': ['createFullscreenGate', 'FullscreenGate'],
  'use-is-fullscreen-ad-showing.ts': ['useIsFullscreenAdShowing'],
  'use-game-session-controls.ts': ['useGameSessionControls', 'GameSessionControls'],
  'use-pause-on-background.ts': ['usePauseOnBackground', 'shouldPauseRun'],
};

export const HOST_TESTS = [
  'game-host.test.ts',
  'game-facts.test.ts',
  'example-picture-aspect.test.ts',
  'game-debug-controls.test.ts',
  'game-fixture.test.ts',
  'run-tracker.test.ts',
  'session-view-of.test.ts',
  'session-controller.test.ts',
  'board-host-model.test.ts',
  'open-session.test.ts',
  'play-clock.test.ts',
  'run-summary.test.ts',
  'measure-counters.test.ts',
  'hud-model.test.ts',
  'top-bar-model.test.ts',
  'result-model-of.test.ts',
  'fullscreen-gate.test.ts',
  'use-game-session-controls.test.tsx',
  'use-pause-on-background.test.tsx',
  'use-is-fullscreen-ad-showing.test.ts',
  'use-board-selection.test.tsx',
  'tutorial-script.test.ts',
];

/**
 * Host files, tests and prerequisites that only one screen needs: while shell-slice.json leaves
 * that screen out, a missing one is a SKIP line (D10), never a problem. None today: the S5 top bar
 * and the S7 result model are part of the Shell core every slice keeps (D36), because the host and
 * the composition root import them.
 */
const SCREEN_OF = {};

/** The composition root (templates/packages/shell/src/app/), each with its test unless device-only. */
export const ROOT_FILES = [
  'create-shell-app.tsx',
  'create-shell-parts.ts',
  'debug-switches.ts',
  'create-premium-deps.ts',
  'connect-premium-reloads.ts',
  'shell-app.tsx',
  'shell-features.tsx',
  'shell-navigator.tsx',
];
const ROOT_DEVICE_ONLY = ['device-adapters.ts'];
const TEST_ADAPTERS = 'packages/shell/src/testing/create-test-adapters.ts';

/** The Tutorial route (S13, FirstRun group): the game's scripted tutorial level. */
const TUTORIAL_DIR = 'packages/shell/src/screens/first-run';
export const TUTORIAL_FILES = ['tutorial-screen.tsx', 'tutorial-view.tsx', 'use-tutorial-model.ts', 'tutorial-coach.ts'];
const TUTORIAL_TESTS = ['tutorial-view.test.tsx', 'use-tutorial-model.test.tsx', 'tutorial-coach.test.ts'];

/** Files other skills build that the host wires together (the host only wires existing parts). */
export const PREREQUISITES = [
  { file: 'packages/game-kit/src/contract/game-module.ts', skill: 'game-rules-engine' },
  { file: 'packages/game-kit/src/levels/star-rating.ts', skill: 'level-generation-and-solvers' },
  { file: 'packages/game-kit/src/levels/pack-progress.ts', skill: 'level-generation-and-solvers' },
  { file: 'packages/game-kit/src/levels/daily-start.ts', skill: 'level-generation-and-solvers' },
  { file: `${HOST}/game-session-types.ts`, skill: 'state-stores' },
  { file: `${HOST}/game-session-reducer.ts`, skill: 'state-stores' },
  { file: `${HOST}/game-session-store.ts`, skill: 'state-stores' },
  { file: `${HOST}/run-writer.ts`, skill: 'state-stores' },
  { file: `${HOST}/saved-run.ts`, skill: 'state-stores' },
  { file: 'packages/shell/src/testing/create-test-save.ts', skill: 'state-stores' },
  { file: 'packages/shell/src/stores/run-end.ts', skill: 'daily-and-statistics' },
  { file: 'packages/shell/src/stores/update-and-publish.ts', skill: 'state-stores' },
  { file: 'packages/shell/src/services/save/save-service.ts', skill: 'save-persistence-and-migrations' },
  { file: `${HOST}/board-types.ts`, skill: 'board-rendering-skia' },
  { file: `${HOST}/board-kit.ts`, skill: 'board-rendering-skia' },
  { file: `${HOST}/game-board-host.tsx`, skill: 'board-rendering-skia' },
  { file: 'packages/shell/src/app/use-is-app-active.ts', skill: 'board-rendering-skia' },
  { file: `${HOST}/pan-intent.ts`, skill: 'board-gestures-and-input' },
  { file: `${HOST}/board-direction-view.tsx`, skill: 'rtl-and-direction' },
  { file: 'packages/shell/src/i18n/direction-context.tsx', skill: 'rtl-and-direction' },
  { file: 'packages/shell/src/i18n/digits.ts', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/i18n/t-context.ts', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/i18n/language-context.tsx', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/theme/use-theme.ts', skill: 'toybox-design-system' },
  { file: 'packages/shell/src/stores/settings-store.ts', skill: 'state-stores' },
  { file: 'packages/shell/src/stores/settings-selectors.ts', skill: 'state-stores' },
  { file: 'packages/shell/src/app/use-reduce-motion.ts', skill: 'settings-and-preferences' },
  { file: 'packages/shell/src/art/game-art.ts', skill: 'code-drawn-art-and-icons' },
  { file: 'packages/shell/src/art/credit-entry.ts', skill: 'code-drawn-art-and-icons' },
  { file: 'packages/shell/src/art/logo-art.ts', skill: 'code-drawn-art-and-icons' },
  { file: 'packages/shell/src/navigation/route-params.ts', skill: 'navigation-and-routing' },
  { file: `${HOST}/game-top-bar.tsx`, skill: 'toybox-screens' },
  { file: 'packages/shell/src/screens/result/result-model.ts', skill: 'toybox-screens' },
  { file: 'packages/shell/src/services/ads/perk-offer.ts', skill: 'admob-ads' },
  { file: 'packages/shell/src/services/ads/fullscreen-ad.ts', skill: 'admob-ads' },
  { file: 'packages/shell/src/i18n/format-date.ts', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/i18n/create-t.ts', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/i18n/game-message-text.ts', skill: 'i18n-strings-and-catalogs' },
  { file: 'packages/shell/src/i18n/create-number-formatter.ts', skill: 'rtl-and-direction' },
  { file: 'packages/shell/src/app/start-shell.ts', skill: 'rtl-and-direction' },
  { file: 'packages/shell/src/services/audio/audio-port.ts', skill: 'game-audio-and-haptics' },
  { file: 'packages/shell/src/services/audio/ui-feedback.ts', skill: 'game-audio-and-haptics' },
  { file: 'packages/shell/src/services/audio/fake-audio.ts', skill: 'game-audio-and-haptics' },
  { file: 'packages/shell/src/services/haptics/haptics-port.ts', skill: 'game-audio-and-haptics' },
  { file: 'packages/shell/src/services/haptics/fake-haptics.ts', skill: 'game-audio-and-haptics' },
  { file: 'packages/shell/src/theme/theme-types.ts', skill: 'toybox-design-system' },
  { file: 'packages/shell/src/testing/test-palette.ts', skill: 'toybox-design-system' },
  { file: 'packages/shell/src/services/clock/clock-port.ts', skill: 'architecture-and-boundaries' },
  { file: 'packages/shell/src/services/error-log/error-log-port.ts', skill: 'architecture-and-boundaries' },
  { file: 'packages/shell/src/testing/counter-game.ts', skill: 'state-stores' },
  { file: 'packages/shell/src/services/save/schema/save-doc.ts', skill: 'save-persistence-and-migrations' },
  { file: 'packages/game-kit/src/testing/engine-contract.ts', skill: 'game-rules-engine' },
  { file: 'packages/game-kit/src/levels/levels-contract.ts', skill: 'level-generation-and-solvers' },
];

function text(repo, rel) {
  return repo.exists(rel) ? (readText(join(repo.root, rel)) ?? '') : '';
}

/** The SKIP reason for a missing file that only a screen outside the Shell slice needs, else null. */
function sliceSkipFor(repo, key) {
  const screen = SCREEN_OF[key];
  return screen === undefined ? null : sliceSkipReason(repo.slice, screen);
}

/** A missing file: a SKIP line when only a screen outside the slice needs it, else a problem. */
function missing(repo, report, key, problem) {
  const reason = sliceSkipFor(repo, key);
  if (reason === null) report.problem(problem);
  else report.skip({ file: problem.file, rule: problem.rule, message: reason });
}

export function checkHostFiles(repo, report) {
  let checked = 0;
  for (const [file, names] of Object.entries(HOST_FILES)) {
    const rel = `${HOST}/${file}`;
    checked += 1;
    if (!repo.exists(rel)) {
      missing(repo, report, file, { file: rel, rule: 'host-file-missing', message: 'game host file is missing', fix: `Copy templates/${rel} (with its test) from this skill.` });
      continue;
    }
    const exported = exportNames(text(repo, rel));
    for (const name of names.filter((item) => !exported.has(item))) report.problem({ file: rel, line: 1, rule: 'host-export-missing', message: `does not export ${name}`, fix: `Restore the file from templates/${rel}; screens and the composition root import ${name}.` });
  }
  for (const test of HOST_TESTS) {
    if (!repo.exists(`${HOST}/${test}`)) missing(repo, report, test, { file: `${HOST}/${test}`, rule: 'host-test-missing', message: 'the host behaviour has no test', fix: `Copy templates/${HOST}/${test}; the tests are the evidence that runs are saved before they show.` });
  }
  for (const { file, skill } of PREREQUISITES) {
    if (!repo.exists(file)) missing(repo, report, file, { file, rule: 'prerequisite-missing', message: `the host needs this file (built by the ${skill} skill)`, fix: `Build it with the ${skill} skill first; the host only wires existing parts.` });
  }
  return checked;
}

/** The composition root templates and the Tutorial route, each with its test (D14, S13). */
export function checkRootFiles(repo, report) {
  const noApp = sliceSkipReason(repo.slice);
  const app = 'packages/shell/src/app';
  const wanted = [
    ...ROOT_FILES.flatMap((file) => [`${app}/${file}`, `${app}/${file.replace(/\.(tsx?)$/, '.test.$1')}`]),
    ...ROOT_DEVICE_ONLY.map((file) => `${app}/${file}`),
    TEST_ADAPTERS,
  ];
  for (const rel of wanted.filter((file) => !repo.exists(file))) {
    if (noApp !== null) report.skip({ file: rel, rule: 'root-file-missing', message: noApp });
    else report.problem({ file: rel, rule: 'root-file-missing', message: 'composition root file is missing', fix: `Copy templates/${rel} from this skill (the composition root is a template: every part is wired and tested).` });
  }
  // The Tutorial route is part of the Shell core (D36): routed to TutorialScreen in every slice.
  for (const file of [...TUTORIAL_FILES, ...TUTORIAL_TESTS].filter((name) => !repo.exists(`${TUTORIAL_DIR}/${name}`))) {
    const rel = `${TUTORIAL_DIR}/${file}`;
    if (noApp !== null) report.skip({ file: rel, rule: 'tutorial-screen', message: noApp });
    else report.problem({ file: rel, rule: 'tutorial-screen', message: 'the Tutorial route file is missing', fix: `Copy templates/${rel}: the Tutorial route is Shell core in every slice (the FirstRun group opens the game's scripted tutorial level there, and shell-app.test waits for it).` });
  }
  const model = code(text(repo, `${TUTORIAL_DIR}/use-tutorial-model.ts`));
  if (model !== '' && !(/kind:\s*'tutorial'/.test(model) && /useGameSessionControls\s*\(/.test(model) && /'finish-tutorial'/.test(model))) {
    report.problem({ file: `${TUTORIAL_DIR}/use-tutorial-model.ts`, line: 1, rule: 'tutorial-screen', message: "the Tutorial model does not open the { kind: 'tutorial' } run with useGameSessionControls and end it with finish-tutorial", fix: 'Restore templates/packages/shell/src/screens/first-run/use-tutorial-model.ts: the tutorial is the game host\'s scripted run, and finish-tutorial is what moves the FirstRun group on to Home.' });
  }
  return wanted.length;
}

/** The body of a top-level function (from its declaration to the closing brace at column 0). */
function functionBody(source, name) {
  const start = source.search(new RegExp(`\\bfunction\\s+${name}\\b`));
  if (start < 0) return '';
  const end = source.indexOf('\n}', start);
  return source.slice(start, end < 0 ? undefined : end);
}

const WIRING = [
  {
    fn: 'makePersist',
    pattern: /isOver\s*\(\s*session\s*\)[\s\S]*writeTurn\s*\([\s\S]*recordEnd\s*\(/,
    rule: 'save-before-publish',
    message: 'makePersist does not write the run (writeTurn) or record the end (recordEnd) for every change',
    fix: 'The session store calls persist before it publishes: live runs are written, finished runs recorded, so a kill during an animation loses nothing.',
  },
  {
    fn: 'createSessionController',
    pattern: /const\s+persist\s*=\s*makePersist\s*\([\s\S]*createGameSessionStore\s*<[^>]*>\s*\(\s*\{[\s\S]*\bpersist\b/,
    rule: 'save-before-publish',
    message: 'the session store is not created with the persist step from makePersist',
    fix: 'createGameSessionStore({ rules, initial, persist: makePersist(deps, extras) }): reduce, save, then publish.',
  },
  {
    fn: 'makePersist',
    pattern: /apply-move[\s\S]*playUiFeedback\s*\(\s*deps\.feedback\s*,[\s\S]*'win'[\s\S]*'lose'/,
    rule: 'result-feedback',
    message: 'the move that decides a run does not play the win or lose feedback (playUiFeedback)',
    fix: "In makePersist, after the run is saved or recorded: if (action.type === 'apply-move') playUiFeedback(deps.feedback, session.status === 'won' ? 'win' : 'lose').",
  },
  {
    fn: 'recordEnd',
    pattern: /applyRunEnd\s*\([\s\S]*refreshBackup:\s*true/,
    rule: 'run-end-once',
    message: 'the run end is not ONE applyRunEnd update with refreshBackup: true',
    fix: 'Record progress, daily, statistics and the cleared run in one save.update(..., { refreshBackup: true }) before S7 shows.',
  },
  {
    fn: 'run',
    pattern: /intentToMove\s*\([\s\S]*?if\s*\(\s*move\s*!==\s*null\b[\s\S]*?\)\s*\{?\s*dispatch\(\s*\{\s*type:\s*'apply-move',\s*move\s*\}/,
    rule: 'intent-legality',
    message: 'intents do not go through intentToMove (null = no move) before apply-move',
    fix: 'Only moves the engine produced from an intent reach the reducer; a null move is ignored.',
  },
  {
    fn: 'isContinueOffered',
    pattern: /continueStateOf\s*\([\s\S]*===\s*'offered'/,
    rule: 'continue-once',
    message: 'the pending-loss decision does not use continueStateOf',
    fix: 'Spec 8.10: one continue per run, only after a loss, only when the game and the app allow it.',
  },
  {
    fn: 'endWithState',
    pattern: /persist\s*\(\s*ended\b[\s\S]*store\.setState\s*\(/,
    rule: 'debug-run-end',
    message: 'the debug controls end a run without the persist step (endWithState must persist, then publish)',
    fix: 'endWithState: persist(ended, null) records the run end (stars, statistics, extendRunEnd) before parts.store.setState publishes it, exactly like a deciding move.',
  },
  {
    fn: 'createSessionController',
    pattern: /createPlayClock\s*\(\s*deps\.nowMs\s*\)/,
    rule: 'play-time',
    message: 'play time is not measured with createPlayClock(deps.nowMs)',
    fix: 'Count only time spent playing, clamped per step, from the injected clock (never Date.now).',
  },
];

/** Spec 8.6 and S14: a saved run is read through the game's own parsers at boot and on resume. */
const HOST_WIRING = [
  {
    fn: 'createGameHost',
    pattern: /resumeSession\s*\([\s\S]*?\)\s*===\s*null[\s\S]*?run:\s*null/,
    rule: 'saved-run-validated',
    message: 'createGameHost does not validate the saved run at boot (resumeSession, then drop only an unreadable run)',
    fix: 'At boot: if resumeSession(game, saved, errorLog) === null, save.update((doc) => ({ ...doc, run: null })); the stores and the resume state then start from that document.',
  },
  {
    fn: 'createGameHost',
    pattern: /debugControls\s*:/,
    rule: 'debug-controls',
    message: 'the game host has no debugControls() (action=win-level|lose-level and the example screens are refused)',
    fix: 'Return debugControls: () => controls with createGameDebugControls({ game, runs, openGame }) (game-debug-controls.ts): playTo, openExample, applyFixtureHud, showFixtureResult.',
  },
  {
    fn: 'factsOf',
    pattern: /hasMusic\s*:\s*hasMusicOf\s*\(\s*game\s*\)[\s\S]*isScoreRated\s*:\s*isScoreRatedOf\s*\(\s*game\s*\)/,
    rule: 'game-facts',
    message: 'GameHost.hasMusic and isScoreRated do not come from game-facts.ts (hasMusicOf, isScoreRatedOf)',
    fix: 'hasMusic: hasMusicOf(game), isScoreRated: isScoreRatedOf(game): the parity pin test checks parity/game-facts.json against the same two functions.',
  },
  {
    fn: 'factsOf',
    pattern: /hasHints\s*:\s*hasHintsOf\s*\(\s*game\s*\)/,
    rule: 'game-facts',
    message: 'GameHost.hasHints does not come from the module through game-facts.ts (hasHintsOf)',
    fix: 'hasHints: hasHintsOf(game) (the rules\' hint policy is a solver, the rule behind isHintSupported): the S5 hint key and the parity --no-hints variants follow it.',
  },
  {
    fn: 'factsOf',
    pattern: /\baggregate\b/,
    rule: 'game-facts',
    message: 'GameHost.counters drops each counter\'s aggregate, so S10 cannot show a max counter as ×N',
    fix: 'Map every counter to { id, labelId, aggregate } (HostCounter in host-counter.ts).',
  },
  {
    fn: 'factsOf',
    pattern: /howToPlayPictureAspect\s*:\s*examplePictureAspectOf\s*\(/,
    rule: 'game-facts',
    message: 'GameHost.howToPlayPictureAspect does not come from examplePictureAspectOf (the S13 picture size contract)',
    fix: 'howToPlayPictureAspect: examplePictureAspectOf(game.presentation.board): 320 / 206 unless the board gives exampleAspect.',
  },
  {
    fn: 'firstSession',
    pattern: /resumeSession\s*\(/,
    rule: 'saved-run-validated',
    message: 'a resumed run is not rebuilt with resumeSession (the game\'s parsers and the replay check)',
    fix: 'Open { start: \'resume\' } with resumeSession(game, saved, deps.errorLog); drop the run when it returns null.',
  },
];

/** The invariants of the seam, read from the host's own source. */
export function checkHostWiring(repo, report) {
  const controllerRel = `${HOST}/session-controller.ts`;
  const controller = code(text(repo, controllerRel));
  if (controller !== '') {
    for (const item of WIRING.filter((entry) => !entry.pattern.test(functionBody(controller, entry.fn)))) {
      report.problem({ file: controllerRel, line: 1, rule: item.rule, message: item.message, fix: item.fix });
    }
  }
  const hostRel = `${HOST}/game-host.ts`;
  const host = code(text(repo, hostRel));
  if (host !== '') {
    for (const item of HOST_WIRING.filter((entry) => !entry.pattern.test(functionBody(host, entry.fn)))) {
      report.problem({ file: hostRel, line: 1, rule: item.rule, message: item.message, fix: item.fix });
    }
  }
  const summaryRel = `${HOST}/run-summary.ts`;
  const summary = code(text(repo, summaryRel));
  if (summary !== '' && !/starsFor\s*\(\s*rule\s*,/.test(functionBody(summary, 'starsOf'))) {
    report.problem({ file: summaryRel, line: 1, rule: 'stars-from-table', message: 'stars are not rated with starsFor on the level\'s table rule', fix: 'Spec 8.1: stars come from the level entry\'s StarRule through starsFor (par or score thresholds).' });
  }
  checkScoreLine(repo, summary, report);
  const factsRel = `${HOST}/game-facts.ts`;
  const facts = code(text(repo, factsRel));
  if (facts !== '' && !/rules\.hints\.kind\s*===\s*'solver'/.test(functionBody(facts, 'hasHintsOf'))) {
    report.problem({ file: factsRel, line: 1, rule: 'game-facts', message: 'hasHintsOf does not read the module\'s rules.hints.kind === \'solver\' (the rule behind isHintSupported)', fix: 'return game.rules.hints.kind === \'solver\'; the S5 hint key, GameHost.hasHints and parity/game-facts.json hasHints must agree.' });
  }
  checkFrameOpeners(repo, report);
  for (const rel of walk(join(repo.root, HOST), { include: ['*.ts', '*.tsx'] }).filter((file) => !/\.test\.tsx?$/.test(file))) {
    const source = code(text(repo, `${HOST}/${rel}`));
    const cast = /\bas\s+unknown\s+as\b|\bas\s+any\b|\bas\s+ShellGameModule\b|\bas\s+GameModule\b/.exec(source);
    if (cast) report.problem({ file: `${HOST}/${rel}`, line: source.slice(0, cast.index).split('\n').length, rule: 'unsafe-cast', message: `casts (${cast[0]}) inside the game host`, fix: 'createGameHost<T> is the one generic seam; close over the typed module instead of casting.' });
  }
}

/**
 * L3: a score-rated win prints "Score {score} – best {bestScore}": par null from the one score
 * rule (game-facts.ts isScoreRule) and the level's best after this run's save in the win model.
 */
function checkScoreLine(repo, summary, report) {
  const summaryRel = `${HOST}/run-summary.ts`;
  if (summary !== '' && !(/\bisScoreRule\s*\(\s*rule\s*\)/.test(summary) && /levelBestScore\s*:/.test(summary))) {
    report.problem({ file: summaryRel, line: 1, rule: 'score-line', message: 'the run summary has no par null from isScoreRule(rule) or no levelBestScore (the level best after this run)', fix: 'In summarizeRun: par: rule === null || isScoreRule(rule) ? null : rule.par, and levelBestScore: the progress.levels[n].bestScore this run leaves in the save.' });
  }
  const resultRel = `${HOST}/result-model-of.ts`;
  const result = code(text(repo, resultRel));
  if (result !== '' && !/bestScore\s*:\s*summary\.levelBestScore\b/.test(functionBody(result, 'recordedResult'))) {
    report.problem({ file: resultRel, line: 1, rule: 'score-line', message: 'the S7 win model has no bestScore from summary.levelBestScore', fix: 'Add bestScore: summary.levelBestScore ?? summary.score to the win model: a score-rated win prints result.win.score-line with score and best.' });
  }
}

const OPENERS = [
  { pattern: /parityGameFixture\s*\(/, what: 'reads no TEST_ONLY.parityGameFixture()' },
  { pattern: /applyFixtureHud\s*\(/, what: 'shows no fixture numbers in the top bar (applyFixtureHud)' },
  { pattern: /'pause-open'[\s\S]{0,120}type:\s*'pause'/, what: "does not open 'pause-open' through pause" },
  { pattern: /'result-win'[\s\S]{0,120}showFixtureResult\s*\(/, what: "does not open 'result-win' through showFixtureResult" },
  { pattern: /'result-lose'[\s\S]{0,120}showFixtureResult\s*\(/, what: "does not open 'result-lose' through showFixtureResult" },
  { pattern: /isParityBoardProbeOn\s*\(/, what: 'opens a frame state in the board-layout probe launch too' },
];

/** OPEN-5 (D31): the game frames open their state once, through the session-controls hook. */
function checkFrameOpeners(repo, report) {
  const rel = `${HOST}/use-game-session-controls.ts`;
  const source = code(text(repo, rel));
  if (source === '') return;
  for (const opener of OPENERS.filter((item) => !item.pattern.test(source))) {
    report.problem({ file: rel, line: 1, rule: 'parity-frame-openers', message: `the Game screen hook ${opener.what}`, fix: 'Restore openParityFrame from templates/packages/shell/src/game-host/use-game-session-controls.ts: applyFixtureHud(fixture) for every game frame, pause for pause-open, showFixtureResult for result-win and result-lose, nothing in a probe=board launch.' });
  }
}

/** Screens, UI, stores and navigation never name a game's types or import an app. */
export function checkTypeErasure(repo, report) {
  const shellSrc = join(repo.root, 'packages', 'shell', 'src');
  if (!existsSync(shellSrc)) return;
  for (const rel of walk(shellSrc, { include: ['*.ts', '*.tsx'] }).filter((file) => /^(screens|ui|stores|navigation)\//.test(file) && !/\.test\.tsx?$/.test(file))) {
    const file = `packages/shell/src/${rel}`;
    const source = text(repo, file);
    for (const { specifier, line } of importsOf(source)) {
      const other = /^@e07\/([a-z0-9-]+)\//.exec(specifier);
      if (other && !['shell', 'game-kit'].includes(other[1])) report.problem({ file, line, rule: 'screens-type-erased', message: `imports the game app ${specifier}`, fix: 'Screens see only the type-erased SessionHandle and GameHost; the game reaches the Shell through startShell(module).' });
    }
    const named = /\bShellGameModule\b|\bShellGameTypes\b/.exec(code(source));
    if (named) report.problem({ file, line: code(source).slice(0, named.index).split('\n').length, rule: 'screens-type-erased', message: `names ${named[0]} outside the game host`, fix: 'Only game-host/ and the composition root touch the typed module; screens use useGameSessionControls.' });
  }
}

function appFiles(repo) {
  const appDir = join(repo.root, 'packages', 'shell', 'src', 'app');
  if (!existsSync(appDir)) return [];
  return walk(appDir, { include: ['*.ts', '*.tsx'] }).filter((file) => !/\.test\.tsx?$/.test(file)).map((file) => ({ rel: `packages/shell/src/app/${file}`, source: code(text(repo, `packages/shell/src/app/${file}`)) }));
}

/** Index just past the parenthesis that closes the one opening at `open`, or -1. */
function closeParen(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Top-level functions: name -> { start, body, isExported } (body = from '{' to the brace at column 0). */
function topLevelFunctions(source) {
  const functions = new Map();
  for (const match of source.matchAll(/^(export\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^\n(]*>)?\s*\(/gm)) {
    const params = closeParen(source, match.index + match[0].length - 1);
    const open = params < 0 ? -1 : source.indexOf('{', params);
    const end = source.indexOf('\n}', open);
    if (open < 0) continue;
    functions.set(match[2], { start: match.index, body: source.slice(open, end < 0 ? undefined : end + 2), isExported: match[1] !== undefined });
  }
  return functions;
}

/**
 * The calls a function makes, in source order, with the calls of the file's own top-level helpers
 * expanded in place (a helper is followed once per path). This is how host-order sees
 * `openSave(...)` reach hydrateSave, `hostFor(...)` reach createGameHost and
 * `initialStateFor(...)` reach resumeState, in the order the composition root runs them.
 */
function callOrder(functions, name, seen = new Set()) {
  const fn = functions.get(name);
  if (fn === undefined || seen.has(name)) return [];
  const inner = new Set([...seen, name]);
  const calls = [];
  for (const match of fn.body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*(?:<[^()\n]*?>)?\s*\(/g)) {
    calls.push(match[1]);
    if (functions.has(match[1])) calls.push(...callOrder(functions, match[1], inner));
  }
  return calls;
}

/** The boot order of the composition root file, or null when no exported function reaches the host. */
function bootOrder(source) {
  const functions = topLevelFunctions(source);
  for (const [name, fn] of functions) {
    if (!fn.isExported) continue;
    const calls = callOrder(functions, name);
    if (calls.includes('createGameHost')) return calls;
  }
  return null;
}

/** Order at boot: hydrate the save, create the host (drops an unreadable run), then stores and resume state. */
function checkHostOrder(root, report) {
  const host = root.source.search(/createGameHost\s*\(/);
  const lineAt = (index) => root.source.slice(0, index).split('\n').length;
  const order = bootOrder(root.source);
  const textual = (pattern) => (root.source.search(pattern) < host ? -1 : 1);
  const indexIn = (name) => (order === null ? null : order.indexOf(name));
  const hostAt = indexIn('createGameHost');
  const isBefore = (name, pattern) => (order === null ? root.source.search(pattern) >= 0 && textual(pattern) < 0 : indexIn(name) >= 0 && indexIn(name) < hostAt);
  const isAfter = (name, pattern) => (order === null ? root.source.slice(host).search(pattern) >= 0 : order.slice(hostAt + 1).includes(name));
  const hasHydrate = order === null ? root.source.search(/hydrateSave\s*\(/) >= 0 : order.includes('hydrateSave');
  if (hasHydrate && !isBefore('hydrateSave', /hydrateSave\s*\(/)) report.problem({ file: root.rel, line: lineAt(host), rule: 'host-order', message: 'createGameHost runs before hydrateSave', fix: 'Create the host right after hydrateSave: it reads and may clear the saved run.' });
  if (isBefore('createShellStores', /createShellStores\s*\(/)) report.problem({ file: root.rel, line: lineAt(root.source.search(/createShellStores\s*\(/)), rule: 'host-order', message: 'the stores are created before the game host', fix: 'Create the host first: it may drop an unreadable run, and the stores must start from that document.' });
  if (!isAfter('resumeState', /resumeState\s*\(/)) report.problem({ file: root.rel, line: lineAt(host), rule: 'host-order', message: 'the resume state is not recomputed after createGameHost', fix: 'Compute initialState with resumeState(save.doc()) after the host (directly, or through a helper of this file such as initialStateFor), so a dropped run is never resumed.' });
  checkHostDeps(root, host, lineAt(host), report);
}

/** What createGameHost gets: the run-end write, the feedback ports, the board factory, the config. */
function checkHostDeps(root, host, line, report) {
  const deps = /createGameHost\s*\([^,]+,\s*\{([\s\S]*?)\n\s*\}\s*\)/.exec(root.source.slice(host));
  if (deps === null) return;
  if (!(/\bwriteRunEnd\b/.test(deps[1]) && /\bupdateAndPublish\s*\(/.test(root.source))) report.problem({ file: root.rel, line, rule: 'run-end-publish', message: 'createGameHost gets no writeRunEnd that calls updateAndPublish', fix: 'Pass writeRunEnd: (write) => { updateAndPublish(save, stores, write); } so the run end is one write and the progress and stats stores re-read it before S7 (state-stores).' });
  if (!/\bfeedback\s*:/.test(deps[1])) report.problem({ file: root.rel, line, rule: 'host-deps', message: 'createGameHost gets no feedback ports', fix: 'Pass feedback: debugFeedbackOf(() => debug, { audio, haptics }) (the same adapters the services use; the debug parts\' recording ports in test builds), so a decided run plays ui.win or ui.lose with its pulse.' });
  if (!/\bcreateBoardHost\s*:\s*createGameBoardHost\s*\(/.test(deps[1])) report.problem({ file: root.rel, line, rule: 'host-deps', message: 'createBoardHost is not createGameBoardHost({ audio, haptics, errorLog })', fix: 'Copy templates/packages/shell/src/game-host/create-game-board-host.tsx and pass createBoardHost: createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn }).' });
  const literal = /\bisContinueAllowed\s*:\s*(true|false)\b/.exec(deps[1]);
  if (literal !== null) report.problem({ file: root.rel, line, rule: 'continue-from-config', message: `createGameHost gets isContinueAllowed: ${literal[1]} instead of the game's config`, fix: 'Spec 8.10: pass the game config\'s isContinueAllowed (readGameExtra(), from game.config.ts), so each game decides whether continues exist.' });
}

/**
 * OPEN-1 and L6: the debug parts get the host's debug controls (action= and the example screens),
 * and the board-layout probe is also on in a parity probe=board launch (the board mask).
 */
function checkDebugWiring(repo, root, report) {
  if (/createDebugParts\s*\(/.test(root.source) && !/createDebugParts\s*\(\s*\{[\s\S]*?\bgame\s*:\s*host\.debugControls\s*\(\s*\)/.test(root.source)) {
    report.problem({ file: root.rel, line: 1, rule: 'debug-controls', message: 'createDebugParts gets no game: host.debugControls() (the debug link refuses action=win-level and the example screens)', fix: 'Pass game: host.debugControls() to adapters.createDebugParts({ ... }) in finishParts, as templates/packages/shell/src/app/create-shell-parts.ts does.' });
  }
  const switchesRel = 'packages/shell/src/app/debug-switches.ts';
  const switches = code(text(repo, switchesRel));
  checkRecordedFeedback(root, switchesRel, switches, report);
  if (switches !== '' && !/isLayoutProbeOn\s*:[\s\S]*?isParityBoardProbeOn\s*\(/.test(switches)) {
    report.problem({ file: switchesRel, line: 1, rule: 'parity-board-probe', message: 'the board-layout probe ignores a parity probe=board launch', fix: 'isLayoutProbeOn: () => parts()?.services?.isBoardLayoutOn() === true || TEST_ONLY?.isParityBoardProbeOn() === true (store builds stay false).' });
  }
}

/**
 * The E2E feedback evidence: in test builds the host plays the Shell's feedback through the debug
 * parts' recording ports (parts.feedback, which also append { kind: 'feedback' } to the perf log),
 * and createDebugParts gets the app's haptics port to wrap. Store builds keep the real ports.
 */
function checkRecordedFeedback(root, switchesRel, switches, report) {
  if (!/createDebugParts\s*\(/.test(root.source)) return;
  const fix = 'In create-shell-parts.ts: feedback: debugFeedbackOf(() => debug, { audio: adapters.audio, haptics }) for the host, and haptics in createDebugParts({ ... }); debugFeedbackOf (debug-switches.ts) plays through parts()?.feedback ?? ports.';
  if (!/\bfeedback\s*:\s*debugFeedbackOf\s*\(/.test(root.source)) {
    report.problem({ file: root.rel, line: 1, rule: 'feedback-recorded', message: 'the game host plays feedback through the real ports only, so a test build records no win sound or success pulse', fix });
  }
  const debugInput = /createDebugParts\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;/.exec(root.source);
  if (debugInput !== null && !/\bhaptics\b/.test(debugInput[1])) {
    report.problem({ file: root.rel, line: 1, rule: 'feedback-recorded', message: 'createDebugParts gets no haptics port, so the success pulse is never recorded', fix });
  }
  if (switches !== '' && !/debugFeedbackOf[\s\S]*?parts\s*\(\s*\)\s*\?\.\s*feedback\s*\?\?/.test(switches)) {
    report.problem({ file: switchesRel, line: 1, rule: 'feedback-recorded', message: 'debugFeedbackOf does not play through the debug parts\' recording ports', fix });
  }
}

/** The composition root creates the host and provides it; the Game screen uses the host's hooks. */
export function checkShellWiring(repo, report) {
  const noApp = sliceSkipReason(repo.slice);
  if (noApp !== null) {
    for (const rule of ['host-not-created', 'host-not-provided']) report.skip({ file: 'packages/shell/src/app', rule, message: noApp });
    return;
  }
  const files = appFiles(repo);
  const root = files.find((file) => /createGameHost\s*\(/.test(file.source));
  if (root === undefined) report.problem({ file: 'packages/shell/src/app', rule: 'host-not-created', message: 'no composition-root file calls createGameHost(game, deps)', fix: 'Copy templates/packages/shell/src/app/ from this skill: create-shell-parts.ts creates the host right after hydrateSave and before the stores.' });
  else {
    checkHostOrder(root, report);
    checkDebugWiring(repo, root, report);
  }
  if (!files.some((file) => /<GameHostProvider\b/.test(file.source))) report.problem({ file: 'packages/shell/src/app', rule: 'host-not-provided', message: 'no composition-root file renders <GameHostProvider host={host}>', fix: 'Wrap the navigator in <GameHostProvider host={host}> (shell-features.tsx) so useGameSessionControls finds the host.' });
  checkGameScreen(repo, report);
}

const GAME_SCREEN_NEEDS = [
  { pattern: /\buseGameSessionControls\s*\(/, message: 'does not open its run with useGameSessionControls(route.params)', fix: 'S5 gets status, the view, the board host and the commands from useGameSessionControls(route.params).' },
  { pattern: /\busePauseOnBackground\s*\(/, message: 'does not pause the run when the app goes to the background', fix: 'Call usePauseOnBackground(controls.status, controls.pause) (spec S5: coming back shows Pause).' },
  { pattern: /\bBoardHost\b/, message: 'does not render the board host', fix: 'Render controls.BoardHost inside the game.board area (GameLayout board prop).' },
];

function checkGameScreen(repo, report) {
  const dir = join(repo.root, 'packages', 'shell', 'src', 'screens', 'game');
  const skip = sliceSkipReason(repo.slice, 'S5');
  if (skip !== null) {
    report.skip({ file: 'packages/shell/src/screens/game', rule: 'game-screen-wiring', message: skip });
    return;
  }
  if (!existsSync(dir)) return;
  const source = walk(dir, { include: ['*.ts', '*.tsx'] }).filter((file) => !/\.test\.tsx?$/.test(file)).map((file) => code(text(repo, `packages/shell/src/screens/game/${file}`))).join('\n');
  for (const need of GAME_SCREEN_NEEDS.filter((item) => !item.pattern.test(source))) {
    report.problem({ file: 'packages/shell/src/screens/game', rule: 'game-screen-wiring', message: `the Game screen ${need.message}`, fix: need.fix });
  }
}

function pascal(id) {
  return id.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join('');
}

const MEMBERS = ['identity', 'engine', 'rules', 'levels', 'presentation', 'realtime', 'teaching', 'stats', 'texts', 'testing', 'persistence'];

/** One game's assembly: the module, the types bag, the entry, the contract test, the save policy. */
export function checkGameAssembly(repo, id, report) {
  const app = `apps/${id}`;
  const camel = pascal(id)[0].toLowerCase() + pascal(id).slice(1);
  const files = { module: `${app}/src/index.ts`, bag: `${app}/src/${id}-types.ts`, contract: `${app}/src/contract.test.ts`, teaching: `${app}/src/tutorial/${id}-teaching.ts`, entry: `${app}/index.ts` };
  for (const rel of Object.values(files)) {
    if (!repo.exists(rel)) report.problem({ file: rel, rule: 'assembly-file-missing', message: 'assembly file is missing', fix: `Copy templates/apps/__GAME_ID__/${rel.slice(app.length + 1)} and replace the placeholders.` });
  }
  const module = code(text(repo, files.module));
  if (module !== '') {
    if (!new RegExp(`export\\s+const\\s+${camel}Game\\s*:\\s*ShellGameModule<${pascal(id)}Types>`).test(module)) report.problem({ file: files.module, line: 1, rule: 'module-assembly', message: `does not export ${camel}Game: ShellGameModule<${pascal(id)}Types>`, fix: 'The module is one typed constant; the type check then proves every member.' });
    for (const member of MEMBERS.filter((name) => !new RegExp(`\\b${name}\\s*:`).test(module))) report.problem({ file: files.module, line: 1, rule: 'module-assembly', message: `member ${member} is not assembled`, fix: 'List all eleven GameModule members (realtime: null for a turn-based game).' });
    if (!new RegExp(`identity:\\s*\\{\\s*id:\\s*'${id}',\\s*nameId:\\s*'${id}\\.name',\\s*winTitleId:\\s*'${id}\\.win-title',\\s*taglineId:\\s*'${id}\\.tagline',?\\s*\\}`).test(module)) report.problem({ file: files.module, line: 1, rule: 'module-assembly', message: `identity is not { id: '${id}', nameId: '${id}.name', winTitleId: '${id}.win-title', taglineId: '${id}.tagline' }`, fix: 'identity.id equals the folder and the save\'s gameId; the name, the S7 win title and the tagline are <id>.name, <id>.win-title and <id>.tagline in all four catalogs.' });
    checkSavePolicy(repo, id, module, report);
  }
  const bag = code(text(repo, files.bag));
  if (bag !== '' && ['state', 'move', 'event', 'view', 'token', 'sim'].some((key) => !new RegExp(`readonly\\s+${key}\\s*:`).test(bag))) report.problem({ file: files.bag, line: 1, rule: 'types-bag', message: `${pascal(id)}Types does not name state, move, event, view, token and sim`, fix: 'Declare the bag once (sim: never for turn-based games).' });
  const entry = code(text(repo, files.entry));
  if (entry !== '' && !new RegExp(`import\\s+\\{\\s*startShell\\s*\\}\\s+from\\s+'@e07/shell/app/start-shell\\.ts';\\s+import\\s+\\{\\s*${camel}Game\\s*\\}\\s+from\\s+'\\./src/index\\.ts';\\s+startShell\\(${camel}Game\\);\\s*$`).test(entry)) report.problem({ file: files.entry, line: 1, rule: 'entry', message: `is not the 3-line entry startShell(${camel}Game)`, fix: 'Three statements and nothing else: import startShell, import the module, call startShell(module).' });
  const contract = code(text(repo, files.contract));
  if (contract !== '' && !(/engineContractProblems\s*\(/.test(contract) && /levelsContractProblems\s*\(/.test(contract))) report.problem({ file: files.contract, line: 1, rule: 'contract-test', message: 'the contract test does not run engineContractProblems and levelsContractProblems on the module', fix: 'Copy templates/apps/__GAME_ID__/src/contract.test.ts: identity, catalogs, engine, levels, teaching, counters, examples.' });
}

/** The rules' kind of a policy member (continueRun, hints) when it is written as a literal, else null. */
function policyKind(source, member) {
  return new RegExp(`\\b${member}\\s*:\\s*\\{\\s*kind\\s*:\\s*'([a-z-]+)'`).exec(source)?.[1] ?? null;
}

/**
 * game.config.ts must say what the rules do (G-G31): isContinueAllowed is true exactly when
 * rules.continueRun is { kind: 'once' }, and hints.freePerDay is 0 when rules.hints is
 * { kind: 'none' } (no solver can suggest a move, so a free hint would be a button that does nothing).
 */
export function checkConfigRules(repo, id, report) {
  const configRel = `apps/${id}/game.config.ts`;
  const config = code(text(repo, configRel));
  const rulesDir = join(repo.root, 'apps', id, 'src', 'rules');
  if (config === '' || !existsSync(rulesDir)) return;
  const rules = walk(rulesDir, { include: ['*.ts'] }).filter((file) => !/\.test\.ts$/.test(file)).map((file) => code(text(repo, `apps/${id}/src/rules/${file}`))).find((source) => /\bcontinueRun\s*:/.test(source) && /\bhints\s*:/.test(source));
  if (rules === undefined) return;
  const lineOfText = (pattern) => config.slice(0, Math.max(0, config.search(pattern))).split('\n').length;
  const allowed = /\bisContinueAllowed\s*:\s*(true|false)\b/.exec(config)?.[1];
  const continueKind = policyKind(rules, 'continueRun');
  if (allowed !== undefined && continueKind !== null && (allowed === 'true') !== (continueKind === 'once')) {
    report.problem({ file: configRel, line: lineOfText(/\bisContinueAllowed\s*:/), rule: 'config-rules', message: `isContinueAllowed: ${allowed}, but the rules' continueRun is { kind: '${continueKind}' }`, fix: continueKind === 'once' ? "Set isContinueAllowed: true (the game has a continue rule; spec 8.10 offers it once per run), or give the rules continueRun: { kind: 'none' }." : 'Set isContinueAllowed: false: the rules have no continue to offer, so the lose screen would show a Continue that does nothing.' });
  }
  const freePerDay = Number(/\bfreePerDay\s*:\s*(\d+)/.exec(config)?.[1] ?? '0');
  if (policyKind(rules, 'hints') === 'none' && freePerDay > 0) {
    report.problem({ file: configRel, line: lineOfText(/\bfreePerDay\s*:/), rule: 'config-rules', message: `hints.freePerDay is ${freePerDay}, but the rules have no hints ({ kind: 'none' })`, fix: "Set hints: { freePerDay: 0 }; free hints need rules.hints: { kind: 'solver', suggest }." });
  }
}

function checkSavePolicy(repo, id, module, report) {
  const isRealtime = !/realtime:\s*null\b/.test(module);
  const persistence = code(text(repo, `apps/${id}/src/rules/${id}-persistence.ts`));
  if (persistence === '') return;
  const savesPoints = /kind:\s*'save-points'/.test(persistence);
  if (isRealtime !== savesPoints) report.problem({ file: `apps/${id}/src/rules/${id}-persistence.ts`, line: 1, rule: 'save-policy', message: isRealtime ? 'a real-time game must save at save points, not after every move' : 'a turn-based game (realtime: null) must save after every move', fix: 'Turn-based: savePolicy { kind: \'after-every-move\' }. Real-time: { kind: \'save-points\', points: [...] } and realtime.savePoints (never per frame).' });
}

/** Runs the teaching module: 3-5 pages, legal expected moves, keys in all four catalogs. */
export async function checkTeaching(modules, repo, id, report) {
  const rel = `apps/${id}/src/tutorial/${id}-teaching.ts`;
  const listRel = `apps/${id}/src/rules/list-moves.ts`;
  const applyRel = `apps/${id}/src/rules/apply-move.ts`;
  if (!repo.exists(rel) || !repo.exists(listRel) || !repo.exists(applyRel)) return 0;
  let teaching;
  let listMoves;
  let applyMove;
  try {
    teaching = Object.values(await modules.load(rel)).find((value) => value && typeof value === 'object' && value.tutorial && Array.isArray(value.howToPlay));
    ({ listMoves } = await modules.load(listRel));
    ({ applyMove } = await modules.load(applyRel));
    if (!teaching) throw new Error(`${rel} exports no TeachingSpec`);
  } catch (error) {
    report.problem({ file: rel, rule: 'teaching', message: `cannot run headless: ${errorText(error)}`, fix: 'Teaching imports only the game\'s rules and game-kit types.' });
    return 1;
  }
  const pages = teaching.howToPlay.length;
  if (pages < 3 || pages > 5) report.problem({ file: rel, rule: 'teaching', message: `${pages} how-to-play pages; S13 shows 3 to 5`, fix: 'Write 3 to 5 short pages, each illustrated by an example state.' });
  let state = teaching.tutorial.start;
  teaching.tutorial.steps.forEach((step, index) => {
    if (step.expect.kind !== 'move') return;
    const legal = listMoves(state).some((move) => JSON.stringify(move) === JSON.stringify(step.expect.move));
    if (!legal) report.problem({ file: rel, rule: 'teaching', message: `tutorial step ${index + 1} expects ${JSON.stringify(step.expect.move)}, which is not a legal move there`, fix: 'Script the tutorial with moves listMoves offers at each step (apply them in order from tutorial.start).' });
    else state = applyMove(state, step.expect.move).state;
  });
  const keys = [...teaching.tutorial.steps.map((step) => step.messageId), ...teaching.howToPlay.flatMap((page) => [page.titleId, page.bodyId])];
  for (const lang of ['en', 'de', 'fa', 'ckb']) {
    const catalogRel = `apps/${id}/src/i18n/${lang}.json`;
    let catalog = {};
    try {
      catalog = JSON.parse(text(repo, catalogRel) || '{}');
    } catch {
      catalog = {};
    }
    const missing = [...new Set(keys)].filter((key) => !(key in catalog));
    if (missing.length > 0) report.problem({ file: catalogRel, rule: 'teaching-keys', message: `teaching keys missing: ${missing.join(', ')}`, fix: 'Add every tutorial and how-to-play message to all four catalogs.' });
  }
  return 1;
}
