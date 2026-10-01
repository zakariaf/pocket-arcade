# Features: languages (7.x) and features in detail (8.x)

What each cross-screen feature must do. Section numbers are the spec's own, so "spec 8.8" in a test title or commit body points here.

## Contents

- 7 · Languages, right-to-left and numbers: 7.1 The four languages, 7.2 Choosing the language, 7.3 Numbers, 7.4 Writing and texts, 7.5 What mirrors in right-to-left, 7.6 Fonts
- 8 · Features in detail: 8.1 Levels and stars, 8.2 Modes, 8.3 Daily challenge generation, 8.4 Scoring, 8.5 Undo and hints, 8.6 Saving, 8.7 Sound, music and vibration, 8.8 Ads (AdMob), 8.9 Premium purchase, 8.10 Continue after losing, 8.11 Accessibility, 8.12 Themes and look, 8.13 Testing hooks, 8.14 Errors and stability

## 7 · Languages, right-to-left and numbers

### 7.1 · The four languages

| Code | Language | Direction | Default digits | Name shown |
|---|---|---|---|---|
| en | English | LTR | 0-9 | English |
| de | German | LTR | 0-9 | Deutsch |
| fa | Persian | RTL | ۰۱۲۳۴۵۶۷۸۹ | فارسی |
| ckb | Kurdish Sorani | RTL | ۰۱۲۳۴۵۶۷۸۹ | کوردیی ناوەندی |

Sorani uses the same Persian-style digits (۰۱۲۳...) as Persian by default, the same choice as in the owner's earlier E06 app. "Latin digits" is one setting away for anyone who prefers 0-9.

### 7.2 · Choosing the language

1. If the player picked a language in S2 or Settings, use it.
2. Otherwise use the phone's first language that is one of the four. Any Sorani tag counts as ckb, any Persian tag (including Dari) as fa.
3. Otherwise English.

Notes:

- "ku" or "kmr" (Kurmanji, written in Latin letters) falls back to English. Sorani script would be wrong for those players.
- The language list always shows each name in its own language and script, so someone stuck in the wrong language can find their own.

### 7.3 · Numbers

- One digit style is active across the whole app at a time: Automatic (the language's default) / Latin / Local.
- Digits are only a display choice; saves always store plain numbers.
- This applies to scores, levels, stats, dates, prices shown by the Shell, and numbers drawn on game boards (for example monster health), unless a game declares that a number is a code or symbol that must stay Latin.
- Persian and Sorani use their own decimal and thousands marks (٫ and ٬). Percentages use ٪.

### 7.4 · Writing and texts

- Every sentence is one translated message with named placeholders, for example "Level {level} complete in {moves} moves". Nothing is glued together (N12).
- Plural forms come from the translation files; the code never checks "if one".
- Names or numbers inside a right-to-left sentence are isolated at display time, so they never jump to the wrong side.
- Punctuation lives in the translation: Persian and Sorani use ، ؛ ؟.
- Tone: German uses informal "du" (normal for games; decision D7). Persian and Sorani use a friendly, neutral tone.
- Claude Code writes all four languages. Persian and Sorani texts should be read once by a native speaker before each release. Machine-written Sorani especially can sound unnatural. The owner does this review personally (decided 2026-09-30, owner decision O6): Claude Code drafts the texts, lists the review as the owner's step in its reports ("Owner steps (not blocking)"), and never waits for it.
- Game module texts (title, tutorial, how-to-play, piece and enemy names, result reasons, stats labels) are required in all four languages. A missing text fails the build.

### 7.5 · What mirrors in right-to-left

Mirrors (anything that shows reading order or forward progress):

- Page layout, padding, alignment, list rows, top bars (Pause at the start = right side in RTL).
- Back arrow (points right), next/previous arrows, page transitions.
- Button order in dialogs, tab order, the Levels grid order (level 1 at the top-right).
- Progress bars (fill right to left), the 7-day strip and bar chart.
- Swipeable how-to-play pages.

Does not mirror:

- Game boards, by default. A swipe left moves things left, whatever the language: the board is a physical space, not text. A game can opt in to mirroring if its board reads like text (for example a word game in Persian).
- Logos, icons of objects, clocks and circular progress (always clockwise), play/pause symbols, sheep and robots.

### 7.6 · Fonts

- All fonts are bundled inside the app. Nothing is downloaded (N1).
- A Latin font for en/de, and an Arabic-script font that covers all Persian and Sorani letters, including the Sorani-only ones: ڕ ڵ ۆ ێ ە ڤ. (Chosen: Lilita One and Rubik for Latin, Vazirmatn for fa/ckb, all under the SIL Open Font License.)
- A test page (debug menu) renders every letter and digit in every font. It is checked in screenshots before each release.
- Font licences (free, open licences only) are listed in S11d.

## 8 · Features in detail

### 8.1 · Levels and stars

- Each game defines level packs (v1 target: 3 packs x 30 levels = 90 levels per game, adjustable per game; decision D9).
- Levels are generated from a seed number plus a difficulty, not drawn by hand. The same seed always makes the same level. Where the game allows it, each level is checked by a solver before it ships, so no level is impossible, and the solver also calculates "par" (the best possible result).
- Stars are earned per level from a goal the game defines:
  - Puzzle games: 3 stars at or under par, 2 stars at par +2, 1 star for finishing.
  - Score games: 3 / 2 / 1 stars at score thresholds.
- The best result per level is kept.
- Unlocking: see S8 (levels one after another, packs by stars collected).

### 8.2 · Modes

The Shell supports three modes. Each game switches on the ones that suit it:

| Mode | Rule |
|---|---|
| LEVELS | Always on |
| DAILY | One generated level per day (8.3). On by default |
| ENDLESS | For games with no natural end (for example Line Siege runs): play until you lose, beat your best. Optional per game |

### 8.3 · Daily challenge generation

- The level number comes from today's local date plus the game's own salt, run through the same generator as normal levels, at a medium difficulty.
- Every phone on the same date gets the same level, with no internet. (This makes the daily generator a compatibility contract: a new app version must generate the same level for a past date.)
- Past days cannot be replayed for streaks. There is no archive in v1 (possible later).

### 8.4 · Scoring

The game defines what counts; the Shell stores and shows it: best per level, best per mode, and totals for statistics.

### 8.5 · Undo and hints

- Undo: if the game supports it. The Shell keeps a history of states, and Undo steps back one move (unlimited in puzzle games; the game can limit it).
- Hints: if the game supports it. The game's solver suggests the next good move, and the Shell highlights it. Hint budget: 1 free hint per day, then a rewarded ad per hint, or unlimited with Premium (decision D2).
- Every game states whether it has hints at all. A game without hints (for example Line Siege) shows no hint key on the Game screen and no hint entry in the Pause menu (lead decision L8).

### 8.6 · Saving

- Everything is saved on the phone only: current level state, level results, stars, daily results, statistics, settings, Premium status.
- Saved after every move and every settings change. Writes are "safe writes": write the new copy, then swap, so a crash mid-write never corrupts the save.
- The previous good copy is kept as a backup. A damaged save falls back to it (S14).
- Every save carries a version number. Opening an older save runs the tested upgrade steps (N10).
- The phone's own device backup (iCloud / Google device backup) may include the save, so progress follows a player to a new phone. That is the operating system's feature, not a network request from us (decision D5).
- Real-time games save at declared save points (end of a turn or wave, pause, background), never every frame.

### 8.7 · Sound, music and vibration

- Sound effects for every meaningful event (place, clear, win, lose, button tap), generated as short synthesized sounds during development, or taken from CC0 sources with the licence recorded.
- Music: optional per game; generated or CC0 only. Music is off by default, because no platform API reports whether the player's own music is playing.
- Vibration: short taps on key events (clear, win, lose), off if disabled.
- Audio follows the phone's silent switch where the platform allows, and never plays over the player's own music unless they turn game music on.

### 8.8 · Ads (AdMob)

Formats and where they appear:

- BANNER: bottom of Home, Levels, Statistics only. Never on the Game, Pause, Result, Premium, tutorial or dialog screens.
- INTERSTITIAL (full-screen): only after the player taps Next / Replay / Try again on the Result screen, and only when all of these hold:
  - not Premium, online, consent handled;
  - the tutorial is finished and the player has completed at least 3 levels in total;
  - at least 3 minutes since the last interstitial;
  - at least 2 completed levels since the last one;
  - never twice in a row after losses (a losing player gets a break; read as: two consecutive interstitials may not both follow a loss).
- REWARDED: always the player's choice, with a clear "Watch an ad to..." label:
  - get a hint (when out of free hints);
  - continue once after losing (games that allow it).
  - The reward is given only when the ad completes. If no ad is available (offline), the button is hidden, not broken.

General rules:

- All frequency numbers are configuration values per game, not hard-coded.
- Ad slots never overlap game controls. Accidental taps must be impossible.
- Development and test builds use only Google's test ads, never real ones. Real ad IDs go in the game's configuration.
- Ads are loaded in the background at quiet moments. Play never waits for an ad. A failed load is silent.
- Premium removes banners and interstitials immediately and turns rewarded perks into free perks.
- Ad content filters: no gambling or other sensitive categories, as far as the ad settings allow (set in the AdMob console).
- Audience: the games are rated for general audiences but not designed for children, so the child-directed ad rules do not apply. If a game is ever aimed at children, ads must switch to the child-safe mode (decision D8).
- On iPhone, Apple's tracking permission is asked before the first ad request that could use the advertising ID (S3, spec 4.2; owner decision O1, 2026-09-30). If the player declines, or tracking is restricted, ads still load, without that ID.

### 8.9 · Premium purchase

- One non-consumable product per game ("Premium", EUR 1.99).
- Prices are set in the App Store and Google Play consoles, not in the app. EUR 1.99 is one of Apple's fixed price points, so the App Store uses exactly that, and Google Play uses the same price (decision D3, decided 2026-09-30, owner decision O2). The app always shows the price the store reports, in the player's currency, and never types it into the code.
- Family Sharing stays off for Premium (decided 2026-09-30, owner decision O3). Once Apple's switch is on for a product it cannot be turned off again.
- After a purchase, the Shell stores "Premium = yes" on the phone. From then on Premium works offline forever, without asking the store again.
- When online, the Shell quietly re-checks the purchase with the store at app start and updates the stored status (for example after a refund). Premium is revoked only on an explicit, verified revocation, never because a purchase is briefly missing.
- Restore purchase is required, and is available in S12 and Settings. Reinstalling or a new phone plus Restore gives Premium back.
- No server receipt checks (we have no server). Any check is done on the phone with the store's own tools.

### 8.10 · Continue after losing

- Games may allow one continue per level or run: for example the monsters are pushed back one row, or the last move is undone.
- Cost: a rewarded ad, or free with Premium. Offline and not Premium: no continue.

### 8.11 · Accessibility

- Text grows with the phone's text-size setting up to 200%, and layouts reflow rather than cut off.
- Colour contrast meets the standard guideline (WCAG AA) in light and dark themes: every text reaches at least 4.5:1 against what is behind it, in every state, including a button label while a "hold to confirm" fill grows under it (decided 2026-09-30, owner decision O5; the light `dangerFill` is `#FFDCDF`).
- Nothing important is shown by colour alone (the colour-blind option adds shapes and symbols).
- Screen readers can read and use every menu, button and setting. Game boards give a short spoken summary ("Level 12, 3 monsters, your turn") where practical.
- Reduce motion (settings + phone setting).
- Everything can be played with one hand in portrait.
- Pause any time. No game in this family requires fast reactions during the tutorial.

### 8.12 · Themes and look

- Each game has its own palette and logo, drawn in code, in light and dark versions. The Shell's menus take the game's palette, so every app looks like its game, not like a template.
- One shared type scale and spacing system, so all games feel related.
- Named patterns to avoid: no generic gradient buttons, no emoji as icons, no pill-shaped everything.
- The design step chose the Toybox design system: ink-outlined keys with hard shadows, stickers, and per-game paint. Every built screen must match its Toybox design screenshot (the `toybox-visual-parity` skill checks it).

### 8.13 · Testing hooks

Built into the Shell, used by Claude Code:

- Every game's rules run without the screen: a pure "next state from this state and this move" function. A bot can play thousands of games in seconds to check balance, winnability and difficulty.
- The whole game state can be exported as text (debug menu).
- Randomness always comes from a seed, so any bug can be replayed exactly.
- Screenshots of every screen are captured automatically in all four languages, light and dark, phone and tablet. These are the "does the right-to-left layout look right" check and the store screenshots later.
- An airplane-mode test: the full app, from first launch to finishing levels, runs with the network off, with no errors.
- A network audit: the build fails if any component other than the ads and store components can reach the internet (N3).

### 8.14 · Errors and stability

No crash reporting service (N2). The Shell keeps a small local error log (the debug menu can show it) and recovers where possible: a broken level falls back to Home with a gentle message, never a crash loop.
