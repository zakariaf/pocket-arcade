# The daily challenge, end to end

One special level per day, the same for every player in the world with no server: the date picks the seed, the first finished attempt of the day counts, streaks follow "played yesterday or today". This file holds the product rules, the pure calendar and seed code, the daily model, the S9 summary, and the map from each S9, Home and result element to the data behind it. `scripts/check-daily-stats.mjs` runs the app's own modules against every rule here.

## Contents

- Product rules
- Date keys: calendar maths without Date
- The daily seed: a compatibility contract
- Starting the daily run
- Day boundaries: "today" is read, never cached
- The daily section and its model
- Decisions inside the spec's rules
- The S9 summary (the data behind the screen)
- The "Next challenge in" countdown
- S9 elements and their data
- The Home daily card and the daily result
- Formatting dates and numbers
- Open owner decisions

## Product rules

- S9: "One special level per day. It is the same level for every player in the world, with no server needed." The level is generated from today's date on the phone.
- S9 shows today's challenge (Play, or your result), the current streak and best streak, and the last 7 days as a strip of marks (done / missed), mirrored in RTL.
- "The first completion of the day counts for the streak and statistics. Replays are allowed for fun, but don't change the day's result."
- "The day changes at local midnight."
- "If the phone's clock goes backwards, days that were already done stay done, and nothing crashes or double-counts."
- "Streaks follow the plain rule 'played yesterday or today'. There is no streak insurance and no paid streak repair."
- 8.3: the level comes from today's local date plus the game's own salt, run through the same generator as normal levels at a medium difficulty; every phone gets the same level on the same date; past days cannot be replayed for streaks (no archive in v1).
- S4 Home daily card: today's date in the chosen language and digits, "Play today's challenge" or "Done - come back tomorrow", and the current daily streak. The card's body opens S9 Daily challenge (also once today is done); its Play key starts today's run (the lead's decision L7, 2026-09-30).
- S7 in Daily mode: today's result, streak and "Come back tomorrow". Stars and statistics are saved BEFORE the result screen appears.

## Date keys: calendar maths without Date

Days are local calendar dates as `'YYYY-MM-DD'` strings (`DateKey`) from `ClockPort.today()`. All arithmetic is integer maths (H. Hinnant's `days_from_civil` / `civil_from_days`), so the same code runs in Jest, Hermes and tooling and never depends on a time zone.

```ts
// packages/game-kit/src/dates/date-key.ts
export type DateKey = string;
dayNumber(key)          // days since 1970-01-01; NaN unless the key is 'YYYY-MM-DD'
fromDayNumber(days)     // the inverse
addDays(key, days)      // fromDayNumber(dayNumber(key) + days)
daysBetween(a, b)       // b - a in whole days
isoWeekday(key)         // 1 = Monday ... 7 = Sunday ((dayNumber + 3) mod 7, + 1; day 0 was a Thursday)
```

Pinned facts the tests and the checker use: `dayNumber('1970-01-01') = 0`, `dayNumber('2026-09-26') = 20722`, `addDays('2026-02-28', 1) = '2026-03-01'`, `addDays('2028-02-28', 1) = '2028-02-29'`, `addDays('2100-02-28', 1) = '2100-03-01'`, `addDays('2000-02-28', 1) = '2000-02-29'`, `daysBetween('2026-12-31', '2027-01-01') = 1`, `isoWeekday('2026-09-26') = 6` (Saturday), and a round trip of every day number from 1900 to 2400.

Only `services/clock/system-clock-adapter.ts` reads `Date` (the local `getFullYear/getMonth/getDate`, zero-padded). Test builds offset it so the debug menu can "set the date" to test streaks.

The clock port (template `services/clock/clock-port.ts`, identical in every skill that ships it) has three members:

```ts
export type ClockPort = {
  readonly nowMs: () => number;               // epoch ms: records, ad spacing, play time; never rules
  readonly today: () => DateKey;              // local 'YYYY-MM-DD'; changes at local midnight
  readonly msUntilNextLocalDay: () => number; // 1 .. one local day (up to 25 h when clocks fall back)
};
```

- `system-clock-adapter.ts` computes `msUntilNextLocalDay` as `new Date(y, m, d + 1) - now`: the Date constructor applies the time zone and daylight saving, and a midnight that does not exist (clocks jump at 00:00) moves to the first valid time, which is exactly when `today()` changes. Its test proves "today() is unchanged 1 ms before the countdown ends and is the next day when it ends" with Jest fake timers, so it holds in any time zone (checked in UTC, Sao Paulo, Tehran, Chatham, Havana and Lord Howe).
- `fake-clock.ts` (`createFakeClock({ nowMs, today, msUntilNextLocalDay? })`, default 12 h) keeps the three values consistent: `advance(ms)` moves time and rolls `today()` over at midnight, a negative `advance` is the phone clock going back, and `setToday(day)` jumps days (streak tests, the S15 set-date switch). Tests use it instead of hand-written clock objects.
- The test build's set-date wrapper changes `today()` only; it keeps `nowMs()` and `msUntilNextLocalDay()` from the real clock (e2e-maestro's `SimulatedClock`, `packages/shell/src/screens/debug/simulated-clock.ts`, which the composition root wraps around the system clock in test builds; the debug link's `date=YYYY-MM-DD` sets it).

## The daily seed: a compatibility contract

```ts
// packages/game-kit/src/dates/daily-seed.ts
export function dailySeed(date: DateKey, salt: number): number {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (let index = 0; index < date.length; index += 1) {
    hash = Math.imul(hash ^ date.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash;   // uint32
}
```

| `dailySeed(date, salt)` | Golden value |
|---|---|
| `('2026-09-26', 17)` | `2599028541` |
| `('2026-09-27', 17)` | `2582250922` |
| `('2027-01-01', 17)` | `2349681313` |
| `('2026-09-26', 0)` | `2362601272` |
| `('2028-02-29', 4242)` | `773016242` |

These values are a hard contract: changing the function (or a game's salt) gives players different daily levels between app versions and breaks "same level for every player". The goldens live in `date-key.test.ts`, the checker repeats them (`seed-golden`), and a change to either needs the owner's approval and a `Gate-Change:` commit trailer. The generated daily level for fixed dates is pinned by the game's own level goldens (level-generation work).

## Starting the daily run

```ts
const today = clock.today();
const seed = dailySeed(today, game.levels.daily.salt);          // levels.daily: { kind: 'daily', difficulty, salt }
startGameSession(rules, { ref: { kind: 'daily', date: today }, seed, difficulty: game.levels.daily.difficulty });
```

A game with `levels.daily.kind === 'none'` shows no daily card and no Daily route entry. The run keeps the date it started with in `run.ref.date`, so finishing after midnight records the result under the day it was played.

## Day boundaries: "today" is read, never cached

`useToday()` (template `app/use-today.ts`) returns `clock.today()` on every render, re-renders when the screen gains focus (`useIsFocused`) and when the app comes back to the foreground (`AppState` through `useSyncExternalStore`). Never keep today in `useState`, `useRef` or a module constant; `check-daily-stats` reports it (`today-cached`). Handlers read `clock.today()` again when they run.

## The daily section and its model

```ts
// the save section (valibot, strict)
daily: {
  results: Record<DateKey, { won: boolean; score: number; moves: number; playMs: number }>, // pruned to 60 days
  completed: number,                                   // days ever recorded
  streak: { lastDate: DateKey | null; length: number },
  bestStreak: number,
}
```

```ts
// packages/shell/src/stores/daily-model.ts (pure)
recordDailyResult(daily, date, result)   // the FIRST finished attempt of `date` counts; a replay returns `daily` itself
currentDailyStreak(daily, today)         // streak.length if lastDate is today or yesterday, else 0
isDailyDone(daily, today)                // today in results
lastSevenDays(daily, today)              // [{ date, isDone }] for today-6 ... today, oldest first
DAILY_KEEP_DAYS = 60
```

`recordDailyResult` rules:

- `date in results`: return the same object (replay; nothing changes, not even statistics).
- Next streak: no `lastDate` gives `{ lastDate: date, length: 1 }`; a gap of 1 day gives `length + 1`; a gap over 1 gives a new streak of 1; a gap of 0 or less (same day, or the clock went backwards) leaves the streak unchanged.
- `completed + 1`, `bestStreak = max(bestStreak, streak.length)`, and results older than 60 days before the streak's `lastDate` are pruned.

## Decisions inside the spec's rules

- **Completion is the first finished attempt, won or lost.** A lost daily still ends the day's attempt ("replays don't change the day's result") and counts as "played" for the streak. The day's result stores `won`, so a card can show how many were won.
- **The streak is stored incrementally** (`lastDate`, `length`), so results can be pruned without shortening a 400-day streak; `completed` is stored for the same reason (S10 "Challenges completed" would otherwise stop at 60).
- **Clock backwards:** a date already recorded stays done; a new earlier date is recorded but leaves the streak untouched; nothing throws and nothing is counted twice.
- **No archive:** only the run's own `ref.date` is ever recorded; there is no way to play a past day.

## The S9 summary (the data behind the screen)

```ts
// packages/shell/src/screens/daily/daily-summary.ts (pure)
buildDailySummary(daily, today): DailySummary
// { today, isDone, todayResult: DailyResult | null, currentStreak, bestStreak,
//   week: [{ date, weekday /* ISO 1..7 */, mark: 'done' | 'missed' | 'today', isToday }] /* 7, oldest first */ }
// packages/shell/src/screens/daily/use-daily-summary.ts
useDailySummary(): DailySummary   // useToday() + useProgressStore(selectDaily) + buildDailySummary
```

Marks: `done` for a recorded day (today included once played), `today` for an unplayed today, `missed` otherwise. The strip is a `flexDirection: 'row'` list, so RTL mirrors it with no extra code. Screens only format this summary; `check-daily-stats` reports streak or date maths in the daily, stats and home screens (`day-maths-in-ui`).

The names are `…-summary.ts` on purpose: the screen files are `daily-view.tsx` (the `DailyView` component), `daily-model.ts` (`DailyModel`, what the view draws) and `use-daily-model.ts` in the same folder. `use-daily-model.ts` builds the `DailyModel` from `useDailySummary()`, the catalogs and the chosen digits:

| `DailyModel` field (screen) | From the summary |
|---|---|
| `monthText`, `dayText`, `dateText` | `summary.today` through the catalogs (`date.month-short.<m>`, the day number in the chosen digits, `date.weekday-day-month` with `date.weekday.<isoWeekday(today)>`) |
| `todayResult` (`score`, `hours`, `minutes`) | `const countdown = useNextDayCountdown()` on every render (a hook never sits behind a condition), then `summary.todayResult === null ? null : { score: summary.todayResult.score, ...countdown }` (the countdown below) |
| `currentStreak`, `bestStreak` | `summary.currentStreak`, `summary.bestStreak` |
| `week[i]` (`letter`, `weekdayName`, `state`, `isToday`; the strip numbers the columns by position) | `summary.week[i]`: `date.weekday-strip.<weekday>`, `date.weekday.<weekday>`, `mark`, `isToday` |

## The "Next challenge in" countdown

S9 shows `daily.next-in` ("Next challenge in {hours} h {minutes} min") after today's game (not drawn in the design). The time left is the time to the player's local midnight, which only the clock adapter can know (time zone, daylight saving), so it comes from `ClockPort.msUntilNextLocalDay()`:

```ts
// packages/shell/src/screens/daily/daily-summary.ts (pure)
splitCountdown(ms): Countdown   // { hours, minutes }; minutes rounded UP: 11_100_000 -> 3 h 5 min,
                                // 30_000 -> 0 h 1 min (never "0 h 0 min" before midnight)
// packages/shell/src/screens/daily/use-next-day-countdown.ts
useNextDayCountdown(): Countdown // useSyncExternalStore over a 15 s interval and AppState changes;
                                 // the snapshot is whole minutes, so it re-renders once a minute
```

- The screen's `use-daily-model.ts` calls `useNextDayCountdown()` on every render and fills `todayResult.hours` and `.minutes` from it only when `summary.todayResult !== null`; `daily-view.tsx` formats them with the catalog message (digits from the chosen numbering system).
- When the countdown reaches midnight, `useToday()` gives the new day on the next render (AppState or focus), `summary.isDone` turns false and the line disappears with the play button back.
- Never compute it in a screen: `new Date()` is banned there (`wall-clock`), and `86_400_000 - nowMs() % 86_400_000` is UTC midnight, not the player's (`day-maths-in-ui` reports `nowMs()`, `msUntilNextLocalDay()` and `86_400_000` in daily, stats and home screens; only `use-next-day-countdown.ts` reads the port).
- `check-daily-stats` runs `splitCountdown` (`view-countdown`) and fails when `clock-port.ts`, the system adapter or the fake lacks `msUntilNextLocalDay` (`clock-countdown`).

## S9 elements and their data

| testID | Copy key or value | From |
|---|---|---|
| `daily.top-bar.title` | `daily.title` | |
| `daily.today-card.calendar.month` / `.day` | `date.month-short.<m>` / the day number | `summary.today` |
| `daily.today-card.today-chip` | `daily.today.label` | |
| `daily.today-card.date` | `date.weekday-day-month` (`weekdayName` = `date.weekday.<isoWeekday>`, `day`, `monthName`) | `summary.today` |
| `daily.play-button` | `daily.today.play-button` (hero key, play cap) | shown while `!summary.isDone` |
| `daily.replay-button` (after today's game; chosen, not drawn) | `daily.today.replay-button` (secondary block), caption `daily.replay-note` | shown when `summary.isDone` |
| `daily.today-card.score` (after today's game) | `daily.today.score` (`score`) | `summary.todayResult.score` |
| `daily.today-card.next-in` (after today's game) | `daily.next-in` (`hours`, `minutes`) | `useNextDayCountdown()` (the countdown above) |
| `daily.current-streak-card.value` | `daily.streak.days` (`daysCount`) | `summary.currentStreak` |
| `daily.best-streak-card.value` | `daily.streak.days` | `summary.bestStreak` |
| `daily.streak-rule` | `daily.streak.rule` | |
| `daily.week-card.title` | `daily.week.title` (`daysCount: 7`) | |
| `daily.week-day.<n>` (`.letter`, `.mark`); `<n>` is the position, 1 = the oldest day, 7 = today | letter `date.weekday-strip.<weekday>` (the day's ISO weekday); mark a11y `daily.week.day-done.a11y-label` / `daily.week.day-missed.a11y-label` / `daily.today.label` | `summary.week[i]` |
| `daily.week-day.7.today-tag` | `daily.today.label` sticker | `isToday` (always the last column) |
| `daily.week-card.legend.done` / `.missed` | `daily.week.done` / `daily.week.missed` | |

The week strip is the one numbered series of the screen: its columns are numbered by position (`daily.week-day.1` is today minus 6 days, `daily.week-day.7` is today), and the strip component numbers them itself. The letter and the VoiceOver name come from each day's ISO weekday (`summary.week[i].weekday`), so on a Saturday column 1 reads "Sun". The design screenshot shows a Sunday (columns 1..7 = Monday..Sunday, today is 7, Monday missed, Tuesday to Saturday done); to compare the built screen with it, set the debug date to a Sunday and seed five done days.

## The Home daily card and the daily result

- Home (`home.daily-card`): title `home.daily-card.title` (`daily.title`), date `home.daily-card.date` (`date.weekday-day-month` from `summary.today`), streak sticker `home.daily-card.streak` (`daily.streak.count`, `daysCount` = `summary.currentStreak`; `=0` reads "No streak yet"), button `home.daily-card.play-button` (`daily.today.play-button`); once `summary.isDone` the button becomes the row `home.daily-card.done` with a success check and `daily.today.done` (chosen; not drawn).
- Two controls on the Home card (L7): the card body (`home.daily-card`, a pressable surface under the card's content, labelled with the title, date and streak) opens S9 with `navigate('Daily')` in every state, done or not; the Play key (`home.daily-card.play-button`), its own button beside the surface, starts today's run with `navigate('Game', { start: 'new', ref: { kind: 'daily', date: summary.today } })`, the same run S9's Play key starts. The first finished attempt of the day counts either way. The pixels are the design's flat panel; toybox-screens' s04-home.md shows how the card is drawn, and E2E journey 02 taps the card to open S9.
- Daily result (S7 layout without the stars row; chosen): chip `game-screen.mode.daily`, title `result.daily-title` (`result.daily.title`), the gold streak sticker `daily.streak.count`, the score panel, caption `result.daily.come-back`, hero key Home. It reads the same `useDailySummary()` after the run-end write.
- Game top bar in a daily run: `game-screen.mode.daily` with `dateText` = `date.day-month` of `run.ref.date`.

## Formatting dates and numbers

- Never `Intl.DateTimeFormat`, `Date#toLocale*String` or ICU `{x, date}`: on iOS Hermes `DateTimeFormat('fa')` gives the Solar Hijri date and ignores the digit choice, while the daily challenge is keyed by the Gregorian local date. Month and weekday names come from the catalogs (`date.month-short.1..12`, `date.weekday.1..7`, `date.weekday-strip.1..7`), and the i18n layer's `formatDayMonth(dateKey, t)` builds `date.day-month`. `check-daily-stats` reports `Date`, `Intl.DateTimeFormat` and `toLocale*` in daily and statistics code (`wall-clock`).
- Every number uses the chosen digits (Latin or local) through the i18n number formatter; the summary holds plain numbers only.

## Open owner decisions

- A lost first attempt counts as the day played (default). If the owner wants only wins to count for streaks, change the run-end caller (`applyRunEnd`), not the model, and ask first.
- The design does not draw S9 after today's game; the layout above is the chosen default.
- Settled: Home reaches S9 through the daily card's body, and its Play key plays today's run (the lead's decision L7, 2026-09-30).
