// stats-checks.mjs: the spec rules for statistics (S10), the run-end recording (S7, S9) and the
// S10 summary. Each check: { rule, fn, name, needs, fix, run(modules, assert) }.

const EMPTY_STATS = () => ({
  gamesPlayed: 0, wins: 0, losses: 0, playMs: 0, bestScore: { level: 0, daily: 0, endless: 0 },
  currentWinStreak: 0, longestWinStreak: 0, days: {}, counters: {},
});
const RUN = { mode: 'level', isWon: true, score: 300, playMs: 60_000, counters: {} };
const TODAY = '2026-09-26';
const fold = (statsModel, runs, today = TODAY) => runs.reduce((acc, run) => statsModel.recordFinishedRun(acc, run, today), EMPTY_STATS());

const DOC = () => ({
  schemaVersion: 1,
  gameId: 'line-siege',
  settings: {},
  firstRun: { languageChosen: true, tutorialDone: true },
  progress: { levels: {}, endlessBest: 0 },
  run: { ref: { kind: 'level', level: 4 }, seed: 1, difficulty: 1, stateVersion: 1, state: {}, log: [], moveCount: 8, undoCount: 0, hintsUsed: 0, continuesUsed: 0, playMs: 90_000, resumeOnLaunch: true },
  daily: { results: {}, completed: 0, streak: { lastDate: null, length: 0 }, bestStreak: 0 },
  stats: EMPTY_STATS(),
  hints: { freeDate: null, freeUsed: 0 },
  ads: {},
  premium: { owned: false, ownedSinceMs: null, lastCheckedAtMs: null, revokedAtMs: null },
  upsell: { lastShownOn: null },
});
const END = { isWon: true, score: 400, moves: 8, playMs: 90_000, counters: {} };

export const STATS_CHECKS = [
  {
    rule: 'stats-counts', fn: 'recordFinishedRun', needs: ['statsModel'], name: 'games, wins, losses and play time add up',
    fix: 'gamesPlayed + 1, wins or losses + 1, playMs + run.playMs for every finished non-tutorial run.',
    run: ({ statsModel }, { strictEqual }) => {
      const stats = fold(statsModel, [RUN, { ...RUN, isWon: false }, RUN]);
      strictEqual(stats.gamesPlayed, 3);
      strictEqual(stats.wins, 2);
      strictEqual(stats.losses, 1);
      strictEqual(stats.playMs, 180_000);
    },
  },
  {
    rule: 'stats-streak', fn: 'recordFinishedRun', needs: ['statsModel'], name: 'a loss resets the current win streak; the longest is kept',
    fix: 'currentWinStreak = won ? current + 1 : 0; longestWinStreak = max(longest, current).',
    run: ({ statsModel }, { strictEqual }) => {
      const stats = fold(statsModel, [RUN, RUN, RUN, { ...RUN, isWon: false }, RUN]);
      strictEqual(stats.currentWinStreak, 1);
      strictEqual(stats.longestWinStreak, 3);
    },
  },
  {
    rule: 'stats-best', fn: 'recordFinishedRun', needs: ['statsModel'], name: 'the best score is kept per mode',
    fix: 'bestScore[run.mode] = max(bestScore[run.mode], run.score).',
    run: ({ statsModel }, { deepStrictEqual }) => {
      const stats = fold(statsModel, [RUN, { ...RUN, mode: 'daily', score: 999 }, { ...RUN, score: 10 }]);
      deepStrictEqual(stats.bestScore, { level: 300, daily: 999, endless: 0 });
    },
  },
  {
    rule: 'stats-days', fn: 'recordFinishedRun', needs: ['statsModel'], name: 'games per local day are kept for 14 days',
    fix: 'days[today] += { games: 1, playMs }; drop entries 14 or more days older than today.',
    run: ({ statsModel }, { deepStrictEqual }) => {
      const days = ['2026-09-01', '2026-09-12', '2026-09-13', TODAY, TODAY].reduce((acc, day) => statsModel.recordFinishedRun(acc, RUN, day), EMPTY_STATS()).days;
      deepStrictEqual(days, { '2026-09-13': { games: 1, playMs: 60_000 }, [TODAY]: { games: 2, playMs: 120_000 } }, '13 days back is kept, 14 is dropped');
    },
  },
  {
    rule: 'stats-counters', fn: 'recordFinishedRun', needs: ['statsModel'], name: "game counters fold by 'sum' or 'max'",
    fix: "'sum' adds the run's value to the stored one, 'max' keeps the larger; measureRunCounters measures the final move line.",
    run: ({ statsModel }, { deepStrictEqual }) => {
      const run = (value) => ({ ...RUN, counters: { 'monsters-defeated': { value, aggregate: 'sum' }, 'biggest-combo': { value, aggregate: 'max' } } });
      deepStrictEqual(fold(statsModel, [run(4), run(7), run(2)]).counters, { 'monsters-defeated': 13, 'biggest-combo': 7 });
      const measure = (events) => events.length;
      deepStrictEqual(
        statsModel.measureRunCounters([{ id: 'beams-fired', aggregate: 'sum', measure }, { id: 'biggest-combo', aggregate: 'max', measure }], [['a'], ['a', 'b', 'c'], []]),
        { 'beams-fired': { value: 4, aggregate: 'sum' }, 'biggest-combo': { value: 3, aggregate: 'max' } },
      );
    },
  },
  {
    rule: 'run-end-record', fn: 'applyRunEnd', needs: ['runEnd'], name: 'the run-end write clears the run and records each mode by the spec',
    fix: 'run: null always; tutorial records nothing; a lost level only stats; a daily records under its own date, a daily replay nothing; endless keeps the best score and records stats.',
    run: ({ runEnd }, { deepStrictEqual, strictEqual }) => {
      const won = runEnd.applyRunEnd(DOC(), { ...END, mode: 'level', level: 4, stars: 3 }, TODAY);
      strictEqual(won.run, null, 'run cleared');
      strictEqual(won.progress.levels['4']?.stars, 3, 'won level recorded');
      strictEqual(won.stats.gamesPlayed, 1, 'stats recorded');
      const lost = runEnd.applyRunEnd(DOC(), { ...END, isWon: false, mode: 'level', level: 4, stars: 1 }, TODAY);
      deepStrictEqual(lost.progress.levels, {}, 'a lost level is not a result');
      strictEqual(lost.stats.losses, 1, 'a lost level counts as a loss');
      const endless = runEnd.applyRunEnd(DOC(), { ...END, isWon: false, score: 4210, mode: 'endless' }, TODAY);
      strictEqual(endless.progress.endlessBest, 4210, 'endless keeps its best score');
      strictEqual(endless.stats.gamesPlayed, 1, 'an endless run is a game');
      strictEqual(endless.stats.bestScore.endless, 4210, 'endless best score in the statistics');
      strictEqual(endless.run, null, 'endless run cleared');
      const tutorial = runEnd.applyRunEnd(DOC(), { ...END, mode: 'tutorial' }, TODAY);
      strictEqual(tutorial.stats.gamesPlayed, 0, 'the tutorial is not a game');
      const daily = runEnd.applyRunEnd(DOC(), { ...END, mode: 'daily', date: '2026-09-25' }, TODAY);
      deepStrictEqual(Object.keys(daily.daily.results), ['2026-09-25'], "recorded under the run's own date");
      const replay = runEnd.applyRunEnd({ ...daily, run: DOC().run }, { ...END, score: 9999, mode: 'daily', date: '2026-09-25' }, TODAY);
      deepStrictEqual(replay.stats, daily.stats, 'a daily replay changes no statistics');
      deepStrictEqual(replay.daily, daily.daily, "a daily replay keeps the day's first result");
    },
  },
  {
    rule: 'view-stats', fn: 'buildStatsSummary', needs: ['statsSummary'], name: 'S10 view: empty state, win rate, stars, best level, week bars, counters',
    fix: 'isEmpty = gamesPlayed === 0; winRate = wins / gamesPlayed (0..1); stars total = 3 x levelCount; best level = highest bestScore (ties: lower level); week max >= 1.',
    run: ({ statsSummary }, { deepStrictEqual, strictEqual }) => {
      const base = { levelCount: 90, hasEndless: false, counterIds: ['beams-fired'], today: TODAY, daily: DOC().daily, progress: DOC().progress };
      const empty = statsSummary.buildStatsSummary({ ...base, stats: EMPTY_STATS() });
      strictEqual(empty.isEmpty, true);
      strictEqual(empty.overview.winRate, 0);
      strictEqual(empty.week.max, 1);
      strictEqual(empty.best.endlessScore, null, 'no Endless row without Endless');
      const levels = { 1: { stars: 3, bestScore: 800, bestMoves: 7, completions: 1, firstCompletedOn: TODAY }, 2: { stars: 1, bestScore: 800, bestMoves: null, completions: 1, firstCompletedOn: TODAY } };
      const stats = { ...EMPTY_STATS(), gamesPlayed: 4, wins: 3, playMs: 8_040_000, days: { [TODAY]: { games: 4, playMs: 1 } }, counters: { 'beams-fired': 12 } };
      const view = statsSummary.buildStatsSummary({ ...base, stats, progress: { levels, endlessBest: 0 }, daily: { ...DOC().daily, completed: 70 } });
      strictEqual(view.isEmpty, false);
      strictEqual(view.overview.winRate, 0.75);
      deepStrictEqual(view.overview.playTime, { hours: 2, minutes: 14 });
      deepStrictEqual(view.levels, { completed: 2, starsEarned: 4, starsTotal: 270, threeStarLevels: 1 });
      deepStrictEqual(view.best.bestLevel, { level: 1, score: 800 });
      strictEqual(view.daily.completed, 70, 'challenges completed comes from daily.completed (results are pruned)');
      strictEqual(view.week.days.length, 7);
      deepStrictEqual(view.week.days.at(-1), { date: TODAY, weekday: 6, games: 4 });
      strictEqual(view.week.max, 4);
      deepStrictEqual(view.counters, [{ id: 'beams-fired', value: 12 }]);
    },
  },
];
