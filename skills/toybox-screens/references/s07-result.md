# S7 Result

S7 Result shows how a run ended, drawn over the finished board inside the Game screen.

## Contents

- What the product requires
- Layout, top to bottom
- States and variants
- Data the model supplies
- Templates
- testIDs
- Copy keys
- A Shell text the deck lacks: result.win.score-line
- Reference images
- Pitfalls

## What the product requires

- **Win:** "Level complete!" with 1–3 stars filling in one by one; score and "New best!" when it is one; the goal line ("7 moves – par 7" for a level rated by moves against par; "Score 1,840 – best 2,010" for a level rated by score, such as every Line Siege level); NEXT LEVEL (big) | Replay | Levels. In Daily mode: today's result, the streak and "Come back tomorrow".
- **Lose:** a short, friendly reason ("The monsters broke through", "No moves left"); TRY AGAIN (big) | Levels; optional Continue once per level (a rewarded ad, or free for Premium), only for games that allow continuing.
- Stars and statistics are saved BEFORE this screen appears.
- A full-screen ad, if one is due, appears AFTER the player taps Next / Replay / Try again, never before they have seen their result and never on top of it.
- Premium is never pushed with pop-ups: one friendly line on the result screen at most once per day ("Enjoying it? Remove ads for €1.99").

## Layout, top to bottom

The Result covers the whole screen: `GameLayout` draws it beside the Game screen's safe-area frame, so its own `ScreenFrame` is inset once (inside the Game frame it sat 59 pt low with its bottom keys clipped). Its frame leaves the bottom edge out (`UNDER_HOME_INDICATOR_EDGES`) and its `ScreenBody` runs under the home indicator (`isUnderHomeIndicator`), ending with max(34, inset): every key stays where the reference draws it (the last one ends 34 pt above the bottom, 840 of 874) and the last key's 5-6 pt hard shadow is drawn inside the scroll view. With the default edges the body ended at the safe area with 0 pt of padding, and the ScrollView clipped the shadow of the Replay / Levels row whenever the Premium nudge was absent (Premium owners, the day's nudge already shown, every test build).

Chip and Sticker align themselves to the start (`alignSelf: 'flex-start'`), which beats a wrapper's `alignItems: 'center'`: every centred chip or sticker (the mode chip in all four views, the win sticker, the daily streak sticker) sits in a `{ flexDirection: 'row', justifyContent: 'center' }` wrapper. Only a centred row centres them (they were left-aligned on the device).

**Win** (`s7-result-win.png`), body gap 14:

1. Result chip centred (4 pt top padding): the mode line ("Level 12").
2. Stars row: 86 / 102 / 86 pt, 124 tall, gap 8, bottom-aligned, the middle star 24 higher; one image for VoiceOver ("Stars: 3 / 3"); the testID suffix is the star count (`result.stars-3`). Pop-in: 540 ms each, delays 250 / 400 / 550 ms (boing); Reduce motion shows them filled at once with a 120 ms fade.
3. Title (`display` 38, centred): "Level complete!".
4. The game's win-title sticker on accent paper (tilt -3 deg, slapped in at 700 ms, pulled up 2 pt, centred).
5. Score panel: "Score" (17 Bold muted) · the value (44 display) · the gold small (`sm`) "New best!" sticker with the rating star (tilt +6 deg, slapped at 950 ms; ScorePanel sets the size and the tilt) at the end; then, over a 2 pt rule, the game's progress line with a 20 pt success check and the win line: the moves line ("7 moves – par 7", `result.score-card.moves-line`) on a level rated by moves, or the score line ("Score 1,840 – best 2,010", `result.score-card.score-line`) on a level rated by score. Line Siege is score-rated: parity compares its win with toybox-visual-parity's design-derived `s7-result-win--score` variant, picked from `parity/game-facts.json` (`winLine: 'score'`).
6. grow.
7. Hero key without a cap, forward at the end: "Next level".
8. Two buttons (gap 12): Replay (`restore`) and Levels (`grid`).
9. Quiet nudge with a `crown`, centred: "Enjoying it? Remove ads for {priceText}." (not for owners; at most once a day).

**Lose** (`s7-result-lose.png`): chip → grow → the logo tile 104 (tilt +17 deg, 6 pt ring, 6 pt lower), centred → title "Not this time" → reason panel (row, gap 12: 28 pt `alert` icon in danger + heading 21 with the game's lose reason, or "No moves left") → offer box (dashed 3 pt, no fill: pop block button with the `ad` icon "Continue – watch an ad", and "One continue per level.") → grow → hero key with a `restore` cap "Try again" → secondary block Levels.

## States and variants

- **Daily result** (Chosen, not drawn): the win layout without stars: chip (daily mode line), "Daily challenge done!" (`result.daily-title`), the gold streak sticker with a chain (`result.streak-sticker`), the score panel, "Come back tomorrow for a new one." (`result.come-back-note`), grow, hero key with a `home` cap (`result.home-button`).
- **Endless result** (Chosen): chip "Endless", "Run over" (`result.endless-title`), score panel with the "Best 4,210" line, grow, hero Try again (`restore` cap), secondary block Home.
- **Continue for Premium owners** (Chosen): the same pop button with a `play` icon, "Continue – free with Premium" (`result.continue-premium-button`).
- After the continue is used (or for games without continues): no offer box.

## Data the model supplies

`ResultModel` (`result-model.ts`) is a union by `kind`: win (`stars`, `winTitle`, `progressText`, `score`, `bestScore`, `movesCount`, `par`, `nudgePriceText`), lose (`logo`, `loseReason`, `continueOffer`), daily (`progressText`, `streakDays`), endless (`bestScore`); all carry `modeText`, `isReducedMotion`, `actions` and (except lose) `scoreText`, `isNewBest`. The game host builds it after the save: the Game screen calls `resultModelOf({ view, game: useGameHost(), text, actions, continueOffer, isReducedMotion, extras })` (game-host-integration), which reads the win title (`host.winTitleId`) and the lose logo (`host.logo`) itself; `extras` holds only the streak, the endless best and the nudge price. `par` is `number | null`: `resultModelOf` passes null for a level whose star rule is score-based (Line Siege rates its levels by score; its par is only a generator filter and is never shown). The win view then prints the Shell key `result.win.score-line` with `score` (this run) and `bestScore` (the level's best after this run, `progress.levels[n].bestScore`), through ScorePanel's `line` of kind `'score'` (it derives `.score-line`); a moves-rated level prints `result.win.moves` with `movesCount` and `par` as the line of kind `'moves'` (`.moves-line`). The overlay test covers both lines, the centred rows and the body's bottom room. `result.win.moves-count` is retired: check-screens fails a screen that still uses it (`retired-copy-key`). `loseReason` is the text of the game's `<game-id>.lose.<reason>` key for the way the run was lost (for Line Siege `line-siege.lose.broke-through` or `line-siege.lose.board-full`), through `gameMessageText`; `null` falls back to the Shell's `result.lose.reason.no-moves`. The stars are the Toybox `ResultStars` (`testID` `result.stars-<count>`, a labelled image that pops in), the score is `ScorePanel` (`testIDBase="result.score-card"` derives `.label`, `.value`, `.new-best`, `.progress-line`, and `.moves-line` or `.score-line` from its `line` prop `{ kind: 'moves' | 'score', text }`), the lose offer is `OfferBox`; paired buttons are `isInRow` buttons in a wrapping row.

## Templates

Copy each file from `templates/` to the same path in the app repo; the code lives in `packages/shell/src/screens/result/`.

- `packages/shell/src/screens/result/result-model.ts`
- `packages/shell/src/screens/result/continue-offer.tsx`
- `packages/shell/src/screens/result/result-daily-view.tsx`
- `packages/shell/src/screens/result/result-endless-view.tsx`
- `packages/shell/src/screens/result/result-lose-view.tsx`
- `packages/shell/src/screens/result/result-overlay.tsx`
- `packages/shell/src/screens/result/result-win-actions.tsx`
- `packages/shell/src/screens/result/result-win-view.tsx`
- `packages/shell/src/screens/result/result-overlay.test.tsx`

## testIDs

Exactly these, from the shared screen map (`assets/screen-testids.json`). Set the testID in the first column; the parts in the last column are drawn by that component from it. `<n>` is a stable data key (a level number, a language code, a stat id), never a list index; the only numbered series are the week columns and bars (`daily.week-day.1..7`, `stats.week-bar.1..7`: position, 1 = the oldest day, 7 = today), which WeekStrip and WeekBars number themselves. Components that take a base prop (`testIDBase`, `dayTestIDBase`, `barTestIDBase`, `segmentTestIDBase`) derive the rows marked "drawn by"; pass the base exactly (see component-contract.md). `node ${CLAUDE_SKILL_DIR}/scripts/list-screen.mjs S7` prints every element with its English text.

| testID | Component (kind) | Role | Copy key | Variants, requires | Parts the component draws |
|---|---|---|---|---|---|
| `result.screen` | ScreenFrame | none |  |  |  |
| `result.mode-chip` | Chip | text | `game-screen.mode.level` |  |  |
| `result.stars-<n>` | ResultStars (86/102/86, Skia canvas) | image | a11y `result.win.stars.a11y-label` | win |  |
| `result.title` | AppText | header | `result.win.title`; `result.lose.title` |  |  |
| `result.win-sticker` | Sticker (acc, -3 deg, slap at 700 ms) | text | `games.<id>.winTitle` | win |  |
| `result.score-card` | ScorePanel | none |  | win |  |
| `result.score-card.label` | AppText | text | `common.score` | win | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.score-card.value` | AppText | text |  | win | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.score-card.new-best` | Sticker (gold sm, star, +6 deg, slap at 950 ms) | text | `result.win.new-best` | win | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.score-card.progress-line` | AppText | text | `games.<id>.progress` | win | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.score-card.moves-line` | AppText | text | `result.win.moves` | win (winLine `moves`) | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.score-card.score-line` | AppText | text | `result.win.score-line` (Shell text) | win (winLine `score`) | (drawn by ScorePanel from `testIDBase="result.score-card"`) |
| `result.next-button` | Button (primary hero, forward icon at the end) | button | `result.win.next-button` | win |  |
| `result.replay-button` | Button (secondary, restore icon) | button | `result.win.replay-button` | win |  |
| `result.levels-button` | Button (secondary, grid icon) | button | `common.levels` |  |  |
| `result.premium-button` | Button (quiet, crown icon, centred) | button | `result.premium-nudge` | win |  |
| `result.logo` | LogoTile (104 lose (+17 deg, 6 pt ring, 6 pt lower)) | none |  | lose |  |
| `result.reason-card` | Panel | none |  | lose |  |
| `result.reason-card.icon` | Icon (alert 28, danger) | none |  | lose |  |
| `result.reason-card.label` | AppText | header | `<game-id>.lose.<reason>` (deck `games.<id>.loseReason`) | lose |  |
| `result.continue-offer` | OfferBox | none |  | lose |  |
| `result.continue-ad-button` | Button (pop block, ad icon) | button | `result.lose.continue-ad` | lose |  |
| `result.continue-note` | AppText | text | `result.lose.continue-note` | lose |  |
| `result.try-again-button` | Button (primary hero, restore cap) | button | `common.try-again` | lose |  |

Chosen states the design does not draw may also set: `result.daily-title`, `result.streak-sticker`, `result.come-back-note`, `result.home-button`, `result.endless-title`, `result.score-card`, `result.try-again-button`, `result.continue-premium-button`, `result.continue-ad-button`.

## Copy keys

| Key | English |
|---|---|
| `game-screen.mode.level` | Level {level, number} |
| `result.win.stars.a11y-label` | Stars: {starsCount, number} / {maxStars, number} |
| `result.win.title` | Level complete! |
| `result.lose.title` | Not this time |
| `games.<id>.winTitle` | (the game's own text) |
| `common.score` | Score |
| `result.win.new-best` | New best! |
| `games.<id>.progress` | (the game's own text) |
| `result.win.moves` | {movesCount, plural, one {# move} other {# moves}} – par {par, number} |
| `result.win.score-line` | Score {score, number} – best {bestScore, number} (not in the deck: see below) |
| `result.win.next-button` | Next level |
| `result.win.replay-button` | Replay |
| `common.levels` | Levels |
| `result.premium-nudge` | Enjoying it? Remove ads for {priceText}. |
| `<game-id>.lose.<reason>` (deck `games.<id>.loseReason`) | (the game's own text, one key per way of losing) |
| `result.lose.continue-ad` | Continue – watch an ad |
| `result.lose.continue-note` | One continue per level. |
| `common.try-again` | Try again |

## A Shell text the deck lacks: result.win.score-line

The copy deck has only the moves line with a par. The score line of a score-rated win is written by hand in all four Shell catalogs (`packages/shell/src/i18n/catalogs/<lang>.json`, keys sorted), exactly as below; the design deck is not edited for it, so `copy-deck.mjs apply` never writes it, and `check-screens.mjs` fails `extra-key-catalog` while a catalog lacks it or differs. It uses the deck's own words for score and best; the fa and ckb drafts go on the owner's own review list (an owner step in the report, not blocking). It replaces the retired `result.win.moves-count` ("12 moves"), which is gone from the catalogs and from check-screens' list.

| Language | `result.win.score-line` |
|---|---|
| en | `Score {score, number} – best {bestScore, number}` |
| de | `Punkte {score, number} – Rekord {bestScore, number}` |
| fa (draft, owner's review) | `امتیاز {score, number} – رکورد {bestScore, number}` |
| ckb (draft, owner's review) | `خاڵ {score, number} – باشترین {bestScore, number}` |

## Reference images

- `assets/reference/s7-result-win.png` (win; phone). A score-rated game is compared with toybox-visual-parity's `s7-result-win--score` variant (the moves line becomes the score line).
- `assets/reference/s7-result-lose.png` (lose; phone)

Open the image before building and compare the finished screen with it (toybox-visual-parity runs the exact comparison).

## Pitfalls

- Showing a full-screen ad before or over the result.
- Colour-coding star counts: filled vs hollow carries the meaning.
- The Premium nudge for owners, or more than once a day.
- Saving stars after the screen appears (they are saved first).
- "12 moves" or "par" on a score-rated win: it prints the score line.
- Centring a Chip or a Sticker with `alignItems` (it aligns itself to the start), or a body that ends at the safe area (the last key's shadow is clipped).
- The parity frames `result-win` and `result-lose` are opened by the Game screen's session-controls hook (`debugControls().showFixtureResult(fixture)`, game-host-integration), never by the result views.
