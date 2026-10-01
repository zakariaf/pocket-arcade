# S9 Daily challenge

S9 is one special level per day, the same for every player, generated from the date on the phone.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- Reference images
- Pitfalls

## What the product requires

- Shows today's challenge (Play, or your result), the current streak and best streak, and the last 7 days as a strip of marks (done / missed), mirrored in RTL.
- The first completion of the day counts for the streak and statistics; replays are allowed for fun but do not change the day's result.
- The day changes at local midnight; if the clock goes backwards, days already done stay done.
- Streaks follow "played yesterday or today"; no streak insurance and no paid repair.
- No banner.

## Layout, top to bottom

Top bar "Daily challenge" with Back. Body (gap 14):

1. Today panel (row, centred, gap 18): calendar tile (88 wide, radius 12, tilted -3 deg: accent month band over the day number 42) → column (start-aligned, gap 8): chip "Today" and heading 21 with the date.
2. Hero key with a `play` cap: "Play today's challenge".
3. Two streak panels in two columns (gap 12; padding 12 x 14, gap 4): current (18 pt `chain`, "Current streak", "5 days" in `streakValue` 28) and best (filled star, "Best streak"). Each label line is a row View holding the icon and the text, and the line View carries the testID (`daily.current-streak-card.label`, `daily.best-streak-card.label`): the design's label box is the whole line, icon included. An id on the text alone measures a box 24 pt narrower and moved.
4. Rule line (row, gap 8, 15 muted, `chain` 20): "Play every day to grow your streak." The row View carries `daily.streak-rule` (the whole line, icon included), as the design draws it.
5. Week panel: heading 21 "Last 7 days" → the week strip (12 pt top margin): seven equal columns (gap 4), each with the weekday letter (13 Bold muted), a 38 pt mark (done = accent + check, missed = dashed muted + cross, today = dashed + play) and, under today, the gold "Today" tag (11 Bold, tilt -4 deg) → legend (wrap row, gap 8 x 18, 14 top margin): 22 pt marks with "Done" and "Missed".

## States and variants

- **Before today's game** (`s9-daily-challenge.png`).
- **After today's game** (Chosen, not drawn): the hero key becomes a secondary block "Play again for fun" (`daily.replay-button`) with the caption "Replays don't change today's result." (`daily.replay-note`); the today panel adds "Your score today: 1,840" (`daily.today-card.score`) and "Next challenge in 3 h 5 min" (`daily.today-card.next-in`); today's mark turns done.
- The strip and the legend run right to left in fa/ckb (Monday on the right).
- React Native draws a dashed edge (the missed and today marks, the legend's missed swatch) with its own dash length and phase. Visual parity pre-lists those S9 elements as platform waivers of the `structure` check; nothing here re-draws them.

## Data the model supplies

`DailyModel` (`daily-model.ts`): `monthText`, `dayText`, `dateText` (Shell date formatter), `todayResult` (score, hours, minutes to midnight, or null), `currentStreak`, `bestStreak`, `week` (exactly seven `WeekDayModel`, oldest first, today last: letter, weekday name, state, isToday; WeekStrip numbers the columns 1–7 by position, so `daily.week-day.7` is always today), `isReducedMotion`, `onBack`, `onPlay`, `onReplay`. daily-and-statistics owns the streak rules and the date → seed contract.

`use-daily-model.ts` ships whole (with its test): `useDailySummary()` and `useNextDayCountdown()` (daily-and-statistics; the countdown is read on every render, so it keeps ticking after today's game), the date texts from the i18n skill's `format-date.ts` (`formatMonthShort`, `formatWeekdayDayMonth`, `formatWeekdayLetter`, `formatWeekdayName`; never `Date` or `Intl.DateTimeFormat` in a screen), the day number in the chosen digits, and `navigate('Game', { start: 'new', ref: { kind: 'daily', date: today } })` for Play and Replay (the first finished attempt of the day counts; the game host keeps it).

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/daily/`.

- `packages/shell/src/screens/daily/daily-model.ts`
- `packages/shell/src/screens/daily/use-daily-model.ts`
- `packages/shell/src/screens/daily/use-daily-model.test.tsx`
- `packages/shell/src/screens/daily/daily-today-card.tsx`
- `packages/shell/src/screens/daily/daily-view.tsx`
- `packages/shell/src/screens/daily/daily-week-card.tsx`
- `packages/shell/src/screens/daily/streak-card.tsx`
- `packages/shell/src/screens/daily/daily-screen.tsx`
- `packages/shell/src/screens/daily/daily-view.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S9` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `daily.screen` | ScreenFrame | none |  |  |  |
| `daily.top-bar` | TopBar | none |  |  | .back-button .title |
| `daily.today-card` | Panel | none |  |  |  |
| `daily.today-card.calendar` | CalendarTile (88 wide, -3 deg) | none |  |  | .month .day |
| `daily.today-card.today-chip` | Chip | text | `daily.today.label` |  |  |
| `daily.today-card.date` | AppText | header | `date.weekday-day-month` |  |  |
| `daily.play-button` | Button (primary hero, play cap) | button | `daily.today.play-button` |  |  |
| `daily.current-streak-card` | Panel | none |  |  |  |
| `daily.current-streak-card.icon` | Icon (chain 18) | none |  |  |  |
| `daily.current-streak-card.label` | AppText | text | `daily.streak.current` |  |  |
| `daily.current-streak-card.value` | AppText | text | `daily.streak.days` |  |  |
| `daily.best-streak-card` | Panel | none |  |  |  |
| `daily.best-streak-card.icon` | RatingStars (filled star 18) | none |  |  |  |
| `daily.best-streak-card.label` | AppText | text | `daily.streak.best` |  |  |
| `daily.best-streak-card.value` | AppText | text | `daily.streak.days` |  |  |
| `daily.streak-rule` | AppText | text | `daily.streak.rule` |  |  |
| `daily.streak-rule.icon` | Icon (chain 20) | none |  |  |  |
| `daily.week-card` | Panel | none |  |  |  |
| `daily.week-card.title` | AppText | header | `daily.week.title` |  |  |
| `daily.week-strip` | WeekStrip | none |  |  |  |
| `daily.week-day.<n>` (x7) | View | none |  |  | (drawn by WeekStrip from `dayTestIDBase="daily.week-day"`) |
| `daily.week-day.<n>.letter` (x7) | AppText | text | `date.weekday-strip.1`; `date.weekday-strip.2`; `date.weekday-strip.3`; `date.weekday-strip.4`; `date.weekday-strip.5`; `date.weekday-strip.6`; `date.weekday-strip.7` |  | (drawn by WeekStrip from `dayTestIDBase="daily.week-day"`) |
| `daily.week-day.<n>.mark` (x7) | WeekStrip (day mark 38) | image | a11y `daily.week.day-missed.a11y-label`; a11y `daily.week.day-done.a11y-label`; a11y `daily.today.label` |  | (drawn by WeekStrip from `dayTestIDBase="daily.week-day"`) |
| `daily.week-day.<n>.today-tag` | Sticker (Today tag, -4 deg) | text | `daily.today.label` |  | (drawn by WeekStrip from `dayTestIDBase="daily.week-day"`) |
| `daily.week-card.legend` | View | none |  |  |  |
| `daily.week-card.legend.done` | AppText | text | `daily.week.done` |  |  |
| `daily.week-card.legend.missed` | AppText | text | `daily.week.missed` |  |  |

Chosen states the design does not draw may also set: `daily.replay-button`, `daily.replay-note`, `daily.today-card.score`, `daily.today-card.next-in`.

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `daily.title` | Daily challenge |
| `date.month-short.9` | Sep |
| `daily.today.label` | Today |
| `date.weekday-day-month` | {weekdayName}, {day, number} {monthName} |
| `daily.today.play-button` | Play today’s challenge |
| `daily.streak.current` | Current streak |
| `daily.streak.days` | {daysCount, plural, one {# day} other {# days}} |
| `daily.streak.best` | Best streak |
| `daily.streak.rule` | Play every day to grow your streak. |
| `daily.week.title` | {daysCount, plural, one {Last day} other {Last # days}} |
| `date.weekday-strip.1` | Mon |
| `daily.week.day-missed.a11y-label` | {weekdayName}: missed |
| `date.weekday-strip.2` | Tue |
| `daily.week.day-done.a11y-label` | {weekdayName}: done |
| `date.weekday-strip.3` | Wed |
| `date.weekday-strip.4` | Thu |
| `date.weekday-strip.5` | Fri |
| `date.weekday-strip.6` | Sat |
| `date.weekday-strip.7` | Sun |
| `daily.week.done` | Done |
| `daily.week.missed` | Missed |

## Reference images

- `assets/reference/s9-daily-challenge.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Colour-only week marks: done, missed and today differ by icon and edge too.
- Formatting dates with `toLocaleDateString` or `Intl.DateTimeFormat`: use the Shell date formatter.
- A banner on S9.
- A testID on the label text instead of its line (streak cards, the streak rule): the design's box includes the icon.
