# Data displays

The Daily, Statistics, Result and How-to-play parts: calendar tile, week strip and legend, stat grid and list, score panel, week bars, how-to stage, pager dots and the empty state. All are flat Views; values arrive already formatted in the chosen digits, labels already translated.

## Contents

1. [Calendar tile (4.26)](#calendar-tile-426)
2. [Week strip, week mark and legend (4.27)](#week-strip-week-mark-and-legend-427)
3. [Stat grid and stat list (4.28)](#stat-grid-and-stat-list-428)
4. [Score panel (4.29)](#score-panel-429)
5. [Week bars (4.29)](#week-bars-429)
6. [How-to stage and pager dots (4.30)](#how-to-stage-and-pager-dots-430)
7. [Empty state (4.31)](#empty-state-431)
8. [Mock-only parts](#mock-only-parts)

## Calendar tile (4.26)

**Template:** `calendar-tile.tsx` (`CalendarTile`: `monthText`, `dayText`).

**Anatomy:** 88 wide, radius 12, 3 pt `outline` edge, `surface`, tilt −3°, clipped: a month band (`accent` fill, `onAccent` `calendarMonth` 16 display, padding 2 / 0 / 3, 3 pt `outline` bottom edge) over the day number (`calendarDay` 42 display, line height 1.15, padding 4 / 0 / 6). Decorative: hidden from VoiceOver, because the date is also written next to it.

*Measurements* (`calendarTile`): width 88 · radius 12 · border 3 · rotate -3 · monthPadding 2/0/3 · dayPadding 4/0/6 (CSS shorthand: top, inline, bottom).

**ids:** `daily.today-card.calendar` with `.month` and `.day`.

## Week strip, week mark and legend (4.27)

**Templates:** `week-strip.tsx` (`WeekStrip`), `week-mark.tsx` (`WeekMark`), `week-legend.tsx` (`WeekLegend`).

**Strip:** seven equal columns (gap 4), each centred with gap 6: weekday letter (`weekdayLetter` 13 Bold `inkSoft`, from `date.weekday-strip.1..7`) · mark 38 × 38, radius 10, 2 pt edge (as rendered), 20 pt icon · the "Today" tag under today's mark (11 Bold toy ink on gold, padding 1 × 5, radius 5, 1 pt toy-ink edge as rendered (token 1.5), tilt −4°, no ring). Runs right to left in fa and ckb (plain `flexDirection: 'row'`).

**Marks** (`state`): **done** `accent` fill, `onAccent` check · **missed** dashed `inkSoft` edge, no fill, `inkSoft` close icon · **today** (not played yet) dashed `outline` edge, `surface` fill, `ink` play icon. A day already played today is `done` with `isToday`.

**Legend:** a wrap row (gap 8 × 18, 14 top margin, 14 `inkSoft` `legend` text): 22 pt marks (radius 6, 2 pt edge, 13 pt icon) + "Done" / "Missed".

*Measurements* (`weekStrip`): gap 4 · dayGap 6 · mark 38 · markRadius 10 · markBorder 2 (token 2.5) · markIcon 20 · markXs 22 · markXsRadius 6 · markXsBorder 2 · markXsIcon 13 · tag.paddingBlock 1 · tag.paddingInline 5 · tag.radius 5 · tag.border 1 (token 1.5) · tag.rotate -4.

**Accessibility:** each strip mark is an image with its own label (`daily.week.day-done.a11y-label`, `daily.week.day-missed.a11y-label`, `daily.today.label`); legend marks are decorative.

**ids:** strip `daily.week-strip`; days `daily.week-day.<1..7>` with `.letter`, `.mark`, `.today-tag`; legend `daily.week-card.legend` with `.done` and `.missed`.

## Stat grid and stat list (4.28)

**Templates:** `stat-grid.tsx` (`StatGrid`: `cells`, `columns` 2 or 3), `stat-list.tsx` (`StatList`: `rows`, optional `heading`).

**Stat grid:** 2 columns (or 3, the compact per-game grid), gap 14. **Cell:** value (`number` 30 display; `statValueCompact` 23 and no wrap in 3 columns) over label (`statLabel` 14 `inkSoft`), gap 2. A short last row keeps the column widths (empty cells fill it). Each cell is one accessibility element (value and label read together).

*Measurements* (`statGrid`): columns 2 · columnsCompact 3 · gap 14 · cellGap 2.

**Stat list** (best scores): rows split key / value, baseline-aligned, gap 12, padding 9 block, 2 pt `line` rule between rows (none above the first unless a heading precedes): key 15 (`statListKey`); value `statListValue` 22 display, end-aligned. The optional first row is a bold sub-heading with no value ("Score").

*Measurements* (`statList`): rowPaddingBlock 9 · separator 2 · gap 12.

**Panel header** for stat panels: see lists-and-surfaces.md (`PanelHeader`).

**ids:** grid cells `<panel>.<id>` with `.value` and `.label` (`stats.overview-card.win-rate.value`); list `<base>.list`, heading `stats.best-card.score-heading`, rows `<base>.<id>` with `.label` and `.value` (`stats.best-card.endless.value`).

## Score panel (4.29)

**Template:** `score-panel.tsx` (`ScorePanel`).

**Anatomy** (S7 win, also the Endless result): a panel; first row (wrap, gap 6 × 12, centred): "Score" (`scoreLabel` 17 Bold `inkSoft`) · value (`scoreValue` 44 display, line height 1) · the "New best!" sticker (gold, rating star) pushed to the end by a growing row slot with `justifyContent: 'flex-end'` (the Sticker's own `alignSelf: 'flex-start'` beats a column's `alignItems`), slapped in at 950 ms. Then the lines (gap 6, 12 top margin and 12 padding over a 2 pt `line` rule, `scoreLines` 16): each line a row of a 20 pt `success` check and its text (gap 8), as the design's `.sc-lines > span` rows: the game's full progress line, then the win's line, which has its check too.

**The win line** (`line?: { kind: 'moves' | 'score'; text: string }`, exported as `ScorePanelLine`): the screen picks the kind from how the level is rated, and the kind picks the part id.
- `kind: 'moves'` for levels rated by moves against par: `result.win.moves` ("7 moves – par 7"), part `.moves-line`.
- `kind: 'score'` for levels whose stars rule is score-based (Line Siege; the result model then has `par: null` and par is never shown): `result.win.score-line` with `score` and `bestScore` ("Score 1,840 – best 1,840"; `bestScore` is the level's best after this run), part `.score-line`.
- no `line` (daily and endless results): neither part is drawn.

`result.win.moves-count` ("12 moves") is retired: a score-rated win shows the score line. The panel draws the text it gets; the screen translates and formats it.

**ids:** `testIDBase="result.score-card"` gives `.label`, `.value`, `.new-best`, `.progress-line`, and `.moves-line` or `.score-line` (from the line's kind). A line id sits on the whole row (check and text), not on the text, because the design measures the full-width row (324 pt on a 402 pt window); the text inside has no id. The parity reference for a score-rated game is the S7 win variant whose moves line became the score line.

## Week bars (4.29)

**Template:** `week-bars.tsx` (`WeekBars`: `bars` with `value`, `valueText`, `day`, `label`).

**Anatomy** (S10 last 7 days): seven equal columns; each a 124 pt plot area bottom-aligned on a 3 pt `outline` baseline (gap 4): value (`barValue` 13 Bold `ink`) over a bar 26 wide, height = value / max × 92, `accent`, 2 pt `outline` edge (as rendered) on top and sides, top radius 5; the day letter (`barDay` 13 Bold `inkSoft`) 6 below. Zero days show only the value. Runs right to left in fa and ckb.

*Measurements* (`barChart`): plotHeight 124 · barWidth 26 · maxBar 92 · barRadiusTop 5 · border 2 (token 2.5) · baseline 3 · valueGap 4 · dayMarginTop 6.

**Accessibility:** each column is an image labelled with `stats.week.bar.a11y-label` ("Monday: 3 games"). **ids:** chart `stats.week-card.chart`; columns `stats.week-bar.<1..7>` with `.value`, `.bar`, `.day`.

## How-to stage and pager dots (4.30)

**Templates:** `how-to-stage.tsx` (`HowToStage`), `pager-dots.tsx` (`PagerDots`).

**Stage:** 3 pt `outline` edge, radius 16, `surface`, padding 12, holding the game's how-to picture (full width, height by its aspect). id `how-to-play.stage`.

*Measurements* (`howToStage`): radius 16 · border 3 · padding 12.

**Pager dots:** 12 × 12 squares, radius 3, 2 pt `outline` edge (as rendered), no fill, gap 8; the current step is 30 wide and `accent`. Decorative (the step chip "Step 2 of 4" carries the text). id `how-to-play.pager-dots`, dots `.1`..`.n`.

*Measurements* (`pagerDots`): size 12 · activeWidth 30 · radius 3 · border 2 (token 2.5) · gap 8.

## Empty state (4.31)

**Template:** `empty-state.tsx` (`EmptyState`: `picture`, `title`, `body`, `action`, `footer`).

**Anatomy** (S10 new player): a column centred vertically in the body, start-aligned, gap 14: picture (the 190 pt code-drawn empty-stats picture) · title (`title` 30, a header) · body (`lead` 18) · the hero key with a play cap (`stats.play-button`) · the local-data note (`stats.local-note`).

*Measurements* (`emptyIllustration`): width 190 · viewBox 0 0 190 150.

**ids:** `stats.empty-state` with `.picture`, `.title`, `.body`.

## Mock-only parts

Never build these; the mockup draws them only to show where something else appears.

- **Bottom sheet (4.32):** the S3 frame shows where Google's consent form appears (sheet from 250 pt, top radius 26, grabber 44 × 5). Google UMP draws the real form natively.
- **Board placeholder (4.35):** in S6 the dimmed board is a dashed frame with a "game board" label; the real board fills that area.
- **Ad box and "Ad" chip (4.17):** stand-ins for the creative inside the banner band.

Reference crop: the design board has no separate card for these parts; compare built screens with the screen captures of the visual-parity work.
