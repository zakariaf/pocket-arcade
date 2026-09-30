---
name: daily-and-statistics
description: Builds and checks the daily challenge and statistics - date keys, daily seed goldens, streaks, 7-day strip, next-day countdown, run ends, counters, S9/S10 summaries. Use when touching daily play, dates, streaks, stats or run-end saves. Not for the board a seed makes (level-generation-and-solvers).
---

# Daily challenge and statistics

The daily level is the same for every player on the same local date, the first finished attempt of a day counts, streaks follow "played yesterday or today", and every finished run is recorded once, before the result screen; S9 and S10 only format pure summaries, and one script proves all of it against the app's own code.

## Rules that must hold

1. **Days are `'YYYY-MM-DD'` keys from `ClockPort.today()`, and all calendar maths goes through `game-kit/dates/date-key.ts` (integers only).** No `Date`, `Intl.DateTimeFormat` or `toLocale*` in daily or statistics code: Hermes formats `fa` dates in the Solar Hijri calendar and ignores the chosen digits, and time zones would make two phones disagree.
2. **The daily seed is `dailySeed(today, levels.daily.salt)` and its golden values never change** (`('2026-09-26', 17)` gives `2599028541`). Changing it gives players different daily levels between app versions; a change needs the owner's approval and a `Gate-Change:` trailer.
3. **"Today" is read, never cached:** `useToday()` on every render (it re-reads on focus and when the app returns), `clock.today()` again in handlers, and a daily run records under its own `run.ref.date`. The day changes at local midnight, and a run finished after midnight belongs to the day it started; the "Next challenge in" countdown comes from `ClockPort.msUntilNextLocalDay()` through `useNextDayCountdown()`, because only the clock adapter knows the time zone and daylight saving.
4. **The first finished attempt of a day counts, won or lost; a replay changes neither the day's result nor the statistics; the streak is "played yesterday or today"; a clock going backwards keeps done days and never double-counts.** These are spec S9's rules word for word; there is no streak insurance and no archive.
5. **A finished run is recorded by the pure `applyRunEnd(doc, end, today)` in ONE save update with the backup refreshed, before the result screen appears.** Level result, daily result and statistics land together or not at all; the tutorial is not a game.
6. **Store only what cannot be derived, incrementally:** streak (`lastDate`, `length`), `daily.completed` and `bestStreak` are counters, so pruning `daily.results` to 60 days and `stats.days` to 14 never shortens a streak or a total.
7. **Screens only format.** Every number, mark and flag on S9, S10, the Home daily card and the daily result comes from `buildDailySummary` / `buildStatsSummary`; a new player sees the empty state (`gamesPlayed === 0`), and numbers use the chosen digits through catalog messages.
8. **Game counters are measured at run end over the run's final move line and folded by `'sum'` or `'max'`; a counter id is a save key and never changes.** Undone moves must not count, and a renamed id would orphan the stored total.

## Workflow

1. Read [references/daily-challenge.md](references/daily-challenge.md) for the daily rules, date keys, seed goldens, daily model, the S9 summary with its mapping to the screen model, and the S9 / Home / result element tables; read [references/statistics.md](references/statistics.md) for the stats section, the run-end write, counters, the S10 summary with its mapping to the screen model, its element table and the reset rules.
2. Check the prerequisites in the app repo: the save document's `daily` (with `completed`) and `stats` sections, the progress and stats stores with `updateAndPublish` and the progress reducer's `recordLevelResult` / `recordEndlessScore`, and `useServices()`. Build missing pieces first (save-persistence-and-migrations, state-stores).
3. Copy `templates/packages/` into `packages/`: `game-kit/src/dates/` (date keys, seed, tests), `shell/src/services/clock/` (the ClockPort with `msUntilNextLocalDay`, its system adapter and fake, with tests; replace an older two-member port with these files), `shell/src/stores/` (daily model, stats model, run end, tests), `shell/src/app/use-today.ts`, and `shell/src/screens/daily/` and `screens/stats/` (`daily-summary.ts`, `use-next-day-countdown.ts`, `stats-summary.ts`, their hooks and tests). The `-summary` names keep them apart from the screen files (`daily-view.tsx`, `daily-model.ts`, `stats-view.tsx`, `stats-model.ts`) that the screen work puts in the same folders.
4. Wire the behaviour: start the daily run with the seed and `ref: { kind: 'daily', date: today }`; at run end call `updateAndPublish(save, stores, { recipe: (doc) => applyRunEnd(doc, end, clock.today()), refreshBackup: true })` before showing S7; build `end.counters` with `measureRunCounters(game.stats.counters, eventsPerMove)` from the replayed final move line.
5. Screens: feed S9, the Home daily card, the daily result and S10 from `useDailySummary()` / `useStatsSummary(game shape)` using the element tables (testIDs, copy keys, value formats; see [examples/stats-cards.ts](examples/stats-cards.ts)); the screens' `use-daily-model.ts` / `use-stats-model.ts` (toybox-screens templates, with tests; S10's takes the level count from `useGameExtra()` and the counters, with their label keys, from `useGameHost().counters`) map the summaries onto their models as the references' mapping tables show. Layout and components come from the Toybox screen specs; compare with the S9 and S10 screenshots (set the debug date to a Sunday for S9). After today's game, fill the "Next challenge in {h} h {m} min" line (`daily.today-card.next-in`) from `useNextDayCountdown()` (daily reference, "The Next challenge in countdown").
6. Write the test first for any rule change, then run `npx jest packages/game-kit/src/dates packages/shell/src/services/clock packages/shell/src/stores packages/shell/src/screens/daily packages/shell/src/screens/stats --ci --selectProjects unit --coverage --collectCoverageFrom='packages/game-kit/src/dates/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds) and `npx tsc -p packages/shell --noEmit`.
7. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-daily-stats.mjs .` from the repo root; fix every `FAIL` line and rerun until it prints `RESULT: PASS`. In a partial Shell (`shell-slice.json`) a summary that no slice screen needs prints a `SKIP` line instead of `missing-module` (`daily-summary.ts`: S4 or S9; `stats-summary.ts`: S10); the store modules skip only with `"screens": []`, and the game-kit date modules never skip.

## Definition of done

- [ ] Date maths only in `date-key.ts`; the five seed goldens pass; no wall-clock or `Intl` date call in daily or statistics code.
- [ ] `recordDailyResult` keeps the first attempt, counts `completed`, follows the streak rules and survives the clock going backwards.
- [ ] The run end is one `updateAndPublish` write of `applyRunEnd` with the backup refreshed, before S7; tutorial and daily replays record nothing.
- [ ] S9, the Home card, the daily result and S10 read only `useDailySummary()` / `useStatsSummary()`; the empty state shows for a new player.
- [ ] `ClockPort` has `msUntilNextLocalDay()` in the port, the system adapter and the fake, and S9's "Next challenge in" line reads `useNextDayCountdown()`.
- [ ] Every element of the S9 and S10 tables has its testID and copy key; the screens match their Toybox screenshots.
- [ ] Date, daily, stats, run-end and summary tests pass, and `tsc` is clean.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-daily-stats.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **`new Date().toISOString().slice(0, 10)` for today.** That is UTC, not the local day; use `ClockPort.today()`.
- **`const [today] = useState(clock.today())`.** The screen stays on yesterday after midnight; use `useToday()`.
- **`Object.keys(daily.results).length` for "Challenges completed".** Results are pruned to 60 days; read `daily.completed`.
- **Computing the streak in a component (`daysBetween(lastDate, today) <= 1`).** Screens format the summary; the rule lives in `currentDailyStreak`.
- **Counting a daily replay in the statistics "because it was played".** Spec S9: only the first completion counts.
- **Recording the daily under today's date when the run started yesterday.** Use `run.ref.date`.
- **Resetting the current win streak only on a lost level.** Any lost run (level, daily or endless) resets it.
- **Showing a wall of zeros to a new player.** `isEmpty` switches to the empty state.
- **Tweaking `dailySeed` "to spread seeds better".** The goldens are a contract with every installed copy.
- **`save.update((doc) => applyRunEnd(doc, end, today), ...)` straight from the game host.** The disk is right but the progress and stats stores keep the old sections, so Home and S10 show stale numbers until a restart; call `updateAndPublish` (state-stores' `check-stores` reports it as `cross-section-write`).
- **`86_400_000 - (clock.nowMs() % 86_400_000)` for "Next challenge in".** That is UTC midnight, hours off for most players; use `useNextDayCountdown()` (the port's `msUntilNextLocalDay()` knows the time zone and daylight saving).
- **Naming the pure summary `daily-view.ts` or `stats-view.ts`.** Those names belong to the screen components in the same folder; keep `daily-summary.ts` and `stats-summary.ts`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/daily-challenge.md](references/daily-challenge.md) | Daily rules, date keys, seed goldens, day boundaries, daily model, S9 summary and its screen mapping, the countdown gap, S9 / Home / result element tables, date formatting, open decisions | Workflow step 1, and before any daily change |
| [references/statistics.md](references/statistics.md) | Stats section, S10 number sources, recordFinishedRun, counters, run-end table, S10 summary and its screen mapping, element table, empty state, reset, checker rules | Workflow step 1, and before any stats or run-end change |
| `templates/packages/game-kit/src/dates/` | `date-key.ts`, `daily-seed.ts` and their test (goldens, 2,000-run round trip) | Workflow step 3 |
| `templates/packages/shell/src/stores/` | `daily-model.ts`, `stats-model.ts`, `run-end.ts` and their tests | Workflow steps 3 and 4 |
| `templates/packages/shell/src/app/use-today.ts` | Today read on every render, focus and foreground | Workflow step 3 |
| `templates/packages/shell/src/services/clock/` | `clock-port.ts` (with `msUntilNextLocalDay`), `system-clock-adapter.ts`, `fake-clock.ts` and their tests, synced from the library (do not edit here) | Workflow step 3 |
| `templates/packages/shell/src/screens/` | `daily/daily-summary.ts` (with `splitCountdown`), `daily/use-next-day-countdown.ts`, `stats/stats-summary.ts`, their hooks (`use-daily-summary.ts`, `use-stats-summary.ts`) and tests | Workflow steps 3 and 5 |
| [examples/stats-cards.ts](examples/stats-cards.ts) | S10 summary to stat-grid cells (testID, label key, value format) | Workflow step 5 |
| [examples/stats-cards.test.ts](examples/stats-cards.test.ts) | Its test | Workflow step 5 |
| `scripts/check-daily-stats.mjs` | Runs the app's date, seed, daily, stats, run-end and summary modules (countdown included) against the rules; scans for wall-clock reads, cached today, UI maths and a clock port without `msUntilNextLocalDay` | Workflow step 7, and at the end |
| `scripts/lib/daily-checks.mjs` | The daily rules and seed goldens the checker runs | When a daily rule changes |
| `scripts/lib/stats-checks.mjs` | The statistics, run-end and S10 rules the checker runs | When a stats rule changes |
| `scripts/lib/app-modules.mjs` | Imports the app's TypeScript modules (Node type stripping, `@e07/*` resolution) | Never by hand |
| `scripts/lib/fixture-tree.mjs` | Builds the self-test trees (templates, support files, one planted bug) | Never by hand |
| `scripts/selftest.mjs` | Proves the checker passes the templates and catches every planted bug | After changing the checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in (check-lib and the clock files) | When adding a shared file |
| `tests/fixtures/` | `good/`, `support/` (the progress reducer run-end imports), planted-bug `bad-*/` overlays, and `slice/` (shell-slice.json cases: summaries skipped outside the slice, required inside it) | When adding a checker rule |

## Related skills

- `state-stores` - the progress and stats stores, `updateAndPublish` and the progress reducer.
- `save-persistence-and-migrations` - the `daily` and `stats` sections and any change to their shape.
- `level-generation-and-solvers` - the generator that turns the daily seed into a level, and its goldens.
- `game-host-integration` - calling the run-end write and showing S7.
- `toybox-screens` - the S9 and S10 layouts, and `toybox-visual-parity` for the screenshot comparison.
- `i18n-strings-and-catalogs` - the date, duration and plural messages and digits.
