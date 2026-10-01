# S10 Statistics

S10 shows players their own history, stored only on the phone.

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

- Cards: Overview (games played, wins, win rate, total play time); Levels (levels completed, stars earned / total, 3-star levels); Best (best score per mode, best level result, longest win streak); Daily (challenges completed, current streak, best streak); Last 7 days (bar chart of games played per day, right to left in RTL); a game-specific card with 2–4 numbers the game defines; "Reset statistics" (with confirmation) at the bottom; banner at the bottom (same rules as Home).
- Every number uses the chosen digits; durations read "2 h 14 min", translated in full.
- Empty state for a new player: "Play a level to see your stats here", not a wall of zeros.

## Layout, top to bottom

Top bar "Statistics" with Back. Body gap **16**; each panel has a header (icon tile 34 with a 20 pt icon, or the logo tile 36, + heading 21, 12 below):

1. Overview (`stats`): 2-column grid (gap 14): games played, wins, win rate, total play time (`stats.duration`). Cells: value (`number` 30) over label (14 muted). The win-rate value is the bare percentage ("62%", the design's `N(0.62, '::percent')`), formatted by `model.formatPercent` (`createPercentFormatter(localeTag)` in the chosen digits) under the label `stats.overview.win-rate`; the sentence key `stats.win-rate` ("Win rate 62%") is not the cell's value.
2. Levels (`grid`): 3 columns (values 23, no wrap): completed, stars "28 / 270", three-star levels.
3. Best (the gold rating star, `'rating-star'`, the design's `star(true)`; not the ink `star-filled` icon): a stat list: the Bold sub-heading "Best score"; Levels, Daily and Endless (only games with Endless) values (22 display, end-aligned); best level score "Level 9: 2,310"; longest win streak. 2 pt rules between rows.
4. Daily challenge (`calendar`): 3 columns: completed, current streak, best streak.
5. Last 7 days (`stats`): subtitle "Games played per day" (14 muted) → bar chart (8 top margin): seven columns, 124 pt plot on a 3 pt baseline, value (13 Bold) over a 26 pt accent bar (height = value / max x 92, top radius 5), the day letter 6 below; zero days show only "0".
6. The game's panel: logo tile 36 + "{gameName} stats" → 3 columns of the game's own counters. A counter whose `aggregate` is `'max'` (a best-of, such as the biggest combo) reads as a multiplier, "×6" (`stats-snapshot-of.ts` prefixes ×); a running total (`'sum'`) is the plain number.

Then a danger block button with `trash`: "Reset statistics" → the local note: a row with a 24 pt `lock` icon, a 6 pt gap and "Stored only on this phone." (caption, muted); the element `stats.local-note` is the whole row, padlock included (`StatsLocalNote hasIcon`) → the banner, pinned under the scroll. With a banner slot the body ends one block gap above the band (`ScreenBody isAboveBanner`: `paddingBottom` is the body's gap, as the design's band is the body's last flex item); without one (Premium) the body runs under the home indicator.

## States and variants

- **Normal** (`s10-statistics.png`, a tall frame; the app scrolls).
- **Empty** (`s10-statistics-empty.png`): top bar, then the empty state (column centred vertically, start-aligned, gap 14; the page keeps the default 14 pt body gap, not the panels page's 16): the boxed-star picture (190 x 150, drawn in code), "No stats yet" (`title` 30), the lead, a hero key with a `play` cap "Play a level", the local note as the bare caption (no padlock, `StatsLocalNote` without `hasIcon`); and the banner.

## Data the model supplies

`StatsModel` (`stats-model.ts`): `isEmpty`, `snapshot` (every number above, `week`, `gameStats` with kebab keys), `gameName`, `formatNumber` (chosen digits), `isReducedMotion`, `banner`, `onBack`, `onReset` (opens the reset-statistics dialog), `onPlay`. `logo` (the game's LogoArt for the game panel's 36 pt tile). `stats-cells.ts` turns the snapshot into cells and rows whose `id` is the last segment of the design testID; `StatGrid` / `StatList` get the panel id as `testIDBase` and derive `<panel>.<id>` with `.value` and `.label` (StatList also `.list`). `WeekBars` gets `barTestIDBase="stats.week-bar"` and numbers the seven bars by position (7 = today). The empty state is the Toybox `EmptyState` (`testIDBase="stats.empty-state"` derives `.picture`, `.title`, `.body`; the hero key is its `action`, the local note its `footer`). daily-and-statistics owns the numbers.

`snapshot.bestLevelScore` is `{ level, score }` or `null` until a level is won (the save's best level is empty then): the "Best level score" row is left out, never shown as "Level 0: 0" (Chosen), the same way the Endless row is left out for games without Endless.

The template `use-stats-model.ts` (with its test) builds it: `useStatsSummary({ levelCount: levelCountOf(useGameExtra()), hasEndless: extra.modes.endless, counterIds: host.counterIds })` (daily-and-statistics), turned into the snapshot by the pure `stats-snapshot-of.ts` (with its test): the game's own counters in game order from `useGameHost().counters` (save key and label key: the label is `gameMessageText(t, { id: labelId })`, the value in the chosen digits), the week letters and names from the Shell date formatter, and `bestLevelScore` null until a level is won. `onReset` opens the reset-statistics dialog with `useSettingsResets().onConfirmResetStats`; `onPlay` is Home's Play key (`useLevelPlay()`); the banner comes from `useBannerSlot('stats')`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/stats/`.

- `packages/shell/src/screens/stats/stats-model.ts`
- `packages/shell/src/screens/stats/stat-panel.tsx`
- `packages/shell/src/screens/stats/stats-cells.ts`
- `packages/shell/src/screens/stats/stats-empty-state.tsx`
- `packages/shell/src/screens/stats/stats-local-note.tsx`
- `packages/shell/src/screens/stats/stats-panels.tsx`
- `packages/shell/src/screens/stats/stats-view.tsx`
- `packages/shell/src/screens/stats/stats-screen.tsx`
- `packages/shell/src/screens/stats/stats-view.test.tsx`
- `packages/shell/src/screens/stats/stats-snapshot-of.ts`, `use-stats-model.ts` and their tests

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S10` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `stats.screen` | ScreenFrame | none |  |  |  |
| `stats.top-bar` | TopBar | none |  |  | .back-button .title |
| `stats.overview-card` | Panel | none |  | normal |  |
| `stats.overview-card.icon` | IconTile (pop 34, stats) | none |  | normal |  |
| `stats.overview-card.title` | AppText | header | `stats.overview.title` | normal |  |
| `stats.overview-card.games-played` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.overview-card.wins` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.overview-card.win-rate` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.overview-card.play-time` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.levels-card` | Panel | none |  | normal |  |
| `stats.levels-card.icon` | IconTile (pop 34, grid) | none |  | normal |  |
| `stats.levels-card.title` | AppText | header | `common.levels` | normal |  |
| `stats.levels-card.completed` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.levels-card.stars` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.levels-card.three-star` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.best-card` | Panel | none |  | normal |  |
| `stats.best-card.icon` | IconTile (pop 34, filled star) | none |  | normal |  |
| `stats.best-card.title` | AppText | header | `stats.best.title` | normal |  |
| `stats.best-card.list` | StatList | none |  | normal | (drawn by StatList from its `testIDBase`) |
| `stats.best-card.score-heading` | AppText | header | `stats.best.score` | normal |  |
| `stats.best-card.levels` | StatList | none |  | normal | .label .value (drawn by StatList from its `testIDBase`) |
| `stats.best-card.daily` | StatList | none |  | normal | .label .value (drawn by StatList from its `testIDBase`) |
| `stats.best-card.endless` | StatList | none |  | normal; endless | .label .value (drawn by StatList from its `testIDBase`) |
| `stats.best-card.level-score` | StatList | none |  | normal | .label .value (drawn by StatList from its `testIDBase`) |
| `stats.best-card.win-streak` | StatList | none |  | normal | .label .value (drawn by StatList from its `testIDBase`) |
| `stats.daily-card` | Panel | none |  | normal |  |
| `stats.daily-card.icon` | IconTile (pop 34, calendar) | none |  | normal |  |
| `stats.daily-card.title` | AppText | header | `daily.title` | normal |  |
| `stats.daily-card.completed` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.daily-card.current-streak` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.daily-card.best-streak` | StatGrid | none |  | normal | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.week-card` | Panel | none |  | normal |  |
| `stats.week-card.icon` | IconTile (pop 34, stats) | none |  | normal |  |
| `stats.week-card.title` | AppText | header | `daily.week.title` | normal |  |
| `stats.week-card.subtitle` | AppText | text | `stats.week.subtitle` | normal |  |
| `stats.week-card.chart` | WeekBars | none |  | normal |  |
| `stats.week-bar.<n>` (x7) | WeekBars | image | a11y `stats.week.bar.a11y-label` | normal | (drawn by WeekBars from its `barTestIDBase`) |
| `stats.week-bar.<n>.value` (x7) | AppText | text |  | normal | (drawn by WeekBars from its `barTestIDBase`) |
| `stats.week-bar.<n>.day` (x7) | AppText | text | `date.weekday-strip.1`; `date.weekday-strip.2`; `date.weekday-strip.3`; `date.weekday-strip.4`; `date.weekday-strip.5`; `date.weekday-strip.6`; `date.weekday-strip.7` | normal | (drawn by WeekBars from its `barTestIDBase`) |
| `stats.week-bar.<n>.bar` (x6) | View | none |  | normal | (drawn by WeekBars from its `barTestIDBase`) |
| `stats.game-card` | Panel | none |  | normal |  |
| `stats.game-card.logo` | LogoTile (36) | none |  | normal |  |
| `stats.game-card.title` | AppText | header | `stats.game.title` | normal |  |
| `stats.game-card.monsters-defeated` | StatGrid | none |  | normal; game:lineSiege | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.game-card.beams-fired` | StatGrid | none |  | normal; game:lineSiege | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.game-card.biggest-combo` | StatGrid | none |  | normal; game:lineSiege | .value .label (drawn by StatGrid from its `testIDBase`) |
| `stats.reset-button` | Button (danger block, trash icon) | button | `stats.reset-button` | normal |  |
| `stats.local-note` | AppText | text | `stats.local-note` |  |  |
| `stats.local-note.icon` | Icon (lock) | none |  | normal |  |
| `stats.empty-state` | View | none |  | empty |  |
| `stats.empty-state.picture` | Picture (190 x 150) | none |  | empty |  |
| `stats.empty-state.title` | AppText | header | `stats.empty.title` | empty |  |
| `stats.empty-state.body` | AppText | text | `stats.empty.body` | empty |  |
| `stats.play-button` | Button (primary hero, play cap) | button | `stats.empty.play-button` | empty |  |
| `stats.banner-ad` | AdBannerSlot | none |  |  |  |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `common.statistics` | Statistics |
| `stats.overview.title` | Overview |
| `stats.overview.games-played` | Games played |
| `stats.overview.wins` | Wins |
| `stats.overview.win-rate` | Win rate |
| `stats.duration` | {hours, plural, one {# h} other {# h}} {minutes, plural, one {# min} other {# min}} |
| `stats.overview.play-time` | Total play time |
| `common.levels` | Levels |
| `stats.levels.completed` | Levels completed |
| `stats.levels.stars-value` | {earned, number} / {total, number} |
| `stats.levels.stars` | Stars earned |
| `stats.levels.three-star` | Three-star levels |
| `stats.best.title` | Best |
| `stats.best.score` | Best score |
| `common.mode.daily` | Daily |
| `common.mode.endless` | Endless |
| `stats.best.level-score` | Best level score |
| `stats.best.level-score-value` | Level {level, number}: {score, number} |
| `stats.best.win-streak` | Longest win streak |
| `daily.title` | Daily challenge |
| `stats.daily.completed` | Challenges completed |
| `daily.streak.days` | {daysCount, plural, one {# day} other {# days}} |
| `daily.streak.current` | Current streak |
| `daily.streak.best` | Best streak |
| `daily.week.title` | {daysCount, plural, one {Last day} other {Last # days}} |
| `stats.week.subtitle` | Games played per day |
| `stats.week.bar.a11y-label` | {weekdayName}: {gamesCount, plural, one {# game} other {# games}} |
| `date.weekday-strip.1` | Mon |
| `date.weekday-strip.2` | Tue |
| `date.weekday-strip.3` | Wed |
| `date.weekday-strip.4` | Thu |
| `date.weekday-strip.5` | Fri |
| `date.weekday-strip.6` | Sat |
| `date.weekday-strip.7` | Sun |
| `stats.game.title` | {gameName} stats |
| `games.<id>.stats.monstersDefeated` | (the game's own text) |
| `games.<id>.stats.beamsFired` | (the game's own text) |
| `games.<id>.stats.biggestCombo` | (the game's own text) |
| `stats.reset-button` | Reset statistics |
| `stats.local-note` | Stored only on this phone. |
| `stats.empty.title` | No stats yet |
| `stats.empty.body` | Play a level to see your stats here. |
| `stats.empty.play-button` | Play a level |

## Reference images

- `assets/reference/s10-statistics.png` (normal; phone-tall)
- `assets/reference/s10-statistics-empty.png` (empty; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A wall of zeros for a new player.
- Latin digits in fa/ckb, or "2h14m" instead of the translated duration.
- The game card's stat keys in camelCase: testIDs are kebab-case (`stats.game-card.monsters-defeated`).
