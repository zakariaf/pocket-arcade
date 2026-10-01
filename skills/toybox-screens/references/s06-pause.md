# S6 Pause

S6 Pause is an overlay on the game: the board stays visible, dimmed, and paused underneath.

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

- Shows: Resume (big) | Restart level | How to play | Sound on/off | Music on/off | Vibration on/off | Home.
- "Restart level" asks for confirmation only if progress would be lost beyond a few moves (the S14 restart-level dialog).
- "Home" keeps the level saved, so Continue on Home resumes it.
- **No ads here.**
- Back while playing opens Pause; Back in Pause resumes (navigation-and-routing).

## Layout, top to bottom

The Game screen stays visible under the scrim. `GameLayout` draws the overlay beside the Game screen's safe-area frame, not inside it, so the scrim covers the whole screen, the status bar included, as the reference draws it (inside the frame the status bar stayed undimmed). The overlay (padding 28 x 20, centred) holds the Pause dialog card (radius 22, padding 20 / 18 / 18, gap 12, hard shadow 8):

1. Header row (baseline-aligned, space-between, wraps, gap 10): title (`title` 30, "Paused") and the mode line (muted, "Level 12"). The row is `alignItems: 'flex-start'` and each text sits in a View whose `paddingTop` is the difference of the two `useChromeBaseline` values (`title` and `body`), as StatList does with a margin (in this wrapping row iOS ignored a `marginTop` on the item; measured on the simulator). Yoga's `alignItems: 'baseline'` put the Persian mode line's box 4.7 pt above the design (the title's overflow guard pads change where Yoga finds its baseline); the Chrome baselines drop it 9.83 pt in en and 12.5 pt in fa at 3x (design 10 and 13).
2. Hero key with a `play` cap: "Resume" (the dialog's one hero key).
3. Secondary block button with the `restore` icon: "Restart level".
4. Secondary block button with the `book` icon: "How to play".
5. Three pause toggle keys in three columns (gap 10; min 84 tall, radius 10, elevation 3): Sound, Music, Vibration, each with a 26 pt icon, a 14 Bold label and a 13 pt state line with a check or dash and "On" / "Off". On = accent, pushed in.
6. Quiet button with a `home` icon, centred: "Home".

## States and variants

The design draws Sound on, Music off, Vibration on. Music is left out for games without music and Vibration on devices without haptics (the same rule as the Settings rows). The keys that remain share the row exactly as `usePairLayout` lays them out: each key's cell grows (`flexGrow: 1` in ToggleKey, never `flex: 1`, which collapsed the row to 0 pt inside a column cell and let the keys cover the Home button on the device).

The dialog draws no hint entry: hints live only in the S5 top bar under the scrim, and a game without solver hints (`useGameHost().hasHints` false, Line Siege) has no hint key there either (the lead's decision L8; s05-game.md).

Visual parity picks the reference from the game's facts (`parity/game-facts.json` in the app repo, `hasMusic` and `hasHints`). Variants compose in the frames' order, music before hints: a game without music is compared with `s6-pause--no-music` (Music key removed, the other keys sharing the row), a game without hints with `s6-pause--no-hints` (the top bar under the scrim without its hint key), and a game with neither, like Line Siege, with `s6-pause--no-music--no-hints`, never with the base frame. The parity frame `pause-open` is opened by the Game screen's session-controls hook (game-host-integration): Pause over the design's level-12 run, its top bar showing the fixture's numbers.

## Data the model supplies

`PauseOverlay` takes the navigation skill's props (`onResume`, `onHome`) plus `session` (the Game screen's controls) and reads `PauseModel` from `usePauseModel(session)`: `modeText`, `sound`, `music` (or null), `vibration` (or null) as `{ isOn, onToggle }` (settings actions: `createPreferenceActions` from settings-and-preferences, built with the same `onToggled: () => { playUiFeedback(services, 'toggle'); }`, so a Pause toggle key sounds and pulses once, like the Settings switch; `RaisedSurface` plays no tap for a switch), `onRestart`, `onHowToPlay`, `isReducedMotion`.

The template `use-pause-model.ts` (with its test) builds it from `usePauseModel(session)`: `PauseOverlay` gets the Game screen's `GameSessionControls` as `session` (`PauseSession` = its `view` and `startRun`), so the mode line is `modeTextOf(view.ref, text)` (the top bar's text), Music shows only when `useGameHost().hasMusic`, Vibration only when the haptics port is supported, and Restart level restarts the same ref at once for up to three moves (`RESTART_WITHOUT_ASKING_MOVES`, Chosen) and opens the S14 `restart-level` dialog after that.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/pause/`.

- `packages/shell/src/screens/pause/pause-model.ts`
- `packages/shell/src/screens/pause/pause-overlay.tsx`
- `packages/shell/src/screens/pause/pause-toggles.tsx`
- `packages/shell/src/screens/pause/pause-view.tsx`
- `packages/shell/src/screens/pause/pause-view.test.tsx`
- `packages/shell/src/screens/pause/use-pause-model.ts` and its test

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S6` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `pause.scrim` | Scrim | none |  |  |  |
| `pause.dialog` | DialogCard (pause padding 20/18/18) | none |  |  |  |
| `pause.title` | AppText | header | `pause.title` |  |  |
| `pause.mode-label` | AppText | text | `game-screen.mode.level` |  |  |
| `pause.resume-button` | Button (primary hero, play cap) | button | `pause.resume-button` |  |  |
| `pause.restart-button` | Button (secondary block, restore icon) | button | `pause.restart-button` |  |  |
| `pause.how-to-play-button` | Button (secondary block, book icon) | button | `common.how-to-play` |  |  |
| `pause.toggles` | View | none |  |  |  |
| `pause.sound-switch` | ToggleKey (sound) | switch | a11y `pause.sound` |  | .icon .label .state |
| `pause.music-switch` | ToggleKey (music) | switch | a11y `pause.music` |  | .icon .label .state |
| `pause.vibration-switch` | ToggleKey (vibration) | switch | a11y `pause.vibration` |  | .icon .label .state |
| `pause.home-button` | Button (quiet, home icon, centred) | button | `common.home` |  |  |

## Copy keys

| Key | English |
|---|---|
| `pause.title` | Paused |
| `game-screen.mode.level` | Level {level, number} |
| `pause.resume-button` | Resume |
| `pause.restart-button` | Restart level |
| `common.how-to-play` | How to play |
| `pause.sound` | Sound |
| `common.on` | On |
| `pause.music` | Music |
| `common.off` | Off |
| `pause.vibration` | Vibration |
| `common.home` | Home |

## Reference images

- `assets/reference/s6-pause.png` (normal; phone). A game without music or without hints is compared with toybox-visual-parity's design-derived variants `s6-pause--no-music`, `s6-pause--no-hints` or `s6-pause--no-music--no-hints` (Line Siege).

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- A route for Pause: it would unmount the board.
- The overlay inside `game.screen`'s safe area (the scrim then stops under the status bar), or a toggle key cell with `flex: 1` (the row collapses).
- An ad, a banner or a Premium nudge in Pause.
- Toggles that do not write the settings store (they are the same settings as S11).
