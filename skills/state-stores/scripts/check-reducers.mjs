#!/usr/bin/env node
// check-reducers.mjs: runs the app's own pure reducers (settings, progress, GameSession) against
// the rules they must keep, independent of the app's tests: volume clamp, first-run flags, best
// results kept, one free hint per day, undo limits, one continue after a loss, paused runs ignore
// moves, no mutation of the input. It imports the TypeScript files directly (Node type stripping).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-reducers.mjs [repo-root]

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, parseArgs, requireDir, run } from './check-lib.mjs';
import { deepFreeze, enableAppImports, lineOfExport, reasonOf } from './lib/app-modules.mjs';

const SPEC = {
  name: 'check-reducers',
  summary:
    'Runs the pure reducers of a Pocket Arcade app repo (settingsReducer, progressReducer, gameSessionReducer) against the store rules and reports every rule a reducer breaks.',
  usage: '[repo-root] [--json]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Modules (all required):',
    '  packages/shell/src/stores/settings-reducer.ts     settingsReducer',
    '  packages/shell/src/stores/progress-reducer.ts     progressReducer, recordLevelResult',
    '  packages/shell/src/game-host/game-session-reducer.ts   gameSessionReducer, startGameSession',
    '',
    'Rules: missing-module, module-load, settings-volume, settings-first-run, progress-best,',
    'progress-free-hint, progress-upsell, session-move, session-undo, session-paused,',
    'session-continue, session-finished, reducer-mutates.',
    '',
    'The repo root is the positional argument (default ".").',
    '',
    'Example: node check-reducers.mjs .',
  ].join('\n'),
};

const MODULES = {
  settings: 'packages/shell/src/stores/settings-reducer.ts',
  progress: 'packages/shell/src/stores/progress-reducer.ts',
  session: 'packages/shell/src/game-host/game-session-reducer.ts',
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  requireDir(join(root, 'packages/shell/src'), 'Shell source folder (packages/shell/src)');
  const app = enableAppImports(root);
  const report = createReporter({ name: 'check-reducers', json: options.json });
  let checked = 0;
  for (const [key, rel] of Object.entries(MODULES)) {
    if (!app.exists(rel)) {
      report.problem({ file: rel, rule: 'missing-module', message: 'reducer module is missing', fix: 'Copy it from the skill templates and adapt it.' });
      continue;
    }
    let mod;
    try {
      mod = await app.load(rel);
    } catch (error) {
      report.problem({ file: rel, line: 1, rule: 'module-load', message: `cannot be imported: ${String(error.message).split('\n')[0]}`, fix: 'Keep reducers pure: import only types and pure modules, write .ts extensions, no enums or other non-erasable syntax.' });
      continue;
    }
    const source = readFileSync(join(root, rel), 'utf8');
    for (const check of CHECKS[key]) {
      checked += 1;
      try {
        check.run(mod);
      } catch (error) {
        const reason = reasonOf(error);
        report.problem({ file: rel, line: lineOfExport(source, check.fn), rule: check.rule, message: `${check.fn}: ${check.name}: ${reason}`, fix: check.fix });
      }
    }
  }
  return report.finish({ checked, unit: 'reducer rules' });
});

// ------------------------------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------------------------------

const SETTINGS = () => ({
  settings: {
    language: null, digits: 'automatic', soundEnabled: true, soundVolume: 80, musicEnabled: false,
    musicVolume: 60, vibrationEnabled: true, theme: 'system', colorBlind: false,
    reduceMotion: 'system', hintsDuringPlay: true,
  },
  firstRun: { languageChosen: false, tutorialDone: false },
});

const PROGRESS = () => ({
  progress: { levels: {}, endlessBest: 0 },
  daily: { results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
  hints: { freeDate: null, freeUsed: 0 },
  upsell: { lastShownOn: null },
});

/** The counter game: state n, a move adds, >= 10 wins, < 0 loses, one continue resets to 0. */
const counterRules = (undo) => ({
  create: (seed) => ({ n: seed }),
  applyMove: (state, move) => ({ state: { n: state.n + move }, events: ['added'] }),
  outcome: (state) => {
    if (state.n >= 10) return { kind: 'won', score: state.n };
    if (state.n < 0) return { kind: 'lost', reasonKey: 'test.lose' };
    return { kind: 'playing' };
  },
  undo,
  continueRun: { kind: 'once', descriptionId: 'test.continue', apply: () => ({ state: { n: 0 }, events: ['continued'] }) },
});
const LIMITED = counterRules({ kind: 'limited', perLevel: 1 });
const START = { ref: { kind: 'level', level: 1 }, seed: 2, difficulty: 10 };
const play = (mod, rules, moves, session = mod.startGameSession(rules, START)) =>
  moves.reduce((s, move) => mod.gameSessionReducer(rules, s, { type: 'apply-move', move }), session);

// ------------------------------------------------------------------------------------------
// Checks: each throws (assert) when the reducer breaks its rule.
// ------------------------------------------------------------------------------------------

const CHECKS = {
  settings: [
    {
      rule: 'settings-volume', fn: 'settingsReducer', name: 'volumes stay whole percentages in 0..100',
      fix: 'Clamp and round in the reducer: Math.min(100, Math.max(0, Math.round(volume))).',
      run: ({ settingsReducer }) => {
        for (const [volume, expected] of [[180, 100], [-5, 0], [33.6, 34]]) {
          strictEqual(settingsReducer(SETTINGS(), { type: 'set-sound', enabled: true, volume }).settings.soundVolume, expected, `set-sound ${volume} -> ${expected}`);
          strictEqual(settingsReducer(SETTINGS(), { type: 'set-music', enabled: true, volume }).settings.musicVolume, expected, `set-music ${volume} -> ${expected}`);
        }
      },
    },
    {
      rule: 'settings-first-run', fn: 'settingsReducer', name: 'set-language marks the language chosen; finish-tutorial is idempotent',
      fix: "set-language also sets firstRun.languageChosen; finish-tutorial sets firstRun.tutorialDone and nothing else.",
      run: ({ settingsReducer }) => {
        const chosen = settingsReducer(SETTINGS(), { type: 'set-language', language: 'fa' });
        strictEqual(chosen.settings.language, 'fa');
        strictEqual(chosen.firstRun.languageChosen, true, 'languageChosen after set-language');
        const once = settingsReducer(SETTINGS(), { type: 'finish-tutorial' });
        strictEqual(once.firstRun.tutorialDone, true);
        deepStrictEqual(settingsReducer(once, { type: 'finish-tutorial' }), once, 'finish-tutorial twice');
      },
    },
    {
      rule: 'reducer-mutates', fn: 'settingsReducer', name: 'the input state is never changed',
      fix: 'Return new objects ({ ...state, settings: { ...state.settings, ... } }); never assign into state.',
      run: ({ settingsReducer }) => {
        const frozen = deepFreeze(SETTINGS());
        for (const action of [{ type: 'set-theme', theme: 'dark' }, { type: 'set-sound', enabled: false, volume: 10 }, { type: 'finish-tutorial' }]) {
          settingsReducer(frozen, action);
        }
        deepStrictEqual(frozen, SETTINGS());
      },
    },
  ],
  progress: [
    {
      rule: 'progress-best', fn: 'recordLevelResult', name: 'the best result per level is kept (spec 8.1)',
      fix: 'Keep the max stars and score, the min moves (null = not counted), count completions, keep the first completion date.',
      run: ({ recordLevelResult }) => {
        const win = { level: 3, stars: 2, score: 900, moves: 9, date: '2026-09-26' };
        const first = recordLevelResult(PROGRESS().progress, win);
        const worse = recordLevelResult(first, { ...win, stars: 1, score: 100, moves: 20, date: '2026-09-28' });
        const better = recordLevelResult(worse, { ...win, stars: 3, score: 1200, moves: 7, date: '2026-09-29' });
        deepStrictEqual(worse.levels['3'], { stars: 2, bestScore: 900, bestMoves: 9, completions: 2, firstCompletedOn: '2026-09-26' });
        deepStrictEqual(better.levels['3'], { stars: 3, bestScore: 1200, bestMoves: 7, completions: 3, firstCompletedOn: '2026-09-26' });
      },
    },
    {
      rule: 'progress-free-hint', fn: 'progressReducer', name: "the game's free hints per local day (hints.freePerDay), a new day starts fresh",
      fix: "use-free-hint { today, freePerDay }: same day -> freeUsed + 1 while under freePerDay (game.config.ts hints.freePerDay), else return the same state; a new day -> { freeDate: today, freeUsed: 1 }; freePerDay 0 never spends one.",
      run: ({ progressReducer }) => {
        const hint = (today, freePerDay = 1) => ({ type: 'use-free-hint', today, freePerDay });
        const used = progressReducer(PROGRESS(), hint('2026-09-26'));
        deepStrictEqual(used.hints, { freeDate: '2026-09-26', freeUsed: 1 });
        strictEqual(progressReducer(used, hint('2026-09-26')), used, 'a second free hint on the same day returns the same state');
        deepStrictEqual(progressReducer(used, hint('2026-09-27')).hints, { freeDate: '2026-09-27', freeUsed: 1 });
        const none = PROGRESS();
        strictEqual(progressReducer(none, hint('2026-09-26', 0)), none, 'a game whose config gives 0 free hints never spends one');
      },
    },
    {
      rule: 'progress-upsell', fn: 'progressReducer', name: 'the upsell line is recorded once per day',
      fix: 'record-upsell-shown stores today in upsell.lastShownOn and returns the same state when it already holds today.',
      run: ({ progressReducer }) => {
        const shown = progressReducer(PROGRESS(), { type: 'record-upsell-shown', today: '2026-09-26' });
        strictEqual(shown.upsell.lastShownOn, '2026-09-26');
        strictEqual(progressReducer(shown, { type: 'record-upsell-shown', today: '2026-09-26' }), shown);
      },
    },
    {
      rule: 'reducer-mutates', fn: 'progressReducer', name: 'the input state is never changed',
      fix: 'Return new objects; never assign into state.progress, state.hints or state.upsell.',
      run: ({ progressReducer }) => {
        const frozen = deepFreeze(PROGRESS());
        progressReducer(frozen, { type: 'record-level-result', win: { level: 1, stars: 3, score: 5, moves: 2, date: '2026-09-26' } });
        progressReducer(frozen, { type: 'use-free-hint', today: '2026-09-26', freePerDay: 1 });
        progressReducer(frozen, { type: 'record-endless-score', score: 50 });
        deepStrictEqual(frozen, PROGRESS());
      },
    },
  ],
  session: [
    {
      rule: 'session-move', fn: 'gameSessionReducer', name: 'apply-move records the move, the previous state and the events',
      fix: 'apply-move: state from applyMove, past + previous state, log + { kind: "move" }, moveCount + 1, lastEvents = events, eventSeq + 1.',
      run: (mod) => {
        const next = play(mod, LIMITED, [3]);
        deepStrictEqual(next.state, { n: 5 });
        deepStrictEqual(next.past, [{ n: 2 }]);
        deepStrictEqual(next.log, [{ kind: 'move', move: 3 }]);
        strictEqual(next.moveCount, 1);
        deepStrictEqual(next.lastEvents, ['added']);
        strictEqual(next.eventSeq, 1);
      },
    },
    {
      rule: 'session-undo', fn: 'gameSessionReducer', name: 'undo steps back one move within the game\'s undo policy',
      fix: "undo: refuse (same object) when the policy is 'none', when 'limited' is used up, or when the last log entry is not a move.",
      run: (mod) => {
        const played = play(mod, LIMITED, [3, 1]);
        const once = mod.gameSessionReducer(LIMITED, played, { type: 'undo' });
        deepStrictEqual(once.state, { n: 5 });
        strictEqual(once.moveCount, 1);
        strictEqual(mod.gameSessionReducer(LIMITED, once, { type: 'undo' }), once, 'a second undo beyond perLevel 1');
        const none = counterRules({ kind: 'none' });
        const noUndo = play(mod, none, [1]);
        strictEqual(mod.gameSessionReducer(none, noUndo, { type: 'undo' }), noUndo, "undo with policy 'none'");
      },
    },
    {
      rule: 'session-paused', fn: 'gameSessionReducer', name: 'a paused run ignores moves and play time',
      fix: 'apply-move and add-play-time return the same session unless status is playing; resume only from paused.',
      run: (mod) => {
        const paused = mod.gameSessionReducer(LIMITED, mod.startGameSession(LIMITED, START), { type: 'pause' });
        strictEqual(paused.status, 'paused');
        strictEqual(mod.gameSessionReducer(LIMITED, paused, { type: 'apply-move', move: 1 }), paused, 'move while paused');
        strictEqual(mod.gameSessionReducer(LIMITED, paused, { type: 'add-play-time', ms: 500 }), paused, 'play time while paused');
        strictEqual(mod.gameSessionReducer(LIMITED, paused, { type: 'resume' }).status, 'playing');
      },
    },
    {
      rule: 'session-continue', fn: 'gameSessionReducer', name: 'exactly one continue, only after a loss, and undo cannot cross it',
      fix: "use-continue: only when status is 'lost', the policy is 'once' and continuesUsed is 0; clear past, continuesUsed = 1.",
      run: (mod) => {
        const lost = play(mod, LIMITED, [-5]);
        strictEqual(lost.status, 'lost');
        const continued = mod.gameSessionReducer(LIMITED, lost, { type: 'use-continue' });
        strictEqual(continued.status, 'playing');
        deepStrictEqual(continued.past, []);
        strictEqual(continued.continuesUsed, 1);
        const lostAgain = play(mod, LIMITED, [-1], continued);
        strictEqual(mod.gameSessionReducer(LIMITED, lostAgain, { type: 'use-continue' }), lostAgain, 'a second continue');
        const playing = mod.startGameSession(LIMITED, START);
        strictEqual(mod.gameSessionReducer(LIMITED, playing, { type: 'use-continue' }), playing, 'continue while playing');
      },
    },
    {
      rule: 'session-finished', fn: 'gameSessionReducer', name: 'a won run ignores further moves',
      fix: "apply-move returns the same session unless status is 'playing'.",
      run: (mod) => {
        const won = play(mod, LIMITED, [9]);
        strictEqual(won.status, 'won');
        strictEqual(mod.gameSessionReducer(LIMITED, won, { type: 'apply-move', move: 1 }), won);
      },
    },
    {
      rule: 'reducer-mutates', fn: 'gameSessionReducer', name: 'the input session is never changed',
      fix: 'Build a new session object for every change (spread, never push or assign).',
      run: (mod) => {
        const played = play(mod, LIMITED, [3]);
        const copy = structuredClone(played);
        deepFreeze(played);
        for (const action of [{ type: 'apply-move', move: 1 }, { type: 'undo' }, { type: 'use-hint' }, { type: 'pause' }, { type: 'add-play-time', ms: 5 }]) {
          mod.gameSessionReducer(LIMITED, played, action);
        }
        deepStrictEqual(played, copy);
        ok(true);
      },
    },
  ],
};
