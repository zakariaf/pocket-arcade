# Statistics, the run-end write and the S10 summary

The player's own history, stored only on the phone: what is stored, how a finished run is recorded (in the same write as its level and daily result), how S10's numbers are derived, and which element shows which number. `scripts/check-daily-stats.mjs` runs `recordFinishedRun`, `measureRunCounters`, `applyRunEnd` and `buildStatsSummary` against these rules.

## Contents

- Product rules
- The stats section
- Where each S10 number comes from
- recordFinishedRun
- Game-specific counters
- The run-end write
- The S10 summary (the data behind the screen)
- S10 elements and their data
- The empty state and "Reset statistics"
- What check-daily-stats reports

## Product rules

- S10 shows, in cards: Overview (games played, wins, win rate, total play time); Levels (levels completed, stars earned / total, 3-star levels); Best (best score per mode, best level result, longest win streak); Daily (challenges completed, current streak, best streak); Last 7 days (a bar chart of games played per day; time runs right to left in RTL); a game-specific card (2 to 4 numbers the game defines, for example Line Siege's "Monsters defeated", "Beams fired", "Biggest combo"); "Reset statistics" (with confirmation); a banner ad slot at the bottom (same rules as Home).
- Every number uses the chosen digits. Durations are shown as "2 h 14 min", translated in full.
- A new player sees a friendly empty state ("Play a level to see your stats here"), not a wall of zeros.
- S7: stars and statistics are saved BEFORE the result screen appears.
- S9: the first completion of a day counts for statistics; daily replays do not.

## The stats section

```ts
stats: {
  gamesPlayed: number; wins: number; losses: number; playMs: number;
  bestScore: { level: number; daily: number; endless: number };
  currentWinStreak: number; longestWinStreak: number;
  days: Record<DateKey, { games: number; playMs: number }>;   // pruned to the last 14 days
  counters: Record<string, number>;                            // by CounterSpec.id (kebab-case)
}
```

Only numbers that cannot be derived are stored. `DEFAULT_STATS` (every count 0, `days: {}`, `counters: {}`) is both a new player's section and what "Reset statistics" writes.

## Where each S10 number comes from

| S10 number | Source |
|---|---|
| games played, wins, win rate, total play time | `stats.gamesPlayed`, `stats.wins`, `wins / gamesPlayed` (0 when no game), `stats.playMs` |
| levels completed, stars earned / total, 3-star levels | derived from `progress.levels` and the game's level count (`levels.table.length`, 3 stars each) |
| best score per mode | `stats.bestScore.{level,daily,endless}`; the Endless row is `max(bestScore.endless, progress.endlessBest)` and exists only for games with Endless |
| best level result | derived: the level with the highest `bestScore` (ties: the lower level) |
| longest win streak | `stats.longestWinStreak` |
| daily completed, current streak, best streak | `daily.completed`, `currentDailyStreak(daily, today)`, `daily.bestStreak` |
| last 7 days chart | `stats.days` for today-6 ... today (zero days show 0) |
| game-specific counters | `stats.counters[id]` for each of the game's `CounterSpec` ids, in its order |

## recordFinishedRun

```ts
// packages/shell/src/stores/stats-model.ts (pure)
type FinishedRun = { mode: 'level' | 'daily' | 'endless'; isWon: boolean; score: number; playMs: number;
                     counters: Record<string, { value: number; aggregate: 'sum' | 'max' }> };
recordFinishedRun(stats, run, today): StatsSection
STATS_KEEP_DAYS = 14
```

- `gamesPlayed + 1`; `wins + 1` or `losses + 1`; `playMs + run.playMs`.
- `bestScore[run.mode] = max(previous, run.score)`.
- `currentWinStreak = isWon ? current + 1 : 0`; `longestWinStreak = max(longest, currentWinStreak)`.
- `days[today] += { games: 1, playMs }`, then drop entries 14 or more days older than today.
- Counters fold by their aggregate: `'sum'` adds, `'max'` keeps the larger.
- The tutorial is not a game: it never reaches this function.

## Game-specific counters

```ts
// from the game contract
type CounterSpec<TEvent> = { id: string /* kebab-case, stable forever: a save key */;
  labelId: MessageId; aggregate: 'sum' | 'max'; measure: (events: readonly TEvent[]) => number };

measureRunCounters(counters, eventsPerMove)   // per counter: 'sum' of the per-move values, or the 'max'
```

Counters are measured at run end by replaying the run's FINAL move line (the saved `log` from `create(seed, difficulty)`, collecting each move's events) and calling each `measure`: undone moves are not in the line, so they never count, and a kill mid-run loses nothing because the log is saved. A counter id is a key in the save document: never rename it (a rename is a save-format change).

## The run-end write

```ts
// packages/shell/src/stores/run-end.ts (pure)
type RunEnd = { isWon; score; moves; playMs; counters } & (
  | { mode: 'level'; level: number; stars: 1 | 2 | 3 }
  | { mode: 'daily'; date: DateKey }          // run.ref.date: the day the run STARTED
  | { mode: 'endless' }
  | { mode: 'tutorial' });
applyRunEnd(doc, end, today): SaveDoc
```

| Mode | What changes (always `run: null`) |
|---|---|
| `level`, won | `recordLevelResult` (best stars, score, moves kept) and `recordFinishedRun` |
| `level`, lost | `recordFinishedRun` only (a loss is not a level result) |
| `daily`, first finished attempt of `end.date` | `recordDailyResult(daily, end.date, { won, score, moves, playMs })` and `recordFinishedRun` |
| `daily`, a replay (`end.date` already recorded) | nothing else: neither the day's result nor the statistics |
| `endless` | `recordEndlessScore` (keeps the best) and `recordFinishedRun` |
| `tutorial` | nothing else: the tutorial is not a game |

The game host applies it in ONE save update with the backup refreshed, before the result screen and its animation, and then every section store re-reads the document:

```ts
updateAndPublish(save, stores, { recipe: (doc) => applyRunEnd(doc, end, clock.today()), refreshBackup: true });
```

The ads service's level-end history is composed into the same recipe when ads are on. `applyRunEnd` uses the progress reducer's two pure functions, which the stores work provides: `recordLevelResult(progress, { level, stars, score, moves, date })` keeps max stars, max score, min moves (`null` = moves not counted), completions + 1 and the first completion date; `recordEndlessScore(progress, score)` keeps the higher score and returns the same object otherwise.

## The S10 summary (the data behind the screen)

```ts
// packages/shell/src/screens/stats/stats-summary.ts (pure)
buildStatsSummary({ stats, progress, daily, today, levelCount, hasEndless, counterIds }): StatsSummary
// { isEmpty, overview: { gamesPlayed, wins, winRate /* 0..1 */, playTime: { hours, minutes } },
//   levels: { completed, starsEarned, starsTotal, threeStarLevels },
//   best: { levelScore, dailyScore, endlessScore: number | null, bestLevel: { level, score } | null, longestWinStreak },
//   daily: { completed, currentStreak, bestStreak },
//   week: { days: [{ date, weekday, games }] /* 7, oldest first */, max /* >= 1 */ },
//   counters: [{ id, value }] }
splitDuration(ms)   // whole hours and remaining whole minutes: 8_040_000 -> { hours: 2, minutes: 14 }
// packages/shell/src/screens/stats/use-stats-summary.ts
useStatsSummary({ levelCount, hasEndless, counterIds })   // useToday() + section-reference selectors
```

- `isEmpty` is `gamesPlayed === 0`.
- `winRate` is a fraction for ICU `::percent` (0.75 shows "75%" in the chosen digits).
- `week.max` is at least 1, so a week of zero days never divides by zero; a bar is `games / max x 92` pt tall.
- Selectors return section references (`selectStats`, `(s) => s.progress`, `selectDaily`), so no `useShallow` is needed; the summary is rebuilt on each render (it is cheap).
- `examples/stats-cards.ts` turns the summary into stat-grid cells with their testIDs, label keys and value formats.

The names are `…-summary.ts` on purpose: the screen files in the same folder are `stats-view.tsx` (the `StatsView` component), `stats-model.ts` (`StatsModel` with its `StatsSnapshot`), `stats-cells.ts` and `use-stats-model.ts`. `use-stats-model.ts` fills the flat `StatsSnapshot` from `useStatsSummary(...)`:

| `StatsSnapshot` field (screen) | From the summary |
|---|---|
| `gamesPlayed`, `wins`, `winRate` | `overview.gamesPlayed`, `overview.wins`, `overview.winRate` |
| `playHours`, `playMinutes` | `overview.playTime.hours`, `overview.playTime.minutes` |
| `levelsCompleted`, `starsEarned`, `starsTotal`, `threeStarLevels` | `levels.*` |
| `bestLevels`, `bestDaily`, `bestEndless` | `best.levelScore`, `best.dailyScore`, `best.endlessScore` (null hides the row) |
| `bestLevelScore` | `best.bestLevel` as it is (`{ level, score }`, or `null` until a level is won: a player may have only lost, or only played the daily). The screen's `StatsSnapshot.bestLevelScore` is nullable and leaves the "Best level score" row out for `null`; never map `null` to `{ level: 0, score: 0 }` |
| `bestWinStreak` | `best.longestWinStreak` |
| `dailyCompleted`, `currentStreak`, `bestStreak` | `daily.completed`, `daily.currentStreak`, `daily.bestStreak` |
| `week[i]` (`letter`, `weekdayName`, `games`; the bar component numbers the bars by position) | `week.days[i]`: `date.weekday-strip.<weekday>`, `date.weekday.<weekday>`, `games` |
| `gameStats[i]` (`key`, `label`, `valueText`) | `counters[i]`: `id`, the game's counter label, the value in the chosen digits |

## S10 elements and their data

| testID | Copy key or value | From |
|---|---|---|
| `stats.top-bar.title` | `common.statistics` | |
| `stats.overview-card.title` | `stats.overview.title` | |
| `stats.overview-card.games-played` / `.wins` | labels `stats.overview.games-played` / `stats.overview.wins`, plain numbers | `overview.gamesPlayed`, `overview.wins` |
| `stats.overview-card.win-rate` | label `stats.overview.win-rate`, value a `::percent` number | `overview.winRate` |
| `stats.overview-card.play-time` | label `stats.overview.play-time`, value `stats.duration` (`hours`, `minutes`) | `overview.playTime` |
| `stats.levels-card.title` | `common.levels` | |
| `stats.levels-card.completed` / `.three-star` | `stats.levels.completed` / `stats.levels.three-star` | `levels.completed`, `levels.threeStarLevels` |
| `stats.levels-card.stars` | label `stats.levels.stars`, value `stats.levels.stars-value` (`earned`, `total`) | `levels.starsEarned`, `levels.starsTotal` |
| `stats.best-card.title`, `.score-heading` | `stats.best.title`, `stats.best.score` | |
| `stats.best-card.levels` / `.daily` / `.endless` | labels `common.levels`, `common.mode.daily`, `common.mode.endless` (Endless only in games with Endless) | `best.levelScore`, `best.dailyScore`, `best.endlessScore` |
| `stats.best-card.level-score` | label `stats.best.level-score`, value `stats.best.level-score-value` (`level`, `score`) | `best.bestLevel` (row hidden when null) |
| `stats.best-card.win-streak` | `stats.best.win-streak` | `best.longestWinStreak` |
| `stats.daily-card.title` | `daily.title` | |
| `stats.daily-card.completed` | `stats.daily.completed` | `daily.completed` |
| `stats.daily-card.current-streak` / `.best-streak` | labels `daily.streak.current` / `daily.streak.best`, values `daily.streak.days` (`daysCount`) | `daily.currentStreak`, `daily.bestStreak` |
| `stats.week-card.title`, `.subtitle` | `daily.week.title` (`daysCount: 7`), `stats.week.subtitle` | |
| `stats.week-bar.<n>` (`.value`, `.bar`, `.day`); `<n>` is the position, 1 = today minus 6 days, 7 = today | value (plain number), day letter `date.weekday-strip.<weekday>` (the day's ISO weekday), a11y `stats.week.bar.a11y-label` (`weekdayName` = `date.weekday.<weekday>`, `gamesCount`) | `week.days[i]` |
| `stats.game-card.title` | `stats.game.title` (`gameName`), logo tile | |
| `stats.game-card.<counter-id>` | the game's counter label; values such as "×6" keep the multiplication sign | `counters[i]` |
| `stats.reset-button` | `stats.reset-button` (danger, trash icon), opens the S14 dialog | |
| `stats.local-note` | `stats.local-note` (lock icon) | |

Card order and layout (Toybox S10): Overview (2 columns), Levels (3 columns), Best (stat list), Daily (3 columns), Last 7 days (bar chart), the game's card (3 columns), then the reset button, the local note and the banner slot; body gap 16. The layout itself, the stat grid, stat list and bar chart components belong to the screen and component work; match the Toybox S10 screenshot (normal and empty variants).

## The empty state and "Reset statistics"

- Empty (`summary.isEmpty`): `stats.empty-state` with `.picture`, `.title` (`stats.empty.title`) and `.body` (`stats.empty.body`), the hero key `stats.play-button` (copy `stats.empty.play-button`), `stats.local-note` and the banner slot.
- "Reset statistics" (S10 button and the S11 Data row) asks first (`dialog.reset-stats.title` / `.body` / `.confirm`), then dispatches `reset-statistics` to the stats store: the `stats` section becomes `DEFAULT_STATS`, written with the backup refreshed so a later backup restore cannot bring the numbers back. Level progress, stars, daily results and Premium are kept.
- Right after a reset `gamesPlayed` is 0, so the screen shows the empty state. Open owner decision: the dialog says "All numbers on the Statistics page go back to zero", but after the next game the Levels and Daily cards again show the derived totals (levels completed, stars, daily streaks come from progress and daily, which only "Reset all progress" clears). If the owner wants those cards to count only since the reset, they need reset baselines stored in `stats` (a save-format change). Ask before changing it.

## What check-daily-stats reports

| Rule | Checks |
|---|---|
| `missing-module`, `module-load` | the seven modules exist and load as pure TypeScript (`date-key`, `daily-seed`, `daily-model`, `stats-model`, `run-end`, `daily-summary`, `stats-summary`) |
| `date-math` | day numbers, leap years, round trips, ISO weekdays |
| `seed-golden` | the five golden seeds |
| `daily-first-attempt`, `daily-streak`, `daily-clock-back`, `daily-prune`, `daily-week` | the daily model rules above |
| `stats-counts`, `stats-streak`, `stats-best`, `stats-days`, `stats-counters` | `recordFinishedRun` and `measureRunCounters` |
| `run-end-record` | every row of the run-end table |
| `view-daily`, `view-stats` | the S9 and S10 summaries, including `daily.completed` and ISO weekdays |
| `wall-clock` | `Date`, `Math.random`, `Intl.DateTimeFormat`, `toLocale*` in daily and statistics code |
| `today-cached` | today kept in `useState`, `useRef` or a module constant |
| `day-maths-in-ui` | streak or date arithmetic in a screen file (other than `*-summary.ts`) instead of the summary |
