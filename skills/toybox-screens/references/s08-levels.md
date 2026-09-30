# S8 Levels

S8 Levels shows progress and lets the player pick any unlocked level.

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

- Level packs as sections, for example "Pack 1 – Beginnings (30 levels)"; pack names come from the game (`games.<id>.packs`, or the Shell's `levels.pack.default-name-<n>`).
- A grid of level tiles: the level number (in the chosen digits), 0–3 stars, a lock if locked.
- Pack progress: "54 / 90 stars".
- Banner ad at the bottom (same rules as Home).
- Levels unlock one after another; packs unlock by stars collected (for example pack 2 needs 45 stars), so nobody is stuck forever.
- Tapping a locked tile says how to unlock it. Premium does NOT unlock levels (decision D2).

## Layout, top to bottom

Top bar "Levels" with Back. The frame leaves the bottom edge out (`UNDER_HOME_INDICATOR_EDGES`) and the body scrolls on under the home indicator (`ScreenBody isUnderHomeIndicator`; the ScrollView carries `levels.grid`), as the design's `.body` does; per open pack:

1. Pack header (row, centred, wraps, gap 6 x 10): heading 21 "Pack 1 – First wave" (flex 1) and the level count (muted).
2. Progress line (row, centred, gap 10, 10 top / 16 bottom margin, 15 Bold): a filled 22 pt star → "28 / 90 stars" → progress bar (grows along the row, 16 tall, accent fill from the start edge). The ProgressBar sits in the row itself: a `{ flex: 1 }` wrapper stretched it to 22 pt (the bar's own `flex: 1` grew vertically inside it).
3. The level grid: 6 columns, row gap 10, column gap 8. The tile width is `tileWidthFor(width, scale)` (`tile-width.ts`, with its test): six equal columns floored to the device pixel grid, never to whole points, so a tile is 53.67 pt on a 402 pt phone at 3x, as the design's grid (whole points gave 53 and put tiles 5, 6, 11 ... 2.7-4 pt off). The window's `scale` comes from `useWindowDimensions()`.
   - Completed: surface, number (`levelNumber` 21; Latin line height 1.0, Persian and Kurdish 1.45: at 1.0 iOS clipped the tops of the Vazirmatn digits, so the token is 1.45 and the design draws the Persian tiles the same way) and three 13 pt mini stars (filled or hollow).
   - Current (exactly one, the next level): accent fill, 3 pt edge, onAccent number and hollow stars, the gold flag sticker (24, radius 7, +8 deg, play icon) at the top-end corner, and a gentle 1.6 s bob (none under Reduce motion, and none during a parity capture: `useReduceMotion()` is true there, so the frame settles).
   - Locked: sunken fill, dashed muted edge, pushed in, muted number and a 16 pt padlock instead of stars.
   - Locked and tapped: the 3 pt focus ring (2 pt gap) and the toast "Unlock this one by finishing level 12."

Then the next locked pack as a dashed, sunken panel (gap 6, a dashed 3 pt ink edge): header row (plain icon tile `lock` → heading, which takes its line) → the small ink sticker "Locked" (tilt -4 deg) on its own line (the design's header wraps it below the heading; Yoga does not wrap a flex-basis-auto row like CSS, so the break is explicit and the heading is never squeezed) → the requirement in Bold ("Unlocks at 45 stars") → the explanation (muted).

The banner closes the body's column: its wrapper (`{ marginTop: 'auto', marginInline: -LAYOUT.screenGutter }`) is the ScrollView's last item, pushed to the bottom while the packs fit, one block gap after them otherwise, and full bleed across the body's 20 pt gutters. The toast is absolute in the body area, 352 pt below the body's top (`top: 352`, the design's `.lv-toast`), over the tiles of the lower rows; it is drawn only while a locked tile is focused. (A banner pinned outside the ScrollView made `levels.grid` 100 pt short, and a toast anchored at the bottom covered the wrong tiles: 41 and 72 parity failures in light-en and light-fa before these fixes.)

## States and variants

One frame (`s8-levels.png`): pack 1 open with 11 completed tiles, tile 12 current, 13–30 locked (13 tapped, with the toast), pack 2 locked. Only the next locked pack is shown as a panel.

## Data the model supplies

`LevelsModel` (`levels-model.ts`): `packs` (number, name, levelsCount, earned and total stars, progress 0..1, isLocked, unlockStars, missingStars, tiles), `focusedLevel` (the tapped locked tile, or null; a parity capture of `s8-levels` starts with the first locked tile, through `TEST_ONLY?.parityFrameState()`, the state a tap sets), `isReducedMotion` (`useReduceMotion()`: the saved setting, and true during a parity capture; its test expects true in a parity session), `banner`, `onBack`, `onPlayLevel`, `onTapLockedLevel`. Tiles carry `numberText` already formatted with the chosen digits and the Toybox `LevelTileState` (`{ kind: 'completed', stars }`, `{ kind: 'current' }`, `{ kind: 'locked' }`); `pack-section.tsx` passes them to the Toybox `LevelTile` with `testID` `levels.level-tile.<n>` (it derives `.number`, `.stars-<k>`, `.flag`), the translated label and, for locked tiles, the hint.

The template `use-levels-model.ts` (with its test) builds it: the game's packs from `useGameHost().packs` (name key, first level, level count, stars to unlock), the best stars from the progress store (`starsByLevelOf`), the level numbers in the chosen digits, the tapped locked tile as local state, and the banner from `useBannerSlot('levels')`. The pure `levels-model-of.ts` (with its test) applies game-kit's `pack-progress.ts` rules: a pack opens by stars collected in total (`isPackUnlocked`), inside an open pack levels open one after another (`isLevelUnlocked`: the first level of a pack opens with the pack), a won level shows its stars, the one open unfinished level of each open pack is `current`, the rest are `locked`; every open pack is a grid and only the first locked pack follows as the dashed panel (`missingStars` from `starsMissing`). Tapping an open tile navigates to `Game` with `{ start: 'new', ref: { kind: 'level', level } }`.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/levels/`.

- `packages/shell/src/screens/levels/levels-model.ts`
- `packages/shell/src/screens/levels/levels-view.tsx`
- `packages/shell/src/screens/levels/locked-pack-panel.tsx`
- `packages/shell/src/screens/levels/pack-section.tsx`
- `packages/shell/src/screens/levels/tile-width.ts` and its test
- `packages/shell/src/screens/levels/levels-screen.tsx`
- `packages/shell/src/screens/levels/levels-view.test.tsx`
- `packages/shell/src/screens/levels/levels-model-of.ts`, `use-levels-model.ts` and their tests

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S8` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `levels.screen` | ScreenFrame | none |  |  |  |
| `levels.top-bar` | TopBar | none |  |  | .back-button .title |
| `levels.grid` | ScrollView | none |  |  |  |
| `levels.pack.<n>` (x2) | View | none |  |  |  |
| `levels.pack.<n>.heading` (x2) | AppText | header | `levels.pack.heading` |  |  |
| `levels.pack.<n>.count` | AppText | text | `levels.pack.level-count` |  |  |
| `levels.pack.<n>.progress` | View | none |  |  |  |
| `levels.pack.<n>.progress-star` | RatingStars (inline 22, filled) | none |  |  |  |
| `levels.pack.<n>.progress-label` | AppText | text | `levels.pack.progress` |  |  |
| `levels.pack.<n>.progress-bar` | ProgressBar | progressbar |  |  |  |
| `levels.pack.<n>.tiles` | View (6 columns, row gap 10, column gap 8) | none |  |  |  |
| `levels.level-tile.<n>` (x30) | LevelTile | button | a11y `levels.level-tile.a11y-label`; a11y `levels.level-tile.locked.a11y-label` |  |  |
| `levels.level-tile.<n>.number` (x30) | AppText | text |  |  |  |
| `levels.level-tile.<n>.stars-<n>` (x11) | RatingStars (mini 13) | none |  |  |  |
| `levels.level-tile.<n>.flag` | Sticker (level flag, gold 24, play icon, +8 deg) | none |  |  |  |
| `levels.pack.<n>.icon` | IconTile (plain, lock) | none |  |  |  |
| `levels.pack.<n>.locked-badge` | Sticker (ink sm, lock, -4 deg) | text | `levels.pack.locked-badge` |  |  |
| `levels.pack.<n>.requirement` | AppText | text | `levels.pack.requirement` |  |  |
| `levels.pack.<n>.explanation` | AppText | text | `levels.pack.locked` |  |  |
| `levels.locked-toast` | Toast | alert | `levels.level-tile.locked-toast` |  |  |
| `levels.banner-ad` | AdBannerSlot | none |  |  |  |

## Copy keys

| Key | English |
|---|---|
| `common.back` | Back |
| `common.levels` | Levels |
| `levels.pack.heading` | Pack {packNumber, number} – {packName} |
| `levels.pack.level-count` | {levelsCount, plural, one {# level} other {# levels}} |
| `levels.pack.progress` | {earned, number} / {total, plural, one {# star} other {# stars}} |
| `levels.level-tile.a11y-label` | Level {level, number}: {starsCount, plural, =0 {no stars yet} one {# star} other {# stars}} |
| `levels.level-tile.locked.a11y-label` | Level {level, number}, locked |
| `levels.pack.locked-badge` | Locked |
| `levels.pack.requirement` | Unlocks at {starsCount, plural, one {# star} other {# stars}} |
| `levels.pack.locked` | Collect {starsCount, plural, one {# more star} other {# more stars}} to unlock {packName}. |
| `levels.level-tile.locked-toast` | Unlock this one by finishing level {previousLevel, number}. |

## Reference images

- `assets/reference/s8-levels.png` (normal; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Hatching locked tiles (cut from the design) or showing a lock by colour alone: dashed edge plus padlock.
- Making locked tiles unpressable: the tap explains how to unlock.
- Index-based testIDs: tiles are keyed by level number (`levels.level-tile.12`).
- Tile widths floored to whole points, a `{ flex: 1 }` wrapper around the ProgressBar, the Locked sticker squeezed into the heading row, or the banner pinned outside the scrolling body: each one moved S8 off its reference.
- A Persian level number at line height 1.0 (the digits are clipped at the top on iOS): the `levelNumber` role uses 1.45 for fa and ckb.
- Locked tiles and the locked pack draw React Native's dashed edge, whose dash length and phase no style sets; parity pre-lists that difference as a platform waiver, and nothing re-draws it.
