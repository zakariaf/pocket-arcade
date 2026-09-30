# The design reference set

What the committed references are, how they were rendered, which frames exist and what each one expects of the app, and the only situations in which the references may change.

## Contents

- What is committed
- How a reference is rendered
- The frames
- Reference variants chosen by game facts
- Masks, floating parts and the fixture values
- Other games, other languages
- When the references change (and when they never do)
- The log of intended reference changes

## What is committed

`assets/reference/lineSiege/<theme>-<lang>/` holds, for light and dark x en and fa (Line Siege, the design's default game):

- `<frame>.png`: the design frame at 1206 x 2622 (tall frames at their full height, state cards at their card height), lossless RGB PNG;
- `<frame>.layout.json`: every testID of the frame with its rect in points, box and rotation, text, accessibility label, computed style (fill, text colour, border, radius, hard shadow, outline, font), plus every text run (one rect per line or bidi run) with its owner and font. It also records the map's metadata for each element at render time (role, component, kind, checks, `parent`, `a11yHidden`, `coveredBy`, mask, state); that part belongs to the map: `check-parity.mjs` reads it from the current `screen-testids.json`, so a metadata fix in the map (a component name, a check) takes effect without a re-render;
- `<frame>--<variant>.png` and `.layout.json` for the three reference variants (next section), next to their base;
- `manifest.json`: the renderer (Chrome version, Playwright version, flags), the device, the sha256 of the four inputs (design copy, testID map, frames manifest, device profile), the frames and variants, the sha256 of every file, and `referenceChanges`, the log of every deliberate change of the set (last section).

32 frames and 3 variants x 4 combinations = 140 renders (128 until 2026-09-30): 20.1 MB of PNG and 2.6 MB of layout JSON. That is more than the 10 MB the owner hoped for, and it cannot shrink without losing information: the PNGs are already written with the smallest lossless encoding measured (no row filter, deflate level 9; adaptive filters were 25 % larger, run-length and filtered zlib strategies 30 to 110 % larger), the frames hold 800 to 2,700 distinct colours (so a lossless 256-colour palette is impossible), and a lossy or quantised reference would destroy the exact fill values the `fill` gate relies on (quantised references in an earlier project forced a 24/255 colour slack).

Open a layout file when a gate fails: it says exactly what the design draws there (for example `border: 3px solid #1D1B3A`, `shadow: rgb(29, 27, 58) 0px 6px 0px 0px`, `font: 400 25px/27.5px Lilita One`).

## How a reference is rendered

`shoot-design.mjs` opens the skill's copy of the Toybox mockup (`assets/design/toybox.html`) in the installed Google Chrome through Playwright:

1. Chrome flags `--force-color-profile=srgb --font-render-hinting=none --disable-lcd-text --hide-scrollbars --disable-gpu`; device scale factor 3 (1 CSS px = 1 pt); reduced motion; time zone UTC. Software rasterisation (`--disable-gpu`) is what makes a re-render pixel-identical.
2. Theme, language and game are set before the page loads through its own `localStorage` keys `pa-toybox.theme`, `pa-toybox.lang` and `pa-toybox.game`; the script checks the page shows exactly those.
3. **Offline.** Every network request is blocked. The design copy differs from the mockup in two ways only (`import-design.mjs` makes and checks it): the Google Fonts links became `@font-face` rules for the exact TTF files the app bundles (`assets/design/fonts/`: Lilita One, Rubik Regular and Bold, Vazirmatn Regular and Bold, the weights the mockup loaded), and strings naming project files were reworded. Both sides therefore rasterise the same glyph outlines, which is why text ink agrees to 0.3 pt.
4. **Parity CSS** turns a showcase phone into the device screen: page zoom 1, no phone bezel or rounded corners, `.scr` 402 pt wide (and 874 tall unless it is a tall frame), the drawn status bar `.sb` 62 pt tall, the drawn home indicator hidden (simulator screenshots have none), every animation and transition at 0 s.
5. **Pinned frame.** The frame is moved to (0,0) with `position: fixed` and clipped. An element screenshot of an in-flow frame came out 1206 x 2625 because of a fractional offset; pinning gives exactly 1206 x 2622.
6. For every testID of the frame, the map's `designSelector` must match exactly one element (the stamp that makes the map self-verifying); the rect, style and text runs are written to the layout file. Elements marked `when` in the map (the Music parts, the two win lines) are measured only in the render whose facts match.
7. **Stable paint.** After the viewport is set, the script waits two animation frames and shoots until two shots in a row agree: under load Chrome once handed back a frame before the pinned card was painted (a blank S12 card on 2026-09-30, caught by `--check` and re-rendered).

`shoot-design.mjs --check` re-renders everything into a temporary folder and fails on any pixel difference or any difference in what a layout measured (`reference-drift`), and on a changed design copy or device profile (`stale-reference`). A changed testID map or frames manifest is judged by the re-render itself and printed as a note: a full check (no `--frame`, `--theme` or `--lang`) whose every frame matches proves the change is metadata only (for example `settings.autosave-note` becoming a `View` row, or the `fixtureSave` block), while a partial check proves only its own frames and says so. The whole set took 40 to 100 s (2026-09-28 and 2026-09-29, depending on load); under heavy load one frame once drifted and matched again on a rerun of that frame, so rerun a lone drift before concluding anything.

## The frames

Keys come from the design's frame captions. "Masked" elements keep their bounds check, pixels skipped; "floating" elements have no bounds check (their position in the mock is illustrative).

| Frame | Screen | Kind | Root testID | testIDs | Masked | Floating |
|---|---|---|---|---|---|---|
| `s1-splash` | S1 | phone | `splash.screen` | 5 | - | - |
| `s2-language-choice` | S2 | phone | `language-choice.screen` | 18 | - | - |
| `s3-consent-moment` | S3 intro | phone | `consent.screen` | 9 | - | - |
| `s3-google-s-form` | S3 google-form | mock-only | - | 0 | - | - |
| `s4-home` | S4 | phone | `home.screen` | 26 | home.banner-ad | - |
| `s4-home-premium` | S4 premium | phone | `home.screen` | 22 | - | - |
| `s6-pause` | S5 paused, S6 | phone | `game.screen` | 30 | game.board | - |
| `s7-result-win` | S7 win | phone | `result.screen` | 15 | - | - |
| `s7-result-lose` | S7 lose | phone | `result.screen` | 12 | - | - |
| `s8-levels` | S8 | phone | `levels.screen` | 93 | levels.banner-ad | levels.locked-toast |
| `s9-daily-challenge` | S9 | phone | `daily.screen` | 49 | - | - |
| `s10-statistics` | S10 | phone-tall | `stats.screen` | 111 | stats.banner-ad | - |
| `s10-statistics-empty` | S10 empty | phone | `stats.screen` | 11 | stats.banner-ad | - |
| `s11-settings` | S11 | phone-tall | `settings.screen` | 121 | - | - |
| `s11a-language` | S11a | phone | `settings-language.screen` | 24 | - | - |
| `s11b-about-and-credits` | S11b | phone | `about.screen` | 29 | - | - |
| `s11c-privacy-policy` | S11c | phone-tall | `privacy-policy.screen` | 23 | - | - |
| `s11d-licences` | S11d | phone-tall | `licences.screen` | 67 | - | - |
| `s12-premium` | S12 | phone | `premium.screen` | 21 | - | - |
| `s12-loading-price` | S12 loading | state-card | `premium.state.loading` | 6 | - | - |
| `s12-store-unavailable-offline` | S12 unavailable | state-card | `premium.state.unavailable` | 7 | - | - |
| `s12-purchase-in-progress` | S12 purchasing | state-card | `premium.state.purchasing` | 6 | - | - |
| `s12-pending-approval` | S12 pending | state-card | `premium.state.pending` | 7 | - | - |
| `s12-success` | S12 success | state-card | `premium.state.success` | 5 | - | - |
| `s12-error` | S12 error | state-card | `premium.state.error` | 7 | - | - |
| `s12-already-owned` | S12 owned | state-card | `premium.state.owned` | 5 | - | - |
| `s12-restore-results-toasts` | S12 restore | state-card | `premium.restoring-toast` | 4 | - | - |
| `s13-how-to-play` | S13 | phone | `how-to-play.screen` | 14 | - | - |
| `s14-reset-all-progress` | S14 reset-progress | phone | `reset-progress-dialog.scrim` | 9 | - | - |
| `s14-restart-to-apply` | S14 restart | phone | `restart-dialog.scrim` | 8 | - | - |
| `s14-progress-restored` | S14 save-restored | phone | `save-restored-dialog.scrim` | 7 | - | - |
| `s15-debug-menu` | S15 | phone-tall | `debug.screen` | 57 | - | - |

Reference variants (next section): `s11-settings--no-music` (phone-tall, 114 testIDs), `s6-pause--no-music` (phone, 26), `s7-result-win--score` (phone, 15).

- **phone**: the full 402 x 874 screen; compared at the same position.
- **phone-tall**: the design shows the full scroll height; the app keeps the top bar fixed, scrolls the body under it and pins the banner (S10) to the bottom of the screen. `run-parity.mjs` captures at 0, the end of the scroll, and as few offsets between as it takes for every body element to be fully on screen once (for example S11 light-en: 0, 573, 1170, 1200); `check-signoff.mjs` demands that coverage.
- **state-card**: a fragment of S12 in one state, compared by text, fill, border, ink and crop only.
- **mock-only**: Google's UMP consent sheet; the Shell does not draw it, so it is looked at, never captured.
- The app state each frame shows (level 12, streak 5, the premium states and so on) is written in `assets/frames.json` under `frames.<key>.state`; read it before building the harness plan for a frame.

## Reference variants chosen by game facts

A frame whose design state depends on what the game has gets reference variants; the base reference stays. The mockup draws the facts in `assets/frames.json` `designFacts` (Music on, a moves-rated win line), and `frames.<key>.variants` names each variant with `when` (the facts it stands for), `derive` (the DOM change `shoot-design.mjs` makes on the rendered mockup before it measures and shoots), `reason` (the lead decision) and `state`:

- `s11-settings--no-music` (L1): the Music switch row and the Music volume row get `display: none`, so the rows below close up as a flex column lays them out.
- `s6-pause--no-music` (L1): the Music key gets `display: none` and the key row becomes two equal columns (`grid-template-columns: repeat(2, minmax(0, 1fr))`), as the app's `usePairLayout` shares the row.
- `s7-result-win--score` (L3): the moves line's text becomes the Shell key `result.win.score-line` with score and best 1,840 ("Score 1,840 – best 1,840"; de "Punkte 1.840 – Rekord 1.840", fa and ckb with Persian digits). The four texts are kept in the variant, and the numbers are formatted exactly like the mockup's own `N()` (Intl.NumberFormat with the deck's `numberLocales` tag); the script proves it by formatting the win card's score the same way.

A variant is derived from the rendered mockup, never hand-drawn and never an edit of the design copy, so `import-design.mjs --check` stays green. Hidden elements stay in the DOM, so the positional selectors of their siblings still match. The map marks the parts that exist only for some facts with `when` (`{"hasMusic": true}` on the Music parts, `{"winLine": "moves"}` on `result.score-card.moves-line`, `{"winLine": "score"}` on `result.score-card.score-line`); `check-testids.mjs` skips a part the mockup does not draw.

Captures pick the reference from the app's facts in `parity/game-facts.json` (parity-harness.md, "Game facts"); `run.json` records the variant used, and `check-parity.mjs` and `check-signoff.mjs` refuse a run captured against another reference (`reference-variant`).

## Masks, floating parts and the fixture values

- Always masked: the top 62 pt and the home-indicator strip (`assets/device/iphone16pro.json`, `masks`).
- Masked by the testID map (`mask: true`): the ad banners (a 320 x 50 placeholder in the design) and the game board (a dashed placeholder; the board's pixels are proven by the board goldens of `board-rendering-skia`).
- **Behind a modal layer** (`s6-pause`, `frames.<key>.modal`): the paused Game screen under the modal Pause dialog is not in the accessibility tree, so its elements are compared inside the root's crop (crop-only) and the frame is reached through `pause.dialog`.
- **The board of a Game-route frame** (s6-pause and the S7 frames, `frames.<key>.board`): each game brings its own board, so parity compares only the Shell chrome and the overlays. The mask is the union of the board rectangle the game reports (`capture-app.mjs`'s probe=board launch, `run.json` `board`) and the reference's `game.board` rectangle, filled with one grey in both images before the pixel gates, minus the painted shapes of the elements drawn over it (`board.above`: the Pause dialog; the Result screen covers everything, so S7 masks nothing). Elements wholly inside the mask are skipped with a `masked` note; elements that cross its edge are gated.
- The design's fixture values (`assets/frames.json`, `fixture`): date Sunday 27 Sep 2026, current level 12, score 1,840, best endless 4,210, streak 5 days (best 12), 7 moves with par 7, price €1.99 in en (`€۱٫۹۹` in fa), version 1.0.0 (8), support@example.com, the level stars, week marks and statistics, and each design game's own stats.
- The same player as save-document sections (`assets/frames.json`, `fixtureSave`): the levels won with their stars and scores, the level-12 run reference, the daily results and streak, the statistics and the 7 days, each design game's counters by counter id, the settings (volumes as integer percent), consent, the Premium dates, the store price and currency, the build number. The harness template `parity-fixture-save.json` is a copy and writes exactly this through the save service (parity-harness.md), so every number on screen matches the reference.

## Other games, other languages

- The committed set is Line Siege in en and fa, the minimum every screen must pass. For Flock Tilt or Scrap Shove (the other design games), or for de and ckb before a release, render references on demand into the app repo: `node ${CLAUDE_SKILL_DIR}/scripts/shoot-design.mjs --out .parity/design --game flockTilt --lang de,ckb`, and pass `--reference .parity/design` to `check-parity.mjs` / `run-parity.mjs` / `check-signoff.mjs`.
- A game that is not in the design has no reference of its own: its Shell screens are proven in the Line Siege app (the Shell is shared code) and its palette by the `toybox-design-system` checks; its screens still get a look pass.

## When the references change (and when they never do)

- **Never to make a screen pass.** A reference is the owner's design; changing it to match the app is the one thing this skill exists to prevent.
- **Not for a metadata fix in the testID map or the frames manifest.** Change the map (in the skill library's shared copy, then sync) or the manifest, run `check-testids.mjs`, then a full `shoot-design.mjs --check`: when every frame matches, the references stay as they are.
- **Only after the owner (or the lead, for the owner) changes the design on purpose**: add the entry to the log below first, then `node ${CLAUDE_SKILL_DIR}/scripts/import-design.mjs <new toybox.html>`, then `check-testids.mjs` (the selectors may have moved), then `shoot-design.mjs --update-reference`, then `shoot-design.mjs --check`. Say in the owner report that the references changed and why.
- **After a renderer change** (a new Chrome or Playwright, a new font file): `shoot-design.mjs --check` names every frame whose pixels moved. Look at the differences; update the set only when the cause is understood, and say so in the report.

## The log of intended reference changes

Every deliberate change of the committed references is an intended reference change, recorded in `assets/reference/lineSiege/manifest.json` as `referenceChanges`: `[{ "id", "date", "frames", "variants", "what", "why" }]`. It is never a waiver (a waiver accepts a difference the app shows; a change entry says the reference itself moved on purpose). `shoot-design.mjs --update-reference` keeps the log, `--check` validates it (rule `reference-changes`), and `check-signoff.mjs` prints the entries of every frame it signs off, so they reach the owner report.

| id | date | frames / variants | what |
|---|---|---|---|
| P-8 | 2026-09-29 | every frame | every layout.json and the manifest re-rendered; all 128 PNGs byte-identical |
| L1 | 2026-09-30 | s11-settings, s6-pause; `s11-settings--no-music`, `s6-pause--no-music` | new variants for a game without music (base references unchanged) |
| L2 | 2026-09-30 | s8-levels | Persian level numbers at line height 1.45 (fa renders changed) |
| L3 | 2026-09-30 | s7-result-win; `s7-result-win--score` | new variant with the score line for score-rated games |
| L4 | 2026-09-30 | none | design input only: Line Siege's how-to-play and tutorial step 4 reworded; no frame draws step 4 (S13 shows step 2), no pixel changed |
| L5 | 2026-09-30 | s11-settings; `s11-settings--no-music` | the settings footer's version line without the mockup's 6 px flex gap |

The L1 to L5 changes were approved by the lead on 2026-09-30 and re-rendered once (Chrome 154, `--update-reference`); `shoot-design.mjs --check` then passed on all 140 renders.
