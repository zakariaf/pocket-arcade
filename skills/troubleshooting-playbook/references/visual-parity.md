# Visual parity and screenshots

What goes wrong when comparing built screens with the Toybox design screenshots. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Comparison
- Design capture
- Lessons
- App capture
- Process
- References
- Frame states
- Layout
- Digits
- Sign-off ledger

## Comparison

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-global-diff-gate` | A 1 pt shift, a lighter weight or a wrong string passes a pixel-percentage gate; a colour change is invisible in the heatmap | Global pixelmatch % and SSIM noise floors (0.13-0.51 %, 0.983-0.995) overlap real defects; threshold 0.1 misses #1F5FBF -> #3B6FD0 | Gate per element by testID: geometry ±2 pt, exact strings, fill Δ≤3 per channel, text ink metrics, aligned crop structure; report global numbers only | verified | `toybox-visual-parity` |
| `parity-full-screen-blobs` | A correct Persian screen fails a full-screen structural diff | Sub-point rounding adds up to a 1 pt drift further down the screen | Compute structural diffs per element after an alignment search (±6 px), blobs ≥1.5 pt | verified | `toybox-visual-parity` |
| `parity-line-height-offset` | Text sits up to 1.7 pt lower than in the design | RN line-height placement differs from CSS half-leading | Allow ±2 pt on text position; check ink width and height at ±1 pt | verified | `toybox-visual-parity` |
| `parity-tall-screen-offsets` | A correct tall screen (S10, S11, S15) fails parity at every scroll offset except 0 | The fixed top bar covers scrolled content, and the banner is pinned to the screen bottom while the design draws it at the end of the page | Use the current toybox-visual-parity (frame geometry and scroll plan); run-parity chooses the offsets | verified | `toybox-visual-parity` |
| `parity-dashed-edge-structure` | check-parity fails [structure] with 1-2 pt blobs at the corners of dashed edges: the locked level tiles and the locked pack panel on Levels (S8), the continue-offer box on Result (S7); a dashed-edge structure difference that no style change removes | React Native on iOS draws borderStyle dashed with its own dash length and phase, and no style sets them, so the dashes never line up with Chrome's | Copy the pre-listed platform waiver for that element (class platform, rule structure, the cause above) from toybox-visual-parity's templates/parity/waivers.json into parity/waivers.json (check-parity's fix text names the entry), in a commit with a Gate-Change: trailer, and name the waivers in the owner report; never redraw the edge in Skia and never widen the tolerance. A structure failure on a solid edge is a real difference | verified | `toybox-visual-parity` |
| `parity-persian-level-digits-clipped` | Levels (S8) in fa or ckb fails [text-ink] on every level number (ink height 10.0 vs design 14.0): the tops of the Persian digits are cut off on the device | A line height of 1.0 clips Vazirmatn's tall digits on iOS, while Chrome lets them overflow the line box | The levelNumber role's Persian line height is 1.45 in the tokens (and the references were re-rendered with it); copy the current type roles from toybox-design-system and rerun; never waive clipped digits | documented | `toybox-design-system` |
| `parity-persian-overflow-high` | Persian text sits up to 3 pt high, or the tops of Persian digits are clipped (text-ink ink height 17.7 vs 20.7 on tight number lines), on S9, S10 and S12 in fa | iOS puts all of a line's overflow above the line box and clips the Text at its frame, while Chrome centres it; Vazirmatn's content box is 1.5625 em, so every Arabic-script line overflows | Copy toybox-components' current AppText: it wraps Arabic-script text whose half overflow h is 1.5 pt or more in a View that keeps the design line box and carries the testID, and gives the Text paddingTop ceil(h)+h, paddingBottom ceil(h)-h and marginVertical -ceil(h) | verified | `toybox-components` |
| `parity-quiet-underline` | Underline ink width or position fails on every quiet button (the nudges of S11d, S12 and S13) | iOS draws textDecorationLine underline 1 pt thick at its own depth, while the design's .quiet has text-decoration-thickness 2px and text-underline-offset 5px | Copy toybox-components' current quiet-button.tsx and nudge style: no textDecorationLine; the button draws a 2 pt bar at the design's depth under the text (from each face's ascent) | verified | `toybox-components` |
| `parity-display-balance-digits-baseline` | Two-line titles break elsewhere than the design (S14 fa, S11c), proportional Persian digits (ink 12 vs 20.3 pt for ۱۱), or stat values 8 pt low (S10 fa) | The design balances every display text (text-wrap: balance), uses tabular digits for stat values (font-variant-numeric: tabular-nums) and aligns stat rows on Chrome's baselines; iOS wraps greedily, draws proportional digits and reports another baseline when Persian text overflows | Copy toybox-components' current AppText (balanced wrap for the display face, useBalancedWrap), the type styles' isTabular (fontVariant tabular-nums on number and statValueCompact) and StatList's baseline arithmetic (ui/text-metrics.ts, use-chrome-baseline.ts) | verified | `toybox-components` |
| `parity-pause-mode-line-high` | S6 Pause in Persian: pause.mode-label box 4.7 pt above the design (dy -4.7) while its glyphs match; or, after a baseline fix, the mode line sits level with the title top (dy -10.5 en, -13.7 fa) | Yoga's alignItems 'baseline' reads the title's baseline through AppText's Persian overflow-guard pads, so the fa mode line lands 4.7 pt high; and in the header's wrapping row (flexWrap: 'wrap') iOS ignored a marginTop on the item, so a Chrome-baseline drop written as a margin did nothing | Copy toybox-screens' current pause-view.tsx: the header row is alignItems 'flex-start', and each text sits in a View whose paddingTop is the difference of useChromeBaseline('title') and useChromeBaseline('body') (9.83 pt in en, 12.5 pt in fa at 3x; design 10 and 13); pause-view.test.tsx pins both | verified | `toybox-screens` |
| `parity-balanced-wrap-stalls` | Balanced wrap never settles: a display text keeps its greedy line breaks on the device (S11c en stuck at 4 lines, the design has 3) while its Jest tests pass | onTextLayout and onLayout arrive in one batch, so a closure-based setState loses one of them; React Native sends no onTextLayout when a new width lays out the same lines, so a bisection that probes a wider width waits forever | Use toybox-components' ui/use-balanced-wrap.ts: functional state updates, every probe narrower than the widest kept line, back to the last kept width after a failed probe, and layouts wider than the room dropped | verified | `toybox-components` |
| `parity-sliver-counts-missing` | [missing] for an element with only a few points on screen (S11c fa at scroll 0: privacy-policy.section.backup.body starts at y 869 of 874) | The iOS accessibility snapshot leaves out an element with a 5 pt sliver on screen, while the gate expects every element that starts above the body bottom | Use the current toybox-visual-parity gates, where an element with less than a few points on screen counts as off-screen (it is checked whole at the next scroll offset); with an older gate, a platform waiver (missing, that language) with this cause | verified | `toybox-visual-parity` |
| `parity-hold-fill-short` | S14 reset: the held danger fill ends 16 pt short (structure fails in en and fa) | The fill is an absolute child with width 46%; Yoga resolves the percentage inside the face's padding (46% of 278 pt), while the design's .hf takes 46% of the key's padding box (310 pt) | Copy toybox-components' current hold-button.tsx: the fill sits in an absolute track pinned to the face edges and takes the percentage there | verified | `toybox-components` |
| `parity-text-ink-neighbour` | text-ink reads a neighbour's dots: a Persian value's ink height doubles (S10 fa "×۶": 29 vs 15.7 pt), or text hidden behind a dialog card is still ink-checked | A Chrome text run of a Vazirmatn line is 1.5625 em tall, so its ink window (+2 pt) reaches into the next element and counts that label's dots, which drop out in the app when the neighbour sits 1 pt lower; runs covered by the dialog are measured too | Use the current toybox-visual-parity gates (the ink window clipped to its own element, runs covered by .dlg skipped, state cards compared without position); with an older gate, a platform waiver with this cause | verified | `toybox-visual-parity` |

## Design capture

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-fractional-frame` | A design screenshot comes out 1206x2625 instead of 1206x2622 | An element screenshot of an in-flow frame sat on a fractional CSS offset | Pin the frame at (0,0) with position fixed and clip the page screenshot | verified | `toybox-visual-parity` |
| `parity-runtime-fonts` | Design references change between runs or machines | The design HTML loads Google Fonts at run time; offline it falls back to system fonts | Vendor the exact TTFs the app bundles and load them with @font-face | verified | `toybox-visual-parity` |
| `parity-design-frame-size` | Every element is 8 pt too low compared with the design | The design frame is 390x844 with a 54 pt status bar; the iPhone 16/17 Pro is 402x874 with a 62 pt safe top | Render the design at the device geometry (402x874, 62 pt status bar) and mask the top safe area | verified | `toybox-visual-parity` |

## Lessons

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-e06-structural-mismatch` | Exact parity impossible although every check was tuned | Different fonts, icon sources and renderers, and palette-quantised references (the earlier project passed 6 of 112) | Same TTFs, same icon paths, same device geometry, lossless references, element-level checks, and a proven human look | documented | `toybox-visual-parity` |

## App capture

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-home-indicator` | The design has a home indicator the screenshot lacks | simctl screenshots include the Dynamic Island but never the home indicator | Hide .hi in the design render; do not mask the bottom | verified | `toybox-visual-parity` |
| `parity-status-bar-breadcrumb` | The status bar shows "◀ <other app>" in a screenshot | The app was launched while another app was in front | Terminate other apps first and relaunch cleanly | verified | `toybox-visual-parity` |
| `parity-a11y-real-clock` | maestro hierarchy reports the real time although the status bar is overridden | status_bar override changes only the pixels, not the accessibility tree | Mask the top safe area (62 pt) in element checks | verified | `toybox-visual-parity` |
| `parity-settle-detection` | A screenshot catches a screen mid-animation | The capture ran before the screen settled | Capture every 300 ms until two in a row are identical (max 5 s); simctl captures are deterministic | verified | `toybox-visual-parity` |
| `parity-scroll-ignored` | Every scroll offset passes, all showing the top of the screen | The parity harness ignored the requested scrollY | Apply scrollY in the harness; check-parity reports scroll-mismatch beyond 2 pt | verified | `toybox-visual-parity` |
| `parity-banner-ads-off` | Parity fails on *.banner-ad in an ADS_MODE=off capture | Off mode draws no banner and the slot has zero height until an ad loads | The harness supplies a stand-in 320 x 50 banner that reports itself loaded, inside the band style | verified | `toybox-visual-parity` |
| `parity-bundle-id` | capture-app cannot find the app by a .test bundle id | Test and store builds share one bundle id, io.applander.<game id without hyphens> (Line Siege: io.applander.linesiege), with no .test suffix | Read the id from the built app with plutil (CFBundleIdentifier) | verified | `toybox-visual-parity` |
| `parity-scroll-clamped-before-insets` | A tall screen captured at a deep scroll offset stops short (S11 asked for y1170 and y1200, both stuck at 1104.7): scroll-mismatch | The ScrollView's first layout happens before the safe-area insets arrive, so its frame is too tall and iOS clamps the offset to a smaller maximum; when the insets arrive the frame shrinks but the content size does not change, so a scroll made only in onContentSizeChange never runs again | Apply ScreenBody's scrollToY from both onContentSizeChange and onLayout (the current toybox-screens ScreenBody template does) | verified | `toybox-screens` |
| `parity-capture-unstable-loop` | run-parity prints CAPTURE FAILED (unstable), or capture-app fails [unstable]: the screen never held still for 300 ms (for example S8 with the current level tile's flag bobbing) | A decorative loop keeps running in the parity launch: a component repeats an animation (withRepeat) without honouring useReduceMotion, so the frozen-motion switch of a parity launch (animations=off, isParityMotionFrozen) cannot hold it at rest | Make the loop read useReduceMotion() and rest when it is true: the shared app/use-reduce-motion.ts returns true while TEST_ONLY?.isParityMotionFrozen() is true, which freezes flag bobs, busy blocks, sticker slaps, star pops and confetti without touching the saved Reduce motion setting; never waive it and never raise --settle-ms for it | verified | `toybox-visual-parity` |
| `parity-dialog-modal-hides-scrim` | Every S14 capture fails screen-not-reached: the frame root <scope>.scrim is not in the hierarchy ("the root testID ...scrim is not on screen") | DialogCard sets accessibilityViewIsModal, which drops the scrim ancestor's testID (and the screen under it) from the accessibility tree | Put accessibilityViewIsModal on the Scrim, the modal root (VoiceOver still stays inside the dialog), and remove it from DialogCard: copy toybox-components' current ui/scrim.tsx and ui/dialog-card.tsx | verified | `toybox-components` |
| `parity-hierarchy-other-simulator` | maestro hierarchy shows another screen or language (a Persian Settings screen during an English S7 capture), or capture-app stops with "hierarchy from another simulator" | Maestro reached another session's simulator: the call named no --device, or two sessions' drivers shared a port while several sessions' simulators were booted on the same Mac | Name the device on every call: maestro --device <udid> with its own --driver-host-port (maestroGlobalArgs() in the repo tooling), simctl with the UDID, xcodebuild -destination id=<udid>; use your own e07-<purpose> simulator and shut down only your own; capture-app proves each dump by its launch nonce and exits 2 otherwise | verified | `e2e-maestro` |

## Process

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-unread-sheets` | Automated parity passed but a human found blockers | Machines cannot judge icons, shadows, optical alignment or RTL mirroring; earlier only 4 of 112 sheets were ever read | Read every side-by-side sheet and sign it off; tie the sign-off to the sheet hash | verified | `toybox-visual-parity` |
| `parity-widened-tolerance` | A screen passes only after a tolerance was raised | Widening a tolerance to pass is falsifying the test | Never widen tolerances or regenerate references to clear a failure; fix the app | verified | `toybox-visual-parity` |
| `parity-run-timeout` | A whole-screen parity run is cut off by the 2-minute command timeout | One run takes 10 to 20 s, and a screen such as S12 has 36 runs | Run it in the background or frame by frame | documented | `toybox-visual-parity` |

## References

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-music-rows-no-music` | S11 Settings (or S6 Pause) parity fails [missing] on settings.music-switch, settings.music-volume-row or pause.music, with many [bounds] and scroll-mismatch failures below, for a game without music (Line Siege) | The capture was compared with the base reference, which draws the Music rows, while the app correctly hides them when the game's sound bank has no music | Captures pick the reference variant from parity/game-facts.json (hasMusic false selects s11-settings--no-music and s6-pause--no-music); write or correct that file for the app (its parity-game-facts test pins it to the game module), commit it with a Gate-Change: trailer, and rerun; never force hasMusic in the app and never waive missing rows | documented | `toybox-visual-parity` |
| `parity-score-line-vs-moves` | S7 Result win parity fails [text] on result.score-card.moves-line ("7 moves – par 7" in the design) for a score-rated game such as Line Siege | The base reference shows the moves-against-par line, while a score-rated win shows the score line (result.win.score-line with score and best), because par is null | Set winLine score for the app in parity/game-facts.json so captures use s7-result-win--score (gated path: Gate-Change: trailer); the app keeps result.win.score-line, and moves-rated games keep result.win.moves | documented | `toybox-visual-parity` |

## Frame states

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-s15-ads-switch-off` | [structure] s15-debug-menu dark-en: debug.list: shape differs: a 12.0 pt thick difference (52.0 x 30.3 pt) at +290.0,+325.7 from the element's top-left, inside its crop-only part debug.ads-always-test-switch.toggle | The s15-debug-menu frame state says "ads always test on", but nothing opened it: the capture showed the "Always show test ads" switch off, and check-harness passed because its harness-opener rule did not know the state | The debug-ads-always-test parity opener: e2e-maestro's use-debug-model.ts reads parityFrameState() === 'debug-ads-always-test' from app/parity/parity-session.ts and opens it once on mount through the switch's own handler (debug ads override always-test; never useParityOpener, which reads the gate and closes an import loop through the test-only entry), parity-plans gives the state to s15-debug-menu, and check-harness's harness-opener rule knows it (SKIP while S15 is outside shell-slice.json). Every other value of the state string comes from the fixture save and is checked on the capture | documented | `toybox-visual-parity` |

## Layout

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-s15-badge-high` | [bounds] debug.top-bar.badge: geometry off: dx -0.9 dy -12.3 dw +0.7 dh -0.4 pt (design 14.9,93.3 108.3 x 39.4; app 14,81 109 x 39; tolerance +-2 pt) | The S15 "Test build" badge sat 12 to 14 pt higher than the design in every variant: S15 was never captured, so its layout was never compared (the debug menu is test-only but still matched to its design, lead decision L12) | Build S15 to its design like every other screen (toybox-screens' S15 layout), then sign it off: check-screens.mjs . --screen S15 and check-signoff.mjs --screen S15 in light and dark times en and fa at its planned scroll offsets (Shell step 9 names both) | documented | `toybox-screens` |

## Digits

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-s15-persian-digits` | [text-ink] s15-debug-menu light-fa: debug.jump-to-level-row.value: text "۱۲": ink width 4.0 vs design 10.7 pt (size, weight, family, letter-spacing or wrapping) | S15's labels stay English in every language (lead decision L13) but its numbers and dates follow the language's digits as the design draws them; the debug model built its values with String(n) and the wrong font run, so the Persian digits were drawn at the wrong size | use-debug-model.ts formats every number and date with the language's formatters (never String(n)), and S15's value text uses the type role the design uses; then recapture s15-debug-menu in fa (light and dark) | documented | `e2e-maestro` |

## Sign-off ledger

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `parity-signoff-date-utc` | check-signoff --draft writes "date": "2026-09-30" into every parity/signoff.json entry at 01:17 local time on 2026-10-01 (the sign-off is recorded one day early) | The draft took the UTC calendar day; the waivers' reportedToOwner dates and the reports use the local day, the same rule the product uses for "today" | check-signoff --draft writes the local calendar day (round 5), and --date YYYY-MM-DD overrides it; with an older check-signoff, correct the drafted date to the local day before committing the ledger (check-signoff does not judge the date) | verified | `toybox-visual-parity` |
