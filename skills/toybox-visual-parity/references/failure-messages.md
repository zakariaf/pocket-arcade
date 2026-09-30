# Failure messages: what they mean and what to fix

Every `FAIL` line has the form `FAIL <file> [<rule>] <message> Fix: <fix>`. This table goes one step further: the usual real cause. Fix problems in the order they are listed per run (the scripts sort them that way), rebuild, capture, check again.

## Contents

- check-parity.mjs (the gates)
- Where the design's numbers are: layout.json and the mockup CSS
- capture-app.mjs and run-parity.mjs
- setup-parity-sim.mjs
- make-sheet.mjs and check-signoff.mjs
- check-harness.mjs
- shoot-design.mjs, import-design.mjs and check-testids.mjs
- When the same failure survives three fixes

## check-parity.mjs (the gates)

| Rule | Means | Usual real cause | Fix |
|---|---|---|---|
| `capture-size` | the capture is not 1206 x 2622 | captured on another simulator or device | `setup-parity-sim.mjs`, then capture with `capture-app.mjs` |
| `screen-not-reached` | the frame's root testID is not on screen (for `s6-pause`, neither the root nor `pause.dialog`, which reaches the frame while the modal Pause hides the Game screen) | the harness ignored or rejected `-parity`; a system alert in front; the root testID sits on an inner view or is missing; the frame's opener is missing (check-harness `harness-opener`) | read the labels the message lists; fix the harness plan, the opener or the root testID; never use deep links |
| `scroll-mismatch` | a tall frame's capture is not scrolled where `scrollY` asked | the harness ignores `scrollY`; the scroll ran only from `onContentSizeChange` (the first layout happens before the safe-area insets arrive, so the frame is too tall and iOS clamps the offset: S11 stuck at 1104.7 of 1170, and no later event scrolls again); the scroll is animated or scrolls another view | let `ScreenBody` scroll (it scrolls from both `onContentSizeChange` and `onLayout`, without animation) and pass `scrollY` through the harness root (`ScreenScrollTargetContext`); never scroll from the harness |
| `reference-variant` | the run was captured against another reference than the one the app's game facts select (base vs `--no-music` or `--score`) | the facts file changed after the capture, or the run was captured by hand without the facts | capture again with `run-parity.mjs` / `capture-app.mjs` (they read `parity/game-facts.json`); fix the facts file if it is wrong for the game (its test pins it to the module) |
| exit 2 "the game facts file ... does not exist" / "... compares app X with design game Y" / "... cannot be chosen" | a frame with reference variants (s11-settings, s6-pause, s7-result-win) and no usable `parity/game-facts.json` | the file was never copied, names another design game, or lists several apps | copy `templates/parity/game-facts.json`, fill in the app's facts, pass `--app <id>` when it lists several; a reference is never guessed |
| exit 2 "run.json has no board rectangle" | a Game-route frame (s6-pause, s7-*) captured without the probe=board launch | a hand-made or old run.json; `--no-hierarchy` | capture it with `capture-app.mjs`, which probes the board first |
| `duplicate-testid` | two app elements carry one testID | a copied component kept its testID; a list used an index-free but non-unique key | give each element its own testID (`<scope>.<element>.<key>`) |
| `missing` on the Music rows (`settings.music-switch`, `settings.music-volume-row`, `settings.music-volume-slider`) or `pause.music-switch` | Music rows missing on a game without music: the no-music variant was not picked | `parity/game-facts.json` says `hasMusic: true` for a game whose sound bank has no music (or the run predates the facts) | check `parity/game-facts.json` (its test, `parity-game-facts.test.ts`, pins it to the module), then capture again: the facts pick `s11-settings--no-music` and `s6-pause--no-music`. Never waive a `missing` Music row |
| `missing` or `text` on `result.score-card.moves-line` / `score-line` | the win line of the reference is not the game's | the facts' `winLine` is wrong, or the app's ScorePanel derives the wrong testID | score-rated levels (par null) show `result.score-card.score-line` ("Score 1,840 – best 1,840", reference `s7-result-win--score`); moves-rated ones `result.score-card.moves-line` |
| `missing` | a reachable design element's testID is not in the app (crop-only parts, `parent` or `a11yHidden` in the map, are never reported missing) | not rendered; testID on the inner Text of a Pressable (Maestro hides children of accessible elements); a reachable element placed inside a part hidden from VoiceOver; state differs (Premium, endless); a `*.banner-ad` slot collapsed because the harness did not supply the stand-in banner | render it, move the testID to the accessible element, keep hidden decoration out of reachable containers, check the harness state (parity-harness.md step 7 for banners) |
| `bounds` | an element is more than 2 pt off in x, y, width or height | padding, gap, min-height, border width, margins, safe-area inset, a wrong font making text taller; an internal gap that exists only in the mockup CSS; a position set by a transform (Maestro and VoiceOver report the layout frame, so a key sunk by `translateY` measures 3 pt high) | read the design style in the reference `.layout.json` and the element's CSS in the mockup (next section); move anything that stays moved by layout, never by a transform; fix the first failing element from the top, since its error pushes everything below it |
| `text` | the label differs from the design text | wrong copy-deck key, wrong fixture value, different punctuation or spaces, an accessibility label that is not the visible text | use the design's key and the frame's fixture values |
| `fill` | the element's main colour is off by more than 3/255 | a hard-coded colour, the wrong token (surface vs sunken), the wrong theme or game palette, an opacity | use the theme token that paints the design's hex (named in the message) |
| `border` | a side the element draws is thicker, thinner or another colour (a side the layout draws without a border, such as a group tab's bottom, is not compared) | `borderWidth` 2.5 where the reference renders 2 (`check-harness.mjs` rule `component-border` names the spec), the border on a wrapper, a missing side | use the design border (named in the message) on every side it draws |
| `text-ink` | a text's ink is wider, narrower, taller, moved past its role's limit (the message names it: "limit 2.3 pt for Rubik 14"), or missing in the text colour ("has no ink ... (text colour #1D1B3A)") | font family or weight wrong (Rubik vs Rubik-Bold, a synthesised bold), size, letter spacing, wrapping, alignment, padding, line height (the role's ratio: 1.25 where the design has 1.32); an internal gap from the mockup CSS (a check glyph or preview inside a segment); the wrong colour token | compare the run's `font` in the `.layout.json` with the type role the app uses, then the element's CSS in the mockup; use the design's text style through the type role; never nudge glyphs with a translate or padding. A Persian mark drawn narrower by CoreText (madda) is a `platform-text-shaping` waiver, not a fix |
| `structure` on a dashed edge (the locked level tiles 14 to 30, `levels.pack.2`, `result.continue-offer`) or on `levels.level-tile.13` | the dash pattern differs, or the mockup's tile 13 is mid-press | React Native's iOS dash length and phase; `.lt.is-pressed` in the mockup | open the crop: when only the dash pattern (or the press squash of tile 13) differs, copy the pre-listed waiver from `templates/parity/waivers.json` (signoff-and-waivers.md, "Pre-listed waivers"); a missing or thicker dashed edge is still a fix |
| `structure` | a shape difference at least 1.5 pt thick inside an element ("inside its crop-only part X" when it sits on a part the element covers) | missing or wrong icon, radius, hard shadow offset, cut ring, missing child, wrong picture; a part clipped by a scroll view (S4's tilted tagline sticker is the body's first block: its high corner and die-cut ring rise about 8 pt above its box and were cut flat along the top bar, "difference ... at the element's top"); for a crop-only part: the hidden logo, icon tile or art is missing, moved or drawn differently | open `crops/<testID>.png`; match the icon path, radius, shadow or spacing; give a tilted first block overhang room (`ScreenBody hasTopOverhang`) instead of letting the scroll view clip it; for a named crop-only part fix that part (it has no bounds of its own to measure) |
| `reference-missing` | no reference for this frame, theme, language or game | a game or language outside the committed set | render it with `shoot-design.mjs --out .parity/design ...` and pass `--reference .parity/design` |
| `reference-mismatch` | run.json names another frame, theme or language than the reference | a hand-edited run.json or reference path | capture again with `capture-app.mjs` |
| `bounds-missing` | the run has no element bounds | the hierarchy dump failed or was skipped | capture again (Maestro and Java 17 installed) |
| `waiver-invalid` | the waiver file is malformed or tries to change a number | an extra field, a wildcard testID, a short reason, no report date, an unknown `class`, a `platform-text-shaping` waiver on another rule than `text-ink` or without `glyphs`, a `design-artefact` waiver without the CSS in `designCause` or on `missing` | fix the entry (see [signoff-and-waivers.md](signoff-and-waivers.md)) |

## Where the design's numbers are: layout.json and the mockup CSS

- The reference `<frame>.layout.json` holds each element's box, text runs and computed style (fill, text colour, border, radius, shadow, font). Read it first for any `bounds`, `fill`, `border` or `text-ink` failure.
- **Internal gaps and padding are not in it.** A gap between an icon and its label, between a check glyph and a segment label (`.sg-l{gap:0 3px}`), between a segment face's two lines (`.seg>span{gap:1px}`), or a pad inside a chip exists only in the mockup's CSS: open `assets/design/toybox.html`, search the element's class (the `designSelector` in `check-testids.mjs --list <S-id>` names it) and read its rules. Do this whenever a label sits off inside a correctly placed element (`text-ink` "moved", `bounds` of a child) and the layout file shows nothing wrong. A number found this way belongs in the component or its specs (the `toybox-components` skill), as a named constant: add it to the commented `MOCKUP_OVERRIDES` table in toybox-components' `scripts/lib/component-source.mjs` (where the mockup CSS differs from the tokens, for example groupTab marginStart 0 and segmentedControl faceGap 1) and regenerate `component-specs.json` with `write-component-specs.mjs`, so the component reads it from the specs.
- If the CSS itself draws something the product does not mean (the mockup holds tile 13 of S8 mid-press with `.lt.is-pressed`), that is a `design-artefact` waiver plus a question to the owner, never a copy of the artefact in the app. When the owner or the lead fixes the mockup instead (as with the S11 footer's old 6 px version gap, 2026-09-30), the references are re-rendered and logged as an intended reference change, and the waiver goes.

## capture-app.mjs and run-parity.mjs

| Rule | Means | Usual real cause | Fix |
|---|---|---|---|
| `unstable` | no two screenshots 300 ms apart were the same within the settle time | a loop or entrance that ignores `useReduceMotion` (every parity capture freezes motion through `isParityMotionFrozen()`, the one frozen-motion switch that `app/use-reduce-motion.ts` honours), a timer, a loading state, a blinking caret | route the loop or entrance through `useReduceMotion()` (never a parity-only branch); stop timers in parity mode; raise `--settle-ms` only for a slow first launch |
| `board-probe` | the probe=board launch of a Game-route frame showed no usable `game.board-layout` | `isParityBoardProbeOn()` is not wired into the host's `isLayoutProbeOn` closure, or the board host does not render the probe | wire it (game-host-integration's `create-shell-parts.ts`), rebuild, capture again |
| `changed-during-capture` | the screen changed during three hierarchy dumps in a row | a timer, a polling spinner, a toast that times out | stop it in parity mode |
| `screen-not-reached` | as above, found before the comparison | as above | as above |
| `capture-size` | as above | as above | as above |
| `not-captured` (run-parity `--recheck`) | no run folder to re-check | the run was never captured | run without `--recheck` |
| exit 2 "the e07-parity simulator is not booted" | the parity simulator is off | a reboot, or never set up | `setup-parity-sim.mjs --appearance light` |
| exit 2 "the app did not launch" | `simctl launch` failed | the test build is not installed, wrong bundle id | install the Release test build; check `--bundle-id` |
| exit 2 "Maestro is not installed" / "did not print JSON" | no hierarchy | Maestro or Java 17 missing, driver stuck | install per the `e2e-maestro` skill; rerun once (the first call reinstalls the driver) |
| `screen-not-reached` with labels of another app or screen, while the simulator shows the right frame | the hierarchy came from another session's simulator | two sessions share Maestro's default driver port 22087, so a hierarchy call can be answered by the other session's driver | one parity simulator per session: `setup-parity-sim.mjs --name e07-parity-<key>`, then `run-parity.mjs --name e07-parity-<key> --driver-port <free port>` (or `PARITY_MAESTRO_PORT`) |
| exit 2 "driver port ... is not a port number" | `--driver-port` or `PARITY_MAESTRO_PORT` is not 1024 to 65535 | a typo | pass a free port such as 22187 |

## setup-parity-sim.mjs

| Rule | Means | Fix |
|---|---|---|
| `sim-missing` | no e07-parity simulator (check mode) | run without `--check` |
| `sim-not-booted` | it exists but is shut down | run without `--check` |
| `sim-wrong-model` | a device named e07-parity is another model or iOS version | `--recreate`, or delete it (`xcrun simctl delete <udid>`) |
| `sim-duplicate` | several devices carry the name | delete the extra ones |
| `sim-locale` | the system locale is not en_US (24-hour clock) | run without `--check` (sets it and reboots once) |
| `sim-status-bar` | no status bar override (cleared by every reboot) | run without `--check` |
| `sim-appearance`, `sim-content-size`, `sim-increase-contrast` | appearance, text size or contrast differ | run with the wanted `--appearance` |

## make-sheet.mjs and check-signoff.mjs

| Rule | Means | Fix |
|---|---|---|
| `stale-report` | report.json belongs to another app.png or reference, or was written by an older check-parity.mjs (problem rects without `viewRect`, so a scrolled capture would crop the wrong design element) | run `check-parity.mjs` again, then `make-sheet.mjs` |
| `no-sheet`, `stale-sheet` | sheets missing, older than the report, or edited since | run `make-sheet.mjs` again and look again |
| `not-captured` | a required theme x language has no run | capture it (`run-parity.mjs` does all of them) |
| `reference-variant` | a run was captured against another reference than the game facts select | capture again with `run-parity.mjs` |
| `not-checked`, `not-passing` | no report, or a failing report | run `check-parity.mjs`; fix the app |
| `not-a-capture` | the run is not a simulator capture of the app | capture the app; never copy the reference in |
| `not-looked` | no ledger entry, or images missing from `looked` | read every sheet image, then add or complete the entry (`--draft`) |
| `looked-at-old-sheet` | the entry is for an earlier sheet | look at the new sheet, update the entry |
| `eye-check-open` | an eye check is not answered | compare that aspect, answer `match`, `n/a` or `waived: <reason>` |
| `difference-open` | the look found something still open | fix it (then capture, check, sheet, look again) |
| `coverage` | a tall frame's element was never fully on screen (between the top bar and the end of the body) | capture the offsets `run-parity.mjs` plans, or add one with `capture-app.mjs --scroll <pt>` |
| `waiver-gone` | a report relied on a waiver that was removed | run `check-parity.mjs` again |
| `ledger-invalid` | parity/signoff.json is malformed (also with `--draft --from-ledger`) | start from `templates/parity/signoff.json` |
| `stale-sheet` (with `--draft`) | the sheets were made before the latest check, or changed since | run `make-sheet.mjs` again, look at the new sheets, then draft |
| `waiver-invalid` | as for check-parity: the waiver file is malformed | fix the entry |

## check-harness.mjs

| Rule | Means | Fix |
|---|---|---|
| `harness-missing` | a harness file does not exist | copy it from `templates/packages/shell/src/app/parity/` (or `templates/packages/shell/src/app/parity-startup.tsx`) |
| `harness-fixture` | `parity-fixture-save.json` differs from the frames manifest's `fixtureSave` (the message names the first differing path) | copy the template again; the player's numbers come from it, so it is never edited to make a frame pass |
| `harness-typed-price` | a harness file types a price (`'€1.99'`) | take price and currency from the fixture's `store` block and let the Shell format them, as the template does |
| `harness-not-wired` | nothing in the Shell calls one of the startup steps (`readParityLaunch`, `applyParityData`, `parityStorePort`, `parityAdsPort`, `initialStateFor`, `withParityRoot`, `isConsentMomentHeld` for S3), `use-reduce-motion.ts` does not honour `isParityMotionFrozen()`, or nothing honours `isParityBoardProbeOn()` | call it where parity-harness.md "What a parity launch does" says (start-shell, the composition root, the consent moment host, `useReduceMotion`, the host's `isLayoutProbeOn`) |
| `harness-session` | `parity-session.ts` does not export a member the hooks and hosts need (`isParityMotionFrozen`, `isParityBoardProbeOn`, `parityGameFixture` ...) | copy the template `parity-session.ts` |
| `harness-opener` | the hook that owns a frame state does not open it (nothing in it or a `use-*.ts` helper next to it reads `parityFrameState()` or `useParityOpener()` and names `'<state>'`), or the plans name an unknown state | add the opener to that hook, applied once on mount through the handler a tap would use, with its test (parity-harness.md, "Frame states and who opens them") |
| `harness-game-facts` | `parity/game-facts.json` is missing, malformed, lacks a game app, or disagrees with the app's `parity-game-facts.test.ts` or plainly with the module (a music sound with `hasMusic: false`, a score stars rule with `winLine: "moves"`) | copy `templates/parity/game-facts.json` and the facts test; set both to the game's facts |
| `component-border` | `component-specs.json` holds another edge width than the references draw (for example `groupTab.border 2.5` where every layout says `2px solid`), or does not exist | regenerate the specs with the `toybox-components` skill (as-rendered widths: a CSS border of 1 px or more renders floored); never edit the references |
| `harness-frame-missing`, `harness-frame-unknown`, `harness-frame-duplicate` | the plans do not list exactly the design frames | one `plan(...)` per frame of `assets/frames.json` (mock-only excluded) |
| `harness-root` | a plan's root testID differs from the frame's | use the frame's root testID |
| `harness-tall` | the tall flag disagrees with the design | tall frames: S10, S11, S11c, S11d, S15 |
| `harness-parser`, `harness-launch-arg` | the parser is missing, does not accept `probe=board`, or reads another launch argument | copy the templates; the argument is `parity`, read through `Settings` |
| `harness-not-exported` | test-only-entry.ts does not export a harness member (the message lists them) | add each export, tagged `/** @public */`, and the `TestOnlyApi` member of the same name (copy the shared pair from `templates/packages/shell/src/app/`) |
| `harness-leak` | a runtime file (not a test) imports the harness by value | reach it only through `TEST_ONLY` and `parity-startup.tsx`; the plan comes with the request (`request.plan`) |
| `harness-not-called` | no runtime file calls `TEST_ONLY?.readParityRequest()` | read the request in the Shell's startup and apply its plan (parity-harness.md) |
| `harness-gitignore` | `.parity/` is not ignored | add the line `.parity/` |

## shoot-design.mjs, import-design.mjs and check-testids.mjs

| Rule | Means | Fix |
|---|---|---|
| `reference-drift` | a re-render differs from the committed set (pixels, or what was measured in a layout) | find the cause (renderer, fonts, design, a map change that reaches a reference); update only for a deliberate, understood change. A single frame drifting once under heavy load and not again on a rerun of that frame is renderer noise; rerun before concluding anything |
| `stale-reference` | the design copy or the device profile changed since the set was rendered | if deliberate: `--update-reference` and say so; else restore the input. A changed testID map or frames manifest is a note instead: the re-render judges it (a full `--check` that matches every reference proves the change is metadata only; a partial one proves only its frames) |
| `offline`, `fonts`, `design-error`, `design-state` | the design copy loaded something, a font failed, the page threw, or it did not take the theme, language or game | `import-design.mjs --check`; `sync-shared.mjs` for the fonts |
| `frame-selector`, `frame-caption`, `exactly-one-match`, `render-size` | the testID map no longer fits the design | run `check-testids.mjs` and fix the map (shared: in the skill library) |
| `variant-derive` | a reference variant's DOM change did not apply: a `derive` selector matched no element or several, a text step left a placeholder, or the variant's number format disagrees with the mockup's own | fix `frames.<key>.variants.<id>.derive` in `assets/frames.json` (each step matches exactly one element of the rendered frame) |
| `reference-changes` | the manifest's `referenceChanges` log is malformed (a date, an unknown frame or variant, a short what or why) | fix the entry: `{ id, date, frames, variants, what, why }` |
| `copy-drift`, `copy-missing` | the design copy is not a fresh import | never hand-edit it; re-import with `import-design.mjs` |
| `font-link-missing`, `font-families`, `leftover` | the new mockup's fonts or text cannot be imported cleanly | update `scripts/lib/design-import.mjs` and the shared fonts together |

## When the same failure survives three fixes

Stop looping. Report it to the owner with the run's `sheet.png` and the element's crop, what was tried, and a proposal (fix, waiver, or a design question). Never change a tolerance, a mask or a reference to end the loop.
