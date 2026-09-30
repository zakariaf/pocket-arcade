# What "matches the design" means, in numbers

Every tolerance in `scripts/lib/gates.mjs` is a measured noise floor, not a preference. This page says what was measured, what each gate catches, what no machine can check, and why a tolerance is never widened.

## Contents

- Why screen-level pixel scores cannot be the gate
- The gates, their tolerances and the evidence
- Text ink: how a run is measured
- Type-role centre floors (evidence)
- Borders, edge widths and element metadata
- What the machine proves, and what only a look proves
- Why a tolerance is never widened
- Where the numbers come from

## Why screen-level pixel scores cannot be the gate

Measured on 2026-09-28 (iPhone 16 Pro simulator, iOS 26.5, Release React Native 0.86.3 build; Google Chrome 153 on macOS 27; the same TTF files on both sides):

| Build | pixelmatch (threshold 0.1) | SSIM |
|---|---|---|
| a correct RN screen | 0.13 to 0.51 % of pixels differ | 0.983 to 0.995 |
| button 1 pt lower | 0.35 % | 0.987 |
| label weight 600 instead of 700 | 0.19 % | 0.992 |
| wrong string ("pt" instead of "px") | 0.14 % | 0.994 |
| fill #1F5FBF changed to #3B6FD0 | 0.14 % (missed) | 0.994 |

Correct builds and real defects overlap, and pixelmatch at threshold 0.1 does not see a clearly wrong fill colour at all. So the whole-screen difference is printed for information only ("report only, never a gate"), and the gates below work per element, keyed by testID.

## The gates, their tolerances and the evidence

Fix failures in this order: a later gate's message is noise while an earlier one fails.

| Order | Gate (rule id) | Rule | Correct builds measured | Planted defect it caught |
|---|---|---|---|---|
| 1 | `capture-size` | the capture is the parity device: 1206 x 2622 (phone), 1206 wide (state card) | always | an iPhone 16 capture (1179 x 2556) |
| 2 | `screen-not-reached` | the frame's root testID is on screen | always | a pending "Open in ...?" alert hid every testID |
| 3 | `scroll-mismatch` | a tall frame's capture is scrolled by the requested `scrollY` (clamped to the end of the design's scroll), within 2 pt | within 0.5 pt on 14 scrolled captures made from the design | a harness that ignored `scrollY` passed every offset with the top screen |
| 4 | `duplicate-testid` | one app element per testID | - | a copied row kept its testID |
| 5 | `missing` | every design element with a testID exists (tall frames: once on screen) | - | an element not rendered, or its testID on an inner Text |
| 6 | `bounds` | x, y, width, height within **2 pt** | at most 0.9 pt off, plus Maestro's whole-point flooring (up to 1 pt) | panel padding 14 to 12: height -3.8 pt; border 3 to 2: next block -3.6 pt |
| 7 | `text` | the accessibility label equals the design text (whitespace and bidi marks normalised) | equal | "Level 12" shown as "Level 13" |
| 8 | `fill` | most frequent colour inside the element (inset by border + 2 pt, text excluded): max channel difference **3/255** | identical (difference 0) | #FF6B4A shown as #FF7A5A (16); #FF6F4A (4) |
| 9 | `border` | solid border thickness within **0.5 pt**, ring colour within 3/255, read at three points per side the element draws | passed on every correct probe build | a 3 pt border drawn 2 pt; a group tab side drawn 1 pt |
| 10 | `text-ink` | per text run: ink width and height within **1 pt**; ink centre within **2 pt**, or the run's type-role floor + 0.9 pt where that is larger (next sections) | ink box within 0.3 pt (0.67 on the probe); centre within the role floors below | bold label drawn regular (width -13 pt); size 17 drawn 16 (-8 pt); weight 600 (-2.3 pt); label moved 3 pt; a Rubik 14 label 1 px past its 2.3 pt limit; a label in the wrong colour |
| 11 | `structure` | each element's painted area (box, hard shadow, cut ring, focus ring) is cropped from both images, aligned within 6 px (2 pt), diffed with pixelmatch; a difference blob at least **1.5 pt thick** and 24 px large, outside text, fails | none | missing gear icon; panel shorter; block border thinner |

Details that keep these gates honest:

- **Masks.** The top 62 pt (status bar, Dynamic Island, clock) and the home-indicator strip are never compared: the OS draws them, not the app, and the design's drawn bar has other geometry. Elements with `mask: true` in the testID map (ad banners, the game board) keep their bounds check, but their pixels are skipped. A masked element still has to be in the right place.
- **The board of a Game-route frame** (s6-pause, s7-*): the union of the board rectangle the game reports (probe=board) and the reference's `game.board` is filled with one grey in both images before any pixel gate, except where the elements drawn over it paint (the Pause dialog's rounded box and hard shadow, placed in the app by pixel alignment). Elements wholly inside it (the board itself) are skipped with a `masked` note; the top bar, the scrim and every part of the Pause dialog are gated in full, text ink included. Proven with planted fixtures: a game's own board painted into the capture stays silent (`good/s6-pause-board-masked`), a changed Pause key in the top bar fails (`bad-board-top-bar`), a changed key inside the dialog fails (`bad-board-dialog`).
- **Children answer for themselves.** A parent's crop ignores the area of smaller compared elements inside it (plus 2 pt), so one wrong icon fails that icon, not every card around it.
- **Crop-only parts ride in their cover.** Elements Maestro cannot list (inside an accessible element, or hidden from VoiceOver) are never paired and never cut out of a crop: their pixels stay inside the aligned crop of their `coveredBy` element, their text runs are placed by that element's measured offset, and a structure difference over one of them names it. Proven with planted fixtures: a missing Home logo fails `home.screen` "inside its crop-only part home.logo"; a missing Endless icon fails `home.endless-card`; neither is ever reported `missing`.
- **Structure is per element, never whole screen.** In a correct Persian build, sub-point rounding added up to a 1 pt drift further down the screen; a whole-screen "blob at least 1 pt thick" rule failed that correct build, the per-element aligned crop passed it.
- **Floating elements** (checks without `bounds`, for example the S8 toast that the app places above the banner instead of at the mock's 352 pt) are compared by text, fill and crop wherever they are, and are cut out of other elements' crops.
- **Rotated elements** (stickers, the logo tile) may report either their box or its bounding box; both are accepted within 2 pt.
- **Transforms are invisible to bounds.** Maestro and VoiceOver report layout frames, so a key sunk by a `translateY` transform measured 3 pt high. Anything that stays moved must move by layout; transforms are for transient animation only.
- **Tall frames** (S10, S11, S11c, S11d, S15) are compared per capture, the way the app shows them: the top bar (and S15's hazard strip) stays fixed, the body scrolls under it by the shift measured from the body elements (median), and the banner is pinned at the bottom of the screen while the design draws it at the end of the page. Body pixels under the top bar or behind the pinned banner are hidden in the app and never compared; an element partly hidden is checked by position only, and in full in the capture that shows it whole. `run-parity.mjs` plans the scroll offsets so that every body element is fully on screen at least once, and `check-signoff.mjs` (rule `coverage`) demands it. Every problem's `rect` is in page coordinates (the full-height design) with a `viewRect` for where it sits on this capture's screen; `make-sheet.mjs` crops the design side from the window the capture shows, so a scrolled `bounds` failure is compared with the same design element.
- **State cards** (the S12 states) are 390-wide fragments in the design, not phones: they are compared by text, fill, border, ink and crop, never by position.

## Text ink: how a run is measured

Three things made correct text fail before (S11 and S4 Premium captures, 2026-09-29), and the gate now measures around each of them:

- **Ink by the run's text colour.** A run's ink is the pixels whose colour lies on the way from the window's background to the text colour, past halfway. The text colour is the owner's CSS colour when solid pixels of it are in the run's box, else the most frequent far-from-background colour; the candidate that leaves the most glyph ink wins. Ink components that touch the edge of the measuring window belong to something larger (a pushed-in segment's rounded corner caught 75.7 x 15.7 pt of "ink" for a 73.3 x 10.7 pt label) and are dropped. A label drawn in the wrong colour has no ink in the app and fails (`bad-text-colour`).
- **Rotated owners.** A run inside a tilted sticker has an axis-aligned design rect that holds the sticker's paper and border at its corners (the tagline's window was all "ink", 254.7 x 32 pt, for a 250.6 x 18.4 pt line). For a rotated owner (`box.rotate`), only pixels inside the rotated line box count.
- **Pixel-measured owner edges.** The centre is judged against where the run's surroundings really are in the app: the owner's box, border, fill, separators and icons within 12 pt (then 36 pt) of the run are aligned between design and app, searched from Maestro's position to 1 pt further right and down (Maestro floors bounds to whole points; a scroll asked for 573 landed at 572.5, which alone put 1 pt into every centre). An axis with no edge nearby keeps Maestro's offset. `report.json` records per run the role, the anchor source and both readings (`stats.textInk`).

## Type-role centre floors (evidence)

**How it was measured (2026-09-29).** A type-role probe: 72 rows, each one role in a 2 pt bordered box on a white page (Rubik 11 to 21 at 400 and 700 with line heights 1.0 to 1.5; Lilita One 12 to 50; Vazirmatn 13 to 44, Regular and Bold; and Persian words with madda and hamza marks alone: آمار, آغاز, مسئله, مؤسسه, أبر, إسلام). The same rows were drawn by a Release React Native build captured on the parity simulator (iPhone 16 Pro, iOS 26.5, line heights snapped to the pixel grid as the Shell does) and by Chrome 153 in software raster (the reference renderer). Ink was measured by text colour inside each box, and the box edges by a pixel scan, so the numbers are glyph placement only: every box matched within 0 pt.

**Floors used by the gate** (`TEXT_ROLE_FLOORS` in `gates.mjs`; the larger of |dx| and |dy| of the ink centre, pt, worst weight and line height at that size). A run's centre limit is the larger of 2 pt and floor + 0.9 pt (the most a correct text box sits off its design box), rounded up to 0.1 pt. A size the probe did not cover takes its family's largest floor.

| Family | Size: floor (limit) |
|---|---|
| Rubik | 11: 1.12 (2.1), 12: 0.97 (2), 13: 1.08 (2), 14: 1.37 (2.3), 15: 1.1 (2), 16: 0.76 (2), 17: 0.75 (2), 18: 1.14 (2.1), 21: 0.32 (2) |
| Lilita One | 12: 1.44 (2.4), 14: 0.19 (2), 15: 0.72 (2), 16: 1.11 (2.1), 21: 0.74 (2), 22: 0.76 (2), 23: 0.42 (2), 24: 0.46 (2), 25: 0.41 (2), 27: 0.09 (2), 28: 0.6 (2), 30: 0.3 (2), 34: 0.55 (2), 38: 0.59 (2), 42: 0.12 (2), 44: 2.57 (3.5), 50: 1.2 (2.1) |
| Vazirmatn | 13: 0.47 (2), 14: 0.8 (2), 15: 1.0 (2), 16: 1.15 (2.1), 17: 0.8 (2), 18: 0.48 (2), 21: 0.55 (2), 25: 0.82 (2), 27: 1.17 (2.1), 28: 1.19 (2.1) |

What the numbers say:

- **Rubik 14 sits lowest among the text roles**: 1.03 pt low at 400/1.3 and 1.37 pt at 700/1.2 on the probe; on S11 at a half-point scroll the theme segment labels measured up to 2.0 pt with Maestro's rounding, 2.2 to 2.5 pt before the pixel anchor. With the anchor and the 2.3 pt limit they pass; 1 px more fails (`bad-text-ink-role-limit`).
- **Rubik 17 within 0.75 pt** (0.1 pt vertically at line height 1.32); Lilita One up to 1.44 pt at 12, and 2.57 pt at 44 with line height 1.0 (the only role over 2 pt). S4's Lilita labels measured up to 1.7 pt in situ.
- **Vazirmatn placement is within 1.19 pt.** At line height 1.0 React Native clips Vazirmatn's tall marks and digits (ink height -9 pt at 21 and 44), where Chrome lets them overflow the line box. Since 2026-09-30 the level numbers use 1.45 for Persian (the token `levelNumber.arabicLineHeight` and the mockup rule `.ar .lt b`, lead decision L2; the S8 fa references were re-rendered, and the mini stars moved with the taller box). `scoreValue` (the 44 pt score of the S7 win card) is the one role still at 1.0 for Persian: a known clip, reported to the owner and not changed (only the lead may change the tokens). A new role never uses 1.0 for Persian.
- **Persian marks are narrower, not moved.** Alone, آمار, مسئله, مؤسسه, أبر and إسلام came out 0 to 0.67 pt narrower (inside the 1 pt ink size): CoreText shapes the madda and hamza shorter than Chrome's HarfBuzz from the same font file. In S4's Stats key (آمار, Vazirmatn Bold 15) the earlier gate, which counted every pixel far from the background (the anti-aliased fringe included), measured the word 1.3 pt narrower (21.7 vs 23.0 pt) and failed; measured by text colour it is 0.67 pt narrower on all four fa S4 captures and passes. No style changes mark shaping, so a mark that still exceeds 1 pt somewhere gets a `platform-text-shaping` waiver naming the glyphs (signoff-and-waivers.md); the ink tolerance stays 1 pt.
- **In the clean-room captures** (S4, 8 variants; S11 light-en at 0, 573, 1170, 1200), every Persian run stayed inside its limit (worst: Vazirmatn Bold 15 at 1.44 pt, Vazirmatn 17 at 1.31 pt), the S4 runs pass with no waiver, and S11 failed only `settings.version` at 1170 and 1200 (the mockup's old footer gap). Since the mockup fix of 2026-09-30 (L5) the same real capture at 1170 passes against the re-rendered reference with no waiver (`good/s11-settings-light-en-y1170-footer`).
- **Not probed yet:** Vazirmatn Bold 11, 12, 22, 23, 24, 30, 38, 42 and 44 (the Persian forms of the Lilita One display roles; 12 measured 0.03 pt in situ on S4 Premium). They take the family's largest floor (1.19, limit 2.1 pt). When a Persian display title fails `text-ink` near its limit, measure that size with the type-role probe before anything else, and add it to both this table and `TEXT_ROLE_FLOORS` in one change.
- **Before blaming glyph placement,** rule out a type-role mismatch: compare the element's `font` in the reference `.layout.json` (for example `700 17px/22.44px Rubik`) with the role the app uses. The strong row label was such a case (the app used line height 1.25 where the design has 1.32).

The self-test holds a table check: every floor above equals `TEXT_ROLE_FLOORS` in `gates.mjs`, so neither side moves alone.

## Borders, edge widths and element metadata

- **Sides the element does not draw.** A CSS border lies inside its element's box. When the only band found on a side sits on or past the box edge (the group tab has no bottom border and stands on its list's top border), that side belongs to a neighbour and is not compared; it gave 0.7 vs 1.3 pt noise on every S11 capture. A side the element does draw is still read at three points (`bad-border-real-side`).
- **The band ends at the outside colour.** A side is read from inside the element outwards; past the border, a pixel counts as band only as far as it blends the border into the colour outside, not into the element's own fill. Before 2026-09-30 a neighbour's fill that happened to be nearer the border colour than the element's fill (the yellow group tab standing on the privacy list's top edge in S11 dark fa) was read as band: both images drew exactly 9 px, yet one capture showed 1 px more of the tab and measured 4.0 against 3.4 pt. The real capture is a fixture (`variants/s11-no-music-dark-fa-y1042-tab-edge` passes; the same edge 2 px thicker fails).
- **Edge widths come from the references.** Chrome renders a CSS border of 1 px or more at whole CSS px (2.5 -> 2, 1.5 -> 1), so every `.layout.json` says `2px solid` where the token file says 2.5, and the gates measure 2.0 pt. The app's `packages/shell/src/ui/component-specs.json` must hold those as-rendered widths; `check-harness.mjs` (rule `component-border`) compares every component edge in the committed layouts with the spec value it comes from (tab, segment, icon tile, sticker, chip, level tile, toggle and its key, slider track, progress bar, week marks and tag, bars, pager dots, confetti, panels, buttons ...). Rings (box-shadow), icon strokes and Skia strokes keep their token values.
- **Element metadata comes from the current map.** A reference layout records the map's metadata (role, component, kind, checks, mask, parent, a11yHidden, coveredBy, state) next to what Chrome measured. `check-parity.mjs` takes that metadata from the current `screen-testids.json`, and `shoot-design.mjs --check` compares only what was measured, so a metadata fix in the map needs no re-render.

## What the machine proves, and what only a look proves

Machine-checked, for every theme and language: the same screen, the same set of testIDs, every element within 2 pt, the same strings, the same colours (in practice exact), the same type size, weight and alignment, and no shape difference of 1.5 pt or more inside any element.

Not achievable, and never promised: pixel identity. Glyph anti-aliasing and 1/3 pt rounding always differ (0.13 to 0.51 % of pixels on correct builds); CoreText places glyphs up to each role's floor away from Chrome; the OS status bar is not the design's.

Only a look at the sheets proves these, so Claude answers each one in the sign-off ledger:

| Eye check | What to compare on the sheets |
|---|---|
| `icons` | icon shape, stroke weight, size and centring (eye-*.png pairs, crops) |
| `pictures` | code-drawn art: splash logo, how-to-play picture, result art, stickers' contents |
| `shadows` | hard shadow offset and edge, cut ring, focus ring, press depth at rest |
| `alignment` | optical centring, baselines in rows, equal gaps the gates tolerate within 2 pt |
| `wrapping` | line breaks, truncation, text that fits in de and fa |
| `direction` | RTL mirroring: rows, chevrons and back arrows flip; play, clocks, stars, logos and sticker tilt do not |
| `feel` | the whole screen next to the design: nothing extra, nothing missing, same Toybox character |

## Why a tolerance is never widened

The self-test holds fixtures on both sides of the fill, bounds and role tolerances (3/255 passes, 4/255 fails; 2 pt passes, 3 pt fails; Rubik 14 at 2.0 pt passes, 1 px past 2.3 pt fails) and fails if a number moves. A failing gate means the screen differs from the design by more than a correct build ever did; the fix is in the app. If iOS or React Native truly cannot draw something the way the design does, that one problem gets a waiver with its class and reason, reported to the owner (see [signoff-and-waivers.md](signoff-and-waivers.md)); the tolerance stays.

## Where the numbers come from

- Probe app (2026-09-28): a slice of Toybox Home (Lilita One 28/25/21, Rubik 400/700 at 17, 3 pt ink borders, radius 14, hard `boxShadow`, a Vazirmatn block) built as a Release RN app and captured on the parity simulator, against an HTML replica rendered by the same Chrome setup. The good and planted-defect captures are the self-test fixtures in `tests/fixtures/check-parity/`.
- Type-role probe (2026-09-29): the 72 rows above, same device and renderer; its per-role floors are the table above.
- Clean-room captures (2026-09-29): S4 (8 variants) and S11 light-en at 0, 573 and 1170, whose real captures are the text-ink, border and scrolled-sheet fixtures (`good/s11-settings-*`, `good/s4-home-premium-light-en-sticker`, `make-sheet-scrolled/`).
- Renderer determinism: with GPU rasterisation two Chrome renders of the same frame differed in 2 to 2,451 edge pixels (up to 57/255); with `--disable-gpu` (software raster) repeated renders are identical, and the probe verdicts did not change. The references are rendered in software mode and `shoot-design.mjs --check` proves a re-render is pixel-identical.
- Simulator determinism: two `simctl` screenshots of the same screen had 0 differing pixels, 1 s apart and across a reboot; hard shadows can re-dither by 1/255 on a redraw.
