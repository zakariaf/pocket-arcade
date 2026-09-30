# 18 · Design system: Toybox

> **What this doc decides.** The Shell (every Pocket Arcade screen except the game board) is drawn in **Toybox**, the design system the owner chose from the three mockups in `design/`. This doc codifies Toybox precisely enough to build the UI and to write pixel-parity checks against the mockup: the concept and rules, every colour for light and dark and for each game, the colour-blind variant and focus, the type scale for Lilita One, Rubik and Vazirmatn, spacing, radii, strokes, hard shadows and press offsets, motion with its reduce-motion alternatives, the icon set as path data, every component, a layout spec for every screen S1–S15, RTL and dark-theme rules, measured contrast, and the React Native mapping.
> **Binding source:** `design/toybox.html` (the mockup, 2026-09-27) and its machine-readable twin `design/toybox/tokens.json` (2026-09-28: colours and icon paths generated from the HTML's own script data, sizes transcribed from its CSS). Screen texts come from `design/shared/copy-deck.json`; reference captures are in `design/reference/toybox/`. Where the HTML is silent or contradicts itself, this doc picks a value and marks it **Chosen**; computed values are marked **Derived**. All of them are listed again in [Open issues](#open-issues).
> **Related docs:** [05-components-hooks-styling.md](05-components-hooks-styling.md) (theme types, `makeStyles`, `AppText`, `Icon`, buttons), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (fonts, line heights, direction, digits), [09-sound-haptics-art.md](09-sound-haptics-art.md) (art pipeline, S11d licences), [15-performance-and-accessibility.md](15-performance-and-accessibility.md) (contrast tests, VoiceOver), [11-ads-admob.md](11-ads-admob.md) (banner slot), [12-in-app-purchase.md](12-in-app-purchase.md) (S12 states), [07-testing-and-tdd.md](07-testing-and-tdd.md) (screenshot matrix). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

### 1.1 Concept

Every Pocket Arcade game is a small toy: a wall of blocks under siege, a tilting field of sheep, a junkyard of clumsy robots. Toybox dresses the Shell like the **shop shelf those toys sit on**: chunky plastic keys with one thick ink outline, hard shadows that a finger pushes the key into, and die-cut stickers for anything worth celebrating. Each game only repaints the shelf, so all the apps feel like one family.

The world, in one line: a toy-shop shelf — chunky plastic keys, die-cut stickers, boxed toys, one ink.

### 1.2 Principles

1. **Raised means you can press it.** Buttons, tiles and keys cast a hard 3–6 pt shadow and sink into it when pressed. Panels that only hold information lie flat (outline, no shadow).
2. **One ink, many paints.** Outline, text and shadow are one ink. A game swaps its paints (ground, surface, sunken, accent, pop, and in dark its tinted ink family); shapes, sizes and stickers never change.
3. **Stickers carry news.** Streaks, new bests, Premium, locks and test builds arrive as tilted stickers with a white die-cut ring. Everything else sits square.
4. **Shape before colour.** Stars are filled or hollow, locked tiles are dashed with a padlock, toggles show a check or a dash, the chosen segment is pushed in and carries a check. Colour only confirms.

### 1.3 What Toybox avoids

- Soft blurred drop shadows, glass and backdrop blur.
- Gradient fills on buttons or cards: every paint is flat.
- Pill buttons: the biggest control radius is 14 pt.
- Fills without an ink edge, which melt into the ground.
- White or cream screen grounds: the ground is always a painted wash.
- Emoji and clip-art: icons are one 24-unit path each.
- Centred screens: text starts at the start edge; only the splash, the result stars and the result title are centred.
- Tilted body text: only stickers, flags, art tiles and logos rotate, never more than 8° (logos up to 17° on the lose screen).

### 1.4 How the values were extracted, and conventions

- **Colours** were read programmatically from the HTML's palette objects (`PAL`, `NAMES`, `SEM`, `INK` and the `line` values in `applyVars`), never retyped; `design/toybox/tokens.json` is generated from them. Every hex value in the token file appears in `toybox.html` except four translucent twins, which are listed in `meta.derivedHex` (see [Verified](#verified)).
- **Sizes** were transcribed from the `.app` component CSS (the mockup's app layer) into `tokens.json` → `type`, `spacing`, `radii`, `stroke`, `elevation`, `press`, `motion`, `layout` and `components`; section 4's measurement lines are printed from that file, so the doc and the JSON cannot disagree. The page chrome (`--pg-*` variables, `.pg-*` classes: the design page's own header, cards and captions) and the phone frame (`#141320`, `#3A3852`) are not part of Toybox.
- **Units.** 1 pt in this doc = 1 CSS px of the mockup's 390 × 844 pt phone at 1×. Line heights are ratios × font size; "(41.8 pt)" is the exact product (the mockup never rounds). Angles are degrees; negative = counter-clockwise.
- **Logical sides.** "Start" and "end" follow the reading direction (left/right in LTR, mirrored in RTL); "top", "bottom", "inline", "block" as in CSS logical properties.
- **Marks.** **Chosen:** the HTML is ambiguous or inconsistent and this doc picks. **Derived:** computed from HTML values (contrast ratios, rgba written as `#RRGGBBAA`). **Mock only:** drawn in the mockup as a placeholder, not built.
- **Names.** Colour roles use the mockup's paint names (`ground`, `ink`, `inkSoft`, `accent`, `pop`…) with the `ColorTokens` field they fill (section 3.1). Icon names are kebab-case (doc 03); the mockup's camelCase name is kept alongside.

### 1.5 Scope

Toybox covers S1–S4 and S6–S15 and the Shell parts of S5 (game top bar, pause entry). The board itself, its pieces and the how-to-play pictures are drawn by each game (doc 08, doc 09), using the game's own palette; Toybox only frames them. The screen texts are the copy deck's keys; this doc names the key next to each element.

---

## 2. Rules

Each rule is imperative and checkable. **Why** gives the reason. "Check" names how a machine or reviewer verifies it.

1. **Give every pressable control a hard shadow, and nothing else.** Buttons, keys, icon buttons, option cards, segments, level tiles and toggle knobs have a shadow offset straight down by their elevation (3, 4, 5, 6 pt; the knob 2 pt, dialogs 8 pt), with no blur and no spread, in `shadow`. Panels, lists, rows, chips, toasts and stickers have none.
   *Why:* "raised = pressable" is the system's affordance (principle 1). *Check:* component snapshot lists no `shadowRadius`/`elevation` props; section 9.5 helpers only.
2. **Press = sink.** On press, a raised control moves down by its elevation and its shadow shrinks to 0; buttons also squash to scale (1.03, 0.94) in 70 ms ease-out, then spring back with overshoot (320 ms). Pushed-in states (selected segment, chosen option, "on" pause key, disabled, busy) sit at the pressed offset without a shadow.
   *Why:* the key must feel like plastic. *Check:* `RaisedSurface` (section 9.4) is the only press implementation.
3. **Edge every fill with ink.** Controls and panels: 3 pt outline in `border`; tiles, segments, stickers, chips, icon tiles, the slider track and bars: 2.5 pt; separators: 2 pt `line`. Dashed 2.5–3 pt means locked, disabled or a placeholder.
   *Why:* the light-theme accent and pop fills are only 1.0–1.9:1 against the ground; the outline (≥ 10.9:1) is what makes the shape visible (section 8).
4. **Keep radii blocky.** 14 pt for buttons, panels, lists and option cards; 10 for tiles, segments and toggles; 22 for dialogs and the Premium art; 26 for the top of sheets. Never a pill, never a circle for a control.
5. **Paint flat.** No gradients, no transparency except the scrim and the separator line, no blur. The only repeating fill is the S15 hazard strip.
6. **Games repaint paint, never shape.** A game supplies only its palette (section 3.2). Sizes, radii, strokes, type, stickers, gold, the cut ring, the semantic colours and the ad neutrals are Shell constants.
   *Check:* `toybox-tokens.test.ts` (section 9.8) compares every app palette with `tokens.json`.
7. **Accent means "go".** Accent fills: the hero key (Play, Next, Resume, Try again, Buy), primary buttons, the current level tile, toggles that are on, the chosen segment and option, progress fills, done marks, chart bars, pager dot, calendar month band, the "on" pause keys. Pop fills: icon tiles, group tabs, the Premium key, the Continue-with-ad button, the home tagline sticker. Gold: stars, stickers, flags, Premium art.
8. **Destructive never looks like accent.** Danger buttons keep the surface fill and turn their text, icon and outline `danger`; danger rows turn the label `danger` bold and the icon tile `dangerFill` with a `danger` edge.
9. **Stickers carry news, and only stickers tilt.** Tilt between 2° and 8° either way (default −4°). Every sticker has a 2.5 pt toy-ink edge and a 3.5 pt white die-cut ring. Body text never rotates.
10. **Shape before colour.** Every state has a non-colour cue: check or dash in toggles and pause keys, a check in the chosen segment and option, dashed edge plus padlock on locked tiles and packs, filled vs hollow stars, dashed edge on disabled buttons, check / cross / play marks in the week strip.
11. **Start-align.** Screens read from the start edge. Only S1's content, the S7 chip, stars, title, sub-sticker and lose picture, the Pause "Home" link, the quiet nudges under a hero key, and the S3 Google sheet placeholder are centred.
12. **Use the type roles and component styles in section 3.6, never raw sizes.** Lilita One for display roles, never with a `fontWeight`; Rubik 400/700 for text; Vazirmatn in fa/ckb at the same sizes; game names always in Lilita One, isolated LTR.
13. **One hero key per screen.** The 80 pt key (section 4.2) appears at most once; everything else uses 54 pt buttons, rows or keys.
14. **Keep every target at least 44 × 44 pt.** Keys 48–94 pt tall, level tiles about 51 × 62 pt, toggle rows 60 pt (the whole row is the target), quiet buttons 44 pt.
15. **Banner only where doc 11 allows it.** Bottom of Home, Levels and Statistics; never on Pause, Result, dialogs or Premium; gone for Premium owners.
16. **Respect reduce motion.** Every animation in section 3.11 has the listed alternative; the hold-to-confirm timer is functional and keeps its 2 s.

---

## 3. Tokens

The full machine-readable set is `design/toybox/tokens.json`: `color`, `type`, `spacing`, `radii`, `stroke`, `elevation`, `press`, `motion`, `layout`, `components`, `icons`, `logos`. Code imports it only through generated or checked files (section 9.8).

### 3.1 Colour roles

Six named paints per theme per game, plus the ink family. The mockup's paint names map onto doc 05's `ColorTokens` like this (the HTML's own `palette.ts` sketch):

| Paint | `ColorTokens` field | Role |
|---|---|---|
| `ground` | `background` | the painted wash behind every screen |
| `surface` | `surface` | panels, lists, keys, buttons, tiles, dialogs |
| `sunken` | `sunken` (**new**) | pushed-in, disabled and empty fills: toggle and slider tracks, progress track, locked tiles and packs, disabled buttons, pressed quiet button, board placeholder |
| `ink` | `text`, `icon` | body text, icons |
| `inkSoft` | `textMuted`, `starOff` | muted text, chevrons, values, hollow stars, disabled text and dashed edges |
| `outline` | `border` | every control and panel edge (in light = ink) |
| `shadow` | `shadow` (**new**) | the hard shadow (in light = ink) |
| `accent` | `primary` | "go" fills (rule 7) |
| `onAccent` | `onPrimary` | text and icons on accent |
| `pop` | `pop` (**new**) | icon tiles, group tabs, Premium key, Continue-with-ad, tagline sticker |
| `onPop` | `onPop` (**new**) | text and icons on pop |
| (Shell) `danger` | `danger` | destructive text, icons, edges |
| (Shell) `focus` | `focus` (**new**) | focus ring (section 3.5) |
| (Shell) `star` | `starOn` | filled stars |

The five **new** fields (`sunken`, `pop`, `onPop`, `shadow`, `focus`) are added to `ColorTokens` in doc 05 section 3.6. Every other Toybox colour is a Shell constant (section 3.3), not game paint.

### 3.2 Paint per game (light and dark)

Light: "one ink" — `ink`, `outline`, `shadow`, `onAccent` and `onPop` are toy ink `#1D1B3A` in every game, and `inkSoft` is Pencil `#43406A`. Dark ("toy chest at night"): each game tints its whole ink family to its ground, so dark `ink`, `inkSoft`, `outline`, `shadow`, `onAccent` and `onPop` differ per game (**Chosen:** the data wins over the design plan's "other games swap only ground + accent + pop"; see open issue 1). Paint names from the mockup are in brackets.

#### Line Siege

| Paint | `ColorTokens` field | Light | Dark |
|---|---|---|---|
| `ground` | `background` | `#A5DAF3` (Sky wash) | `#1B1943` (Toy chest) |
| `surface` | `surface` | `#F8FBFF` (Chalk) | `#2B2862` (Lid) |
| `sunken` | `sunken` | `#D3ECF8` | `#221F52` |
| `ink` | `text, icon` | `#1D1B3A` (Toy ink) | `#F4F2FF` (Moonlight) |
| `inkSoft` | `textMuted, starOff` | `#43406A` (Pencil) | `#B9B4EA` (Dusk) |
| `outline` | `border` | `#1D1B3A` | `#E4E0FF` |
| `shadow` | `shadow` | `#1D1B3A` | `#07061A` |
| `accent` | `primary` | `#FF6B4A` (Brick tomato) | `#FF7D5E` (Ember) |
| `onAccent` | `onPrimary` | `#1D1B3A` | `#1B1943` |
| `pop` | `pop` | `#FFD23F` (Sunshine) | `#FFD84D` (Lantern) |
| `onPop` | `onPop` | `#1D1B3A` | `#1B1943` |

#### Flock Tilt

| Paint | `ColorTokens` field | Light | Dark |
|---|---|---|---|
| `ground` | `background` | `#AEE8C6` (Meadow wash) | `#112A48` (Night field) |
| `surface` | `surface` | `#F7FCF9` (Fleece) | `#1C3C62` (Barn roof) |
| `sunken` | `sunken` | `#D2F1DF` | `#15325A` |
| `ink` | `text, icon` | `#1D1B3A` (Toy ink) | `#F2F7FF` (Moonlight) |
| `inkSoft` | `textMuted, starOff` | `#43406A` (Pencil) | `#AFC6E6` (Mist) |
| `outline` | `border` | `#1D1B3A` | `#DCEBFF` |
| `shadow` | `shadow` | `#1D1B3A` | `#050E1C` |
| `accent` | `primary` | `#3DBE66` (Clover) | `#52D67F` (Glow clover) |
| `onAccent` | `onPrimary` | `#1D1B3A` | `#112A48` |
| `pop` | `pop` | `#7CC8FF` (Pond) | `#86CFFF` (Moon pond) |
| `onPop` | `onPop` | `#1D1B3A` | `#112A48` |

#### Scrap Shove

| Paint | `ColorTokens` field | Light | Dark |
|---|---|---|---|
| `ground` | `background` | `#F7DF7E` (Hazard lemon) | `#261C45` (Scrapyard night) |
| `surface` | `surface` | `#FFFEF8` (Enamel) | `#372A63` (Tin) |
| `sunken` | `sunken` | `#F9EBB2` | `#2E2356` |
| `ink` | `text, icon` | `#1D1B3A` (Toy ink) | `#F7F2FF` (Moonlight) |
| `inkSoft` | `textMuted, starOff` | `#43406A` (Pencil) | `#C4B6EC` (Smoke) |
| `outline` | `border` | `#1D1B3A` | `#EDE4FF` |
| `shadow` | `shadow` | `#1D1B3A` | `#0B0718` |
| `accent` | `primary` | `#1FB5A9` (Robot teal) | `#36D1C4` (Neon teal) |
| `onAccent` | `onPrimary` | `#1D1B3A` | `#261C45` |
| `pop` | `pop` | `#FF8A3D` (Rust) | `#FF9A55` (Hot rust) |
| `onPop` | `onPop` | `#1D1B3A` | `#261C45` |

What each game repaints, at a glance (L = light, D = dark):

| Game | Ground L | Accent L | Pop L | Surface L | Sunken L | Ground D | Surface D | Sunken D | Ink D | Muted D | Outline D | Shadow D | Accent D | Pop D |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Line Siege | `#A5DAF3` | `#FF6B4A` | `#FFD23F` | `#F8FBFF` | `#D3ECF8` | `#1B1943` | `#2B2862` | `#221F52` | `#F4F2FF` | `#B9B4EA` | `#E4E0FF` | `#07061A` | `#FF7D5E` | `#FFD84D` |
| Flock Tilt | `#AEE8C6` | `#3DBE66` | `#7CC8FF` | `#F7FCF9` | `#D2F1DF` | `#112A48` | `#1C3C62` | `#15325A` | `#F2F7FF` | `#AFC6E6` | `#DCEBFF` | `#050E1C` | `#52D67F` | `#86CFFF` |
| Scrap Shove | `#F7DF7E` | `#1FB5A9` | `#FF8A3D` | `#FFFEF8` | `#F9EBB2` | `#261C45` | `#372A63` | `#2E2356` | `#F7F2FF` | `#C4B6EC` | `#EDE4FF` | `#0B0718` | `#36D1C4` | `#FF9A55` |

### 3.3 Shell constants (every game, per scheme)

These never change with the game. In code they live in `SHELL_COLORS[scheme]` (section 9.1); `danger`, `focus` and `star` are also copied into each palette's `ColorTokens` so doc 15's checks see them.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `success` | `#17804A` | `#7EE3A6` | check marks in the score panel, "done" confirmations |
| `warning` | `#8A5A00` | `#FFC95C` | reserved (no mock screen uses it yet) |
| `danger` | `#C4243A` | `#FF8593` | destructive text, outline and icons; `ColorTokens.danger` |
| `dangerFill` | `#FFD9DD` | `#4A1F3A` | tint behind destructive icons, the hold-to-confirm fill, the Premium error panel |
| `focus` | `#C8157A` | `#FF8AD8` | focus ring and the tapped-locked-tile highlight; `ColorTokens.focus` |
| `star` | `#FFC928` | `#FFD23F` | filled stars; `ColorTokens.starOn` (dark differs from gold) |
| `gold` | `#FFC928` | `#FFC928` | sticker paper, flags, the "Today" tag, gold icon tiles, Premium art, confetti |
| `cut` | `#FFFFFF` | `#FFFFFF` | the die-cut ring around stickers, flags, art tiles and cut logos |
| `toastBg` | `#1D1B3A` | `#F4F2FF` | toast background (inverted ink chip) |
| `toastInk` | `#F8FBFF` | `#1B1943` | toast text and icon |
| `scrim` | `rgba(29,27,58,.55)` (= `#1D1B3A8C`, derived) | `rgba(3,2,12,.7)` (= `#03020CB3`, derived) | dims the screen under dialogs, the pause dialog and sheets |
| `line` | `rgba(29,27,58,.14)` (= `#1D1B3A24`, derived) | `rgba(228,224,255,.16)` (= `#E4E0FF29`, derived) | row separators, score-panel rule, stat-list rules |
| `adBg` | `#E6E9ED` | `#2A2C38` | banner slot band and ad-chip text |
| `adLine` | `#8D949E` | `#6B7080` | dashed banner borders |
| `adInk` | `#474C55` | `#C3C6D6` | banner placeholder text and the "Ad" chip |

Fixed in both schemes: **toy ink `#1D1B3A`** and **white `#FFFFFF`** for everything "printed": sticker edges and text (white text on the ink sticker), the level-tile flag, the week "Today" tag, art tiles (`.art`, Premium art) and gold icon tiles, logo line art, confetti edges and the S15 hazard stripes. **Derived:** `line` and `scrim` are the HTML's `rgba()` strings; React Native accepts them as they are, and `tokens.json` adds `#RRGGBBAA` twins. `line` over Line Siege's surface composites to about `#D9DCE3` (light) and `#49457B` (dark).

**Mock only:** the S3 consent placeholder uses `sheet #FFFFFF / #202124`, `line #9AA1AB / #80868B`, `ink #3D434C / #E8EAED`, `stripe #EEF0F3 / #2A2B2F` (light / dark). Google draws the real form. The how-to-play mock art uses monster `#7B5CFF` and rock `#9AA3B5`; each game owns its pictures.

### 3.4 Colour-blind variant

**The colour-blind palette is identical to the standard palette** for the Shell, in every game and scheme: the HTML sets `colorBlind: { /* same paints; shapes carry meaning */ }`. This is allowed because rule 10 gives every state a shape cue, so no Shell meaning depends on hue. The `Palette` type still requires both modes (doc 05), so each app writes `colorBlind: { light: LIGHT, dark: DARK }` with the same objects (section 9.1). The colour-blind switch keeps its full effect on the **boards**, whose piece colours come from each game's `board-palettes.json` (doc 09 section 7.2).

### 3.5 Focus

- **Colour:** `focus` = `#C8157A` (light) / `#FF8AD8` (dark), the same in every game. Measured ≥ 3.6:1 against every ground and ≥ 4.4:1 against sunken (section 8).
- **Geometry:** a 3 pt solid ring drawn 2 pt outside the control's border, following its radius (radius + 2 + 3 at the outer edge). CSS: `outline: 3px solid var(--focus); outline-offset: 2px`.
- **Where it shows:** (1) the locked level tile the player just tapped, while its "unlock by finishing level n" toast is up (S8); (2) any control with keyboard or Switch Control focus on iPad (**Chosen**: the mockup only draws case 1; React Native's `outline*` props draw the same ring, section 9.5).

### 3.6 Typography

**Faces** (all SIL OFL 1.1, bundled, never downloaded at runtime):

| Face | Files (in each `apps/<game>/assets/fonts/`) | Version | Used for |
|---|---|---|---|
| **Lilita One** Regular | `LilitaOne.ttf` (upstream `LilitaOne-Regular.ttf`, 28 KB; PostScript name `LilitaOne`) | 1.002 | display roles, headings, numbers, hero keys, stickers, group tabs, game names in every language. One weight: never set `fontWeight`. Covers German ä ö ü ß; lacks ẞ and tabular figures |
| **Rubik** Regular and Bold | `Rubik-Regular.ttf`, `Rubik-Bold.ttf` (static cuts of `Rubik[wght].ttf` at wght 400 and 700, 212 KB each) | 2.300 | body, labels, captions, all other text in en/de |
| **Vazirmatn** Regular and Bold | `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` (doc 10) | 33.003 | all fa and ckb text: display roles in Bold, text roles in Regular or Bold at the same sizes |

**Chosen:** the Lilita One file is committed as `LilitaOne.ttf` so its file name equals its PostScript name (doc 10's convention: then `fontFamily: 'LilitaOne'` works on iOS and Android). The mockup's note says "~40 KB"; the Google Fonts file measured 28 092 bytes. The Rubik cuts are made with `fonttools varLib.instancer Rubik[wght].ttf wght=400 --update-name-table -o Rubik-Regular.ttf` (and `wght=700 … Rubik-Bold.ttf`); the cut files report PostScript names `Rubik-Regular` and `Rubik-Bold` (verified).

**Roles.** Sizes are points before Dynamic Type. Letter-spacing is 0 for every role; the only tracked text is the game name (+0.01 em).

| Role | Size | Latin face · weight | Latin line height | Arabic-script face · weight | Arabic line height | Letter-spacing | Use |
|---|---|---|---|---|---|---|---|
| `display` | 38 | Lilita One 400 (`LilitaOne`) | 1.1 (41.8 pt) | Vazirmatn Bold 700 (`Vazirmatn-Bold`) | 1.45 (55.1 pt) | 0 | result and Premium titles (t-display) |
| `title` | 30 | Lilita One 400 (`LilitaOne`) | 1.1 (33 pt) | Vazirmatn Bold 700 (`Vazirmatn-Bold`) | 1.45 (43.5 pt) | 0 | screen titles without a top bar, empty states, S12 state heads (t-title, mini-h) |
| `number` | 30 | Lilita One 400 (`LilitaOne`) | 1.1 (33 pt) | Vazirmatn Bold 700 (`Vazirmatn-Bold`) | 1.1 (33 pt) | 0 | stat values (.sv sets line-height 1.1 in both scripts) |
| `heading` | 21 | Lilita One 400 (`LilitaOne`) | 1.1 (23.1 pt) | Vazirmatn Bold 700 (`Vazirmatn-Bold`) | 1.45 (30.45 pt) | 0 | panel and pack headings, step text, reason line (t-heading) |
| `body` | 17 | Rubik 400 (`Rubik-Regular`) | 1.32 (22.44 pt) | Vazirmatn Regular 400 (`Vazirmatn-Regular`) | 1.5 (25.5 pt) | 0 | running text, row labels (.app default) |
| `label` | 17 | Rubik 700 (`Rubik-Bold`) | 1.25 (21.25 pt) | Vazirmatn Bold 700 (`Vazirmatn-Bold`) | 1.45 (24.65 pt) | 0 | button labels (.btn) |
| `caption` | 13 | Rubik 400 (`Rubik-Regular`) | 1.4 (18.2 pt) | Vazirmatn Regular 400 (`Vazirmatn-Regular`) | 1.6 (20.8 pt) | 0 | small print, footnotes (.cap-t, .small) |

**Chosen:** `body` uses the CSS line height 1.32 (the mockup's `.app` rule); the HTML's implementation note says 1.3 (17 pt → 22.44 vs 22.1 pt; both round to 22). `label` uses 1.25 / 1.45 from the `.btn` rule. `number` keeps line height 1.1 in both scripts, as `.sv` sets it explicitly.

**Component text styles.** Components use these named styles (all in `tokens.json` → `type.styles`). "display" means Lilita One in en/de and Vazirmatn Bold in fa/ckb; "text 700" means Rubik Bold / Vazirmatn Bold.

| Style | Size (pt) | Face · weight | Line height Latin / Arabic | Other |
|---|---|---|---|---|
| `gameName` | 28 (home), 50 (splash), 34 (about) | display (Lilita One / Vazirmatn Bold) | 1.05 / 1.05 | letter-spacing 0.01 em; Lilita One in every language (brand), isolated LTR |
| `topBarTitle` | 27 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 |  |
| `heroKeyLabel` | 25 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 |  |
| `dialogTitle` | 25 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 |  |
| `groupTab` | 15 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 | colour onPop |
| `levelNumber` | 21 | display (Lilita One / Vazirmatn Bold) | 1 / 1 |  |
| `scoreValue` | 44 | display (Lilita One / Vazirmatn Bold) | 1 / 1 |  |
| `statValueCompact` | 23 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.1 | no wrap |
| `statListValue` | 22 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.1 | align end |
| `streakValue` | 28 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 |  |
| `gameTopBarScore` | 24 | display (Lilita One / Vazirmatn Bold) | 1.1 / 1.45 |  |
| `calendarMonth` | 16 | display (Lilita One / Vazirmatn Bold) | 1.4 / 1.4 | colour onPrimary |
| `calendarDay` | 42 | display (Lilita One / Vazirmatn Bold) | 1.15 / 1.15 |  |
| `sticker` | 16 (regular), 14 (sm), 12 (xs) | display (Lilita One / Vazirmatn Bold) | 1.15 / 1.45 | colour toyInk |
| `chip` | 15 | text 700 | 1.3 / 1.5 |  |
| `rowButtonDescription` | 14 | text 400 | 1.3 / 1.5 | colour textMuted on secondary, onPop on pop |
| `keyLabel` | 15 | text 700 | 1.2 / 1.4 |  |
| `toggleKeyLabel` | 14 | text 700 | 1.2 / 1.45 |  |
| `toggleKeyState` | 13 | text 400 | 1.2 / 1.45 |  |
| `segmentLabel` | 15 (regular), 14 (inRow) | text 700 | 1.2 / 1.45 |  |
| `segmentPreview` | 13 | text 400 | 1.2 / 1.45 |  |
| `rowLabel` | 17 | text 400 | 1.32 / 1.5 |  |
| `rowDescription` | 14 | text 400 | 1.3 / 1.5 | colour textMuted |
| `rowValue` | 15 | text 400 | 1.32 / 1.5 | colour textMuted; align end |
| `subRowLabel` | 14 | text 400 | 1.32 / 1.5 | colour textMuted |
| `optionName` | 21 (languageChoice), 18 (languageList) | text (own script: Rubik for en/de, Vazirmatn for fa/ckb) 700 | 1.3 / 1.5 |  |
| `lead` | 18 | text 400 | 1.32 / 1.5 |  |
| `prose` | 16 | text 400 | 1.5 / 1.75 | S11c policy paragraphs |
| `toast` | 15 | text 400 | 1.35 / 1.55 | colour toastInk |
| `nudge` | 15 | text 400 | 1.25 / 1.45 | underline 2 pt, offset 5 |
| `scoreLabel` | 17 | text 700 | 1.32 / 1.5 | colour textMuted |
| `scoreLines` | 16 | text 400 | 1.32 / 1.5 |  |
| `statLabel` | 14 | text 400 | 1.3 / 1.5 | colour textMuted |
| `statListKey` | 15 | text 400 | 1.32 / 1.5 |  |
| `streakLabel` | 14 | text 700 | 1.32 / 1.5 | colour textMuted |
| `packProgress` | 15 | text 700 | 1.32 / 1.5 |  |
| `weekdayLetter` | 13 | text 700 | 1.2 / 1.5 | colour textMuted |
| `weekTodayTag` | 11 | text 700 | 1.3 / 1.3 | colour toyInk |
| `barValue` | 13 | text 700 | 1.2 / 1.2 | colour text |
| `barDay` | 13 | text 700 | 1.3 / 1.5 | colour textMuted |
| `legend` | 14 | text 400 | 1.32 / 1.5 | colour textMuted |
| `rule` | 15 | text 400 | 1.32 / 1.5 | colour textMuted |
| `settingsFooter` | 14 | text 400 | 1.32 / 1.5 | colour textMuted |
| `splashTagline` | 18 | text 400 | 1.32 / 1.5 | colour textMuted; max width 290; align center |
| `gameTopBarLevel` | 16 | text 700 | 1.32 / 1.5 |  |
| `gameTopBarProgress` | 13 | text 400 | 1.32 / 1.5 | colour textMuted |
| `adChip` | 11 | text 700 | 1.3 / 1.3 | colour adBg on adInk |
| `adSize` | 12 | text 400 | 1 / 1 | colour adInk |

**Numbers.** Digits follow the language (doc 10: `۰–۹` in fa/ckb). Lilita One has proportional digits and no `tnum` feature, so the CSS `font-variant-numeric: tabular-nums` on stat values has no effect; scores are start- or end-aligned so widths never need to match. Rubik has `tnum` (use it for the live game-top-bar score only if its jitter is noticed; **Chosen:** not used).

### 3.7 Spacing and layout

- **Scale** (doc 05 `SPACING`): `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32`.
- **Layout steps off the scale** (**Chosen:** named constants, doc 05 `LAYOUT`): screen gutter **20**, gap between blocks **14**.
- **Screen frame** (the mockup phone is 390 × 844 pt): status bar 54 (system), home indicator zone 34 (system). Top bar: min height 66, padding 4 top / 16 inline / 8 bottom, gap 12. Body: padding 6 top / 20 inline / 34 bottom, vertical gap 14 (Settings 20, Privacy and Licences 18, Statistics 16). Overlays (dialogs): padding 28 block / 20 inline.
- **Inside panels:** padding 14 block / 16 inline; small stat panels 12 / 14; row padding 10 / 14; gaps 12 inside rows and panels, 6–10 between a label and its value.

### 3.8 Radii

Scale (doc 05 `RADII`): **xs 6 · sm 10 · md 14 · lg 22**. Components use these exact radii (from the CSS; `tokens.json` → `radii.component`):

button 14 · panel 14 · list 14 · optionCard 14 · offer 14 · dialog 22 · sheetTop 26 · premiumArt 22 · iconButton 12 · iconButtonSmall 11 · heroCap 11 · calendar 12 · toast 12 · art 16 · howToStage 16 · boardPlaceholder 18 · levelTile 10 · iconTile 10 · segment 10 · toggleTrack 10 · toggleKey 10 · weekMark 10 · radio 9 · sliderThumb 9 · groupTabTop 9 · sticker 8 · chip 8 · flag 7 · toggleKnob 7 · weekMarkXs 6 · progressBar 6 · sliderTrack 5 · barTop 5 · weekTag 5 · adBox 4 · confetti 4 · splashBlock 4 · pagerDot 3 · grabber 3 · adChip 3 · busyBlock 2 · logo 0.24 x tile size

**Chosen:** stickers and chips use **8**, as drawn; the mockup's token card labels "xs 6 — stickers, chips", but no sticker or chip is drawn at 6. Logo tiles use 0.24 × their size.

### 3.9 Strokes

- **Scale** (doc 05 `STROKE`): **hair 2** (row separators, score-panel rule, stat-list rules, banner dashes, flag edge, small week marks), **tile 2.5** (level tiles, segments, stickers, chips, icon tiles, toggle knob, slider track, progress bar, group tab, week marks, pause keys, chart bars, pager dots, confetti), **bold 3** (buttons, icon buttons, panels, lists, option cards, radio, toggle track, dialog, calendar, art tiles, logo tiles, hero cap, slider thumb, board placeholder, offer box, how-to stage).
- **Others:** splash logo 4; week "Today" tag 1.5; chart baseline 3; slider and progress fill end edge 2.5.
- **Dashed** (`borderStyle: 'dashed'`): locked tile and locked pack (2.5 / 3 in `inkSoft`), disabled button (3 in `inkSoft`), missed and today week marks, the Continue offer box (3 in `outline`), banner slot (2 in `adLine`), the top-bar demo frame and the board placeholder (mock only).
- **Icon strokes** on the 24 grid: 2.5 (regular), 3.1 (bold: check, close, chevron, dash), 3.6 (heavy: gear teeth), 1.4 (the rounded edge on filled shapes); star rating edges 1.8 (2.2 on 13 pt mini stars). Icon strokes scale with the icon size.

### 3.10 Elevation, hard shadows and press offsets

Shadow = CSS `box-shadow: 0 <e>px 0 <shadow>`: offset straight down by the elevation *e*, blur 0, spread 0, colour `shadow`. Scale (doc 05 `ELEVATION`):

| Elevation | pt | Used by |
|---|---|---|
| flat | 0 | panels, lists, rows, chips, toasts, stickers, quiet buttons |
| `knob` | 2 | toggle knob |
| `tile` | 3 | level tiles, segments, slider thumb, pause toggle keys |
| `iconButton` | 4 | icon buttons (48 and 44) |
| `control` | 5 | buttons, row buttons, home keys, option cards |
| `hero` | 6 | the hero key |
| `dialog` | 8 | dialogs (static) |

**Chosen:** 2 and 4 come from the CSS (`.tg i`, `.ibtn`); the mockup's elevation card lists only 0 / 3 / 5 / 6 / 8.

**Press offsets** (`tokens.json` → `press`):

| Control | Pressed transform | Shadow | Reduce motion |
|---|---|---|---|
| Buttons, hero key, row buttons, keys | translateY(*e*) scale(1.03, 0.94) | → 0 | translateY(*e*) only |
| Icon button | translateY(4) scale(1.05, 0.93) | → 0 | translateY(4) only |
| Level tile | translateY(3) scale(1.04, 0.94) | → 0 | translateY(3) only |
| Quiet button | scale(0.97), background `sunken` | none | no scale |
| Selected segment / option card / "on" pause key | translateY(*e*), static | none | same |
| Disabled button | translateY(*e*), `sunken` fill, `inkSoft` text, dashed `inkSoft` edge | none | same |
| Busy button | translateY(*e*), label kept, hop blocks | none | static blocks |
| Locked level tile | translateY(3), dashed, `sunken` | none | same |

Transforms scale around the control's centre; the shadow travels with the control (it ends exactly under it at full press).

### 3.11 Motion

Easings: **boing** `cubic-bezier(.34, 1.7, .6, 1)` (overshoots about 14 %), **slide** `cubic-bezier(.2, .8, .2, 1)`, ease-out `(0, 0, .58, 1)`, ease-in-out `(.42, 0, .58, 1)`.

| Moment | Duration | Easing / spring | Keyframes | Reduce motion |
|---|---|---|---|---|
| Press in: sink and squash | 70 ms | ease-out | depth 0 → 1 (section 3.10) | sink without squash; shadow swap instant |
| Release: spring back | 320 ms | boing; React Native `withSpring({ damping: 12, stiffness: 420, mass: 1 })` | depth 1 → 0 with overshoot | instant return |
| Fill colour change (press, select) | 120 ms | ease (ease-out while pressing) | — | instant |
| Toggle knob slides | 300 ms | boing | start → end (22 pt) | instant |
| Result stars pop in, one by one | 540 ms each, delays 250 / 400 / 550 ms | boing | scale 0, −30° → 1.22, 8° (55 %) → 0.94, −2° (78 %) → 1, 0° | all three shown filled at once, 120 ms fade |
| Sticker slap (win title, New best, Premium active) | 420 ms, delays 700 ms (win title) and 950 ms (New best) | boing | from scale 1.7, tilt − 14°, opacity 0 → scale 1, tilt, opacity 1 | 120 ms fade |
| Toast drops in | 380 ms, delay 500 ms | boing | translateY 22, scale 0.9, opacity 0 → rest | 120 ms fade |
| Screen push | 260 ms | slide; moves in the reading direction (mirrors in RTL) | — | 150 ms cross-fade |
| Current level tile bobs | 1600 ms loop | ease-in-out | translateY 0 → −3 → 0 | no loop |
| Busy blocks hop (buttons, splash) | 900 ms loop, 120 ms stagger | boing | 0 % / 60 % / 100 %: 0; 30 %: −7 | static blocks plus the busy text |
| Hold to confirm (S14 reset) | 2000 ms | linear fill from the start edge (**Chosen**: the mockup draws a static 46 % fill) | `dangerFill` width 0 → 100 % | unchanged (functional timer, `ReduceMotion.Never`) |

**Chosen:** `mass: 1` is written out because Reanimated 4.5.1's `withSpring` defaults mass to 4 (read in its `springConfigs.ts`), which would make the release twice as slow and much bouncier. With mass 1 the spring overshoots about 38 % of the press depth (1.9 pt on a 5 pt key) where the CSS curve overshoots about 14 %; if parity of the motion itself is ever tested, use `withTiming(0, { duration: 320, easing: Easing.bezier(0.34, 1.7, 0.6, 1) })`, which reproduces the CSS exactly.

### 3.12 Icons

- **Grid:** `viewBox 0 0 24 24`, drawn in one colour (tinted by the theme). Default size 24 pt; components use 12–64 pt (sizes per component in section 4). Only `back`, `chevron`, `forward` and `undo` mirror in RTL; play, clocks, stars, logos and pictures never do.
- **Layers.** Each icon is a list of layers drawn in order in one colour. `stroke w` = the path stroked at width *w* with round caps and round joins; `fill` = filled with the nonzero rule; `fill even-odd` = the lock body with its keyhole; filled shapes also get a `stroke 1.4` with a butt cap and round join (the CSS `.j` class) that rounds their corners. Rects and circles of the mockup are written here as exact path data (arcs), so every layer goes straight into `Skia.Path.MakeFromSVGString`.
- **Into one path.** Doc 05's `Icon` rasterizes one nonzero path per icon. `packages/tooling/src/art/build-icon-paths.ts` (section 9.6) strokes each layer (`Skia.Path.Stroke`), unions them (`Skia.Path.MakeFromOp(…, Union)`), converts the result to the nonzero rule (`Skia.Path.AsWinding`: path ops return even-odd paths, and an SVG string loses the fill type), rounds to 2 decimals and writes `icon-paths.ts`. Verified: all 41 icons rendered correctly in a contact sheet; without the winding step, `mail`, `globe`, `theme` and `eye` filled solid.

| Icon | HTML name | Mirrors in RTL | Layers, in draw order |
|---|---|---|---|
| `play` | `play` | no | fill: `M8 5c0-1 1.1-1.6 1.9-1l10 6.9c.7.5.7 1.6 0 2.1l-10 6.9c-.8.6-1.9 0-1.9-1z`<br>stroke 1.4 (butt cap, round join): `M8 5c0-1 1.1-1.6 1.9-1l10 6.9c.7.5.7 1.6 0 2.1l-10 6.9c-.8.6-1.9 0-1.9-1z` |
| `pause` | `pause` | no | fill: `M7.1 4.5H8.7A1.6 1.6 0 0 1 10.3 6.1V17.9A1.6 1.6 0 0 1 8.7 19.5H7.1A1.6 1.6 0 0 1 5.5 17.9V6.1A1.6 1.6 0 0 1 7.1 4.5Z`<br>fill: `M15.3 4.5H16.9A1.6 1.6 0 0 1 18.5 6.1V17.9A1.6 1.6 0 0 1 16.9 19.5H15.3A1.6 1.6 0 0 1 13.7 17.9V6.1A1.6 1.6 0 0 1 15.3 4.5Z` |
| `gear` | `gear` | no | stroke 3.6: `M12 2.9v2M12 19.1v2M2.9 12h2M19.1 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4`<br>stroke 2.5: `M5.9 12A6.1 6.1 0 1 0 18.1 12A6.1 6.1 0 1 0 5.9 12Z`<br>fill: `M9.7 12A2.3 2.3 0 1 0 14.3 12A2.3 2.3 0 1 0 9.7 12Z` |
| `back` | `back` | yes | stroke 2.5: `M10.5 5 3.8 12l6.7 7M4.6 12h15.6` |
| `star-filled` | `star` | no | fill: `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z`<br>stroke 1.4 (butt cap, round join): `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z` |
| `star-outline` | `starEmpty` | no | stroke 2.5: `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z` |
| `lock` | `lock` | no | stroke 2.5: `M8 10.8V8a4 4 0 0 1 8 0v2.8`<br>fill even-odd: `M7.5 10.5h9A2.5 2.5 0 0 1 19 13v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5a2.5 2.5 0 0 1 2.5-2.5zM12 13.4a1.5 1.5 0 0 0-.85 2.74V18h1.7v-1.86A1.5 1.5 0 0 0 12 13.4z` |
| `crown` | `crown` | no | fill: `M3.4 7.6l4.8 4.1L12 4.9l3.8 6.8 4.8-4.1-1.9 10.1H5.3z`<br>stroke 1.4 (butt cap, round join): `M3.4 7.6l4.8 4.1L12 4.9l3.8 6.8 4.8-4.1-1.9 10.1H5.3z`<br>stroke 2.5: `M5.6 20.8h12.8` |
| `calendar` | `calendar` | no | stroke 2.5: `M6 5.5H18A2.5 2.5 0 0 1 20.5 8V18A2.5 2.5 0 0 1 18 20.5H6A2.5 2.5 0 0 1 3.5 18V8A2.5 2.5 0 0 1 6 5.5Z`<br>stroke 2.5: `M3.5 10.5h17M8 3.3v4M16 3.3v4`<br>fill: `M14.3 13.5H16.1A0.9 0.9 0 0 1 17 14.4V16.2A0.9 0.9 0 0 1 16.1 17.1H14.3A0.9 0.9 0 0 1 13.4 16.2V14.4A0.9 0.9 0 0 1 14.3 13.5Z` |
| `stats` | `stats` | no | fill: `M4.8 12H6.8A1.3 1.3 0 0 1 8.1 13.3V19.2A1.3 1.3 0 0 1 6.8 20.5H4.8A1.3 1.3 0 0 1 3.5 19.2V13.3A1.3 1.3 0 0 1 4.8 12Z`<br>fill: `M11 4.5H13A1.3 1.3 0 0 1 14.3 5.8V19.2A1.3 1.3 0 0 1 13 20.5H11A1.3 1.3 0 0 1 9.7 19.2V5.8A1.3 1.3 0 0 1 11 4.5Z`<br>fill: `M17.2 8.5H19.2A1.3 1.3 0 0 1 20.5 9.8V19.2A1.3 1.3 0 0 1 19.2 20.5H17.2A1.3 1.3 0 0 1 15.9 19.2V9.8A1.3 1.3 0 0 1 17.2 8.5Z` |
| `sound` | `sound` | no | fill: `M3.8 9.2h3.4l4.6-4v13.6l-4.6-4H3.8z`<br>stroke 1.4 (butt cap, round join): `M3.8 9.2h3.4l4.6-4v13.6l-4.6-4H3.8z`<br>stroke 2.5: `M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.2a8 8 0 0 1 0 11.6` |
| `music` | `music` | no | stroke 2.5: `M9.5 17.5V6l10-2.3v11.6`<br>fill: `M4.1 17.5A2.9 2.9 0 1 0 9.9 17.5A2.9 2.9 0 1 0 4.1 17.5Z`<br>fill: `M14.1 15.3A2.9 2.9 0 1 0 19.9 15.3A2.9 2.9 0 1 0 14.1 15.3Z` |
| `vibration` | `vibration` | no | stroke 2.5: `M10 3.6H14A2.2 2.2 0 0 1 16.2 5.8V18.2A2.2 2.2 0 0 1 14 20.4H10A2.2 2.2 0 0 1 7.8 18.2V5.8A2.2 2.2 0 0 1 10 3.6Z`<br>stroke 2.5: `M4.3 8.5v7M19.7 8.5v7M1.6 10.5v3M22.4 10.5v3` |
| `globe` | `globe` | no | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M3.6 12h16.8M12 3.3c2.5 2.4 3.8 5.3 3.8 8.7s-1.3 6.3-3.8 8.7c-2.5-2.4-3.8-5.3-3.8-8.7S9.5 5.7 12 3.3z` |
| `restore` | `restore` | no | stroke 2.5: `M19.3 13.2A7.5 7.5 0 1 1 17 6.6`<br>fill: `M20.2 3.6 20 9.9l-6-1.8z`<br>stroke 1.4 (butt cap, round join): `M20.2 3.6 20 9.9l-6-1.8z` |
| `info` | `info` | no | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M12 11v5.6`<br>fill: `M10.45 7.7A1.55 1.55 0 1 0 13.55 7.7A1.55 1.55 0 1 0 10.45 7.7Z` |
| `trash` | `trash` | no | stroke 2.5: `M3.8 6.5h16.4M9.5 6.5V4h5v2.5M6.2 6.5l.9 12.6a1.6 1.6 0 0 0 1.6 1.4h6.6a1.6 1.6 0 0 0 1.6-1.4l.9-12.6M10 10.5v6M14 10.5v6` |
| `check` | `check` | no | stroke 3.1: `m4.6 12.6 4.7 4.7L19.4 7` |
| `close` | `close` | no | stroke 3.1: `M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7` |
| `chevron` | `chevron` | yes | stroke 3.1: `m9.2 5.2 6.8 6.8-6.8 6.8` |
| `forward` | `forward` | yes | stroke 2.5: `M13.5 5l6.7 7-6.7 7M19.4 12H3.8` |
| `home` | `home` | no | stroke 2.5: `M3.5 11.2 12 4l8.5 7.2M6 9.6V19a1.5 1.5 0 0 0 1.5 1.5h3v-5.4h3v5.4h3A1.5 1.5 0 0 0 18 19V9.6` |
| `grid` | `grid` | no | fill: `M5.3 3.5H9.1A1.8 1.8 0 0 1 10.9 5.3V9.1A1.8 1.8 0 0 1 9.1 10.9H5.3A1.8 1.8 0 0 1 3.5 9.1V5.3A1.8 1.8 0 0 1 5.3 3.5Z`<br>fill: `M14.9 3.5H18.7A1.8 1.8 0 0 1 20.5 5.3V9.1A1.8 1.8 0 0 1 18.7 10.9H14.9A1.8 1.8 0 0 1 13.1 9.1V5.3A1.8 1.8 0 0 1 14.9 3.5Z`<br>fill: `M5.3 13.1H9.1A1.8 1.8 0 0 1 10.9 14.9V18.7A1.8 1.8 0 0 1 9.1 20.5H5.3A1.8 1.8 0 0 1 3.5 18.7V14.9A1.8 1.8 0 0 1 5.3 13.1Z`<br>fill: `M14.9 13.1H18.7A1.8 1.8 0 0 1 20.5 14.9V18.7A1.8 1.8 0 0 1 18.7 20.5H14.9A1.8 1.8 0 0 1 13.1 18.7V14.9A1.8 1.8 0 0 1 14.9 13.1Z` |
| `book` | `book` | no | stroke 2.5: `M3.5 5.8c2.9-1.2 5.8-1 8.5.9 2.7-1.9 5.6-2.1 8.5-.9v12.8c-2.9-1.2-5.8-1-8.5.9-2.7-1.9-5.6-2.1-8.5-.9zM12 6.7v12.8` |
| `chain` | `chain` | no | stroke 2.5: `M10.2 13.8l-1.9 1.9a3.3 3.3 0 0 1-4.7-4.7l2.6-2.6a3.3 3.3 0 0 1 4.7 0M13.8 10.2l1.9-1.9a3.3 3.3 0 0 1 4.7 4.7l-2.6 2.6a3.3 3.3 0 0 1-4.7 0M9.6 14.4l4.8-4.8` |
| `mail` | `mail` | no | stroke 2.5: `M5.4 5.5H18.6A2.2 2.2 0 0 1 20.8 7.7V16.3A2.2 2.2 0 0 1 18.6 18.5H5.4A2.2 2.2 0 0 1 3.2 16.3V7.7A2.2 2.2 0 0 1 5.4 5.5Z`<br>stroke 2.5: `m4.2 7.4 7.8 5.9 7.8-5.9` |
| `shield` | `shield` | no | stroke 2.5: `M12 3.3l7.2 2.9v5.3c0 4.5-3 8-7.2 9.2-4.2-1.2-7.2-4.7-7.2-9.2V6.2z`<br>stroke 2.5: `m8.8 12 2.3 2.3 4.2-4.4` |
| `doc` | `doc` | no | stroke 2.5: `M6.8 3.5h7l4.4 4.4v11.1a1.5 1.5 0 0 1-1.5 1.5H6.8A1.5 1.5 0 0 1 5.3 19V5a1.5 1.5 0 0 1 1.5-1.5zM13.5 3.8v4.4h4.4M8.7 12.5h6.6M8.7 16h6.6` |
| `wifi-off` | `wifiOff` | no | stroke 2.5: `M2.6 8.6a14 14 0 0 1 18.8 0M5.6 12a9.5 9.5 0 0 1 12.8 0M8.8 15.3a5 5 0 0 1 6.4 0M3.6 3.6l16.8 16.8`<br>fill: `M10.5 19.2A1.5 1.5 0 1 0 13.5 19.2A1.5 1.5 0 1 0 10.5 19.2Z` |
| `clock` | `clock` | no | stroke 2.5: `M3.3 12A8.7 8.7 0 1 0 20.7 12A8.7 8.7 0 1 0 3.3 12Z`<br>stroke 2.5: `M12 7.2V12l3.3 2.2` |
| `alert` | `alert` | no | stroke 2.5: `M10.4 4.4a1.8 1.8 0 0 1 3.2 0l7.3 13.3a1.8 1.8 0 0 1-1.6 2.7H4.7a1.8 1.8 0 0 1-1.6-2.7z`<br>stroke 2.5: `M12 9.5v4.3`<br>fill: `M10.55 16.9A1.45 1.45 0 1 0 13.45 16.9A1.45 1.45 0 1 0 10.55 16.9Z` |
| `endless` | `endless` | no | stroke 2.5: `M12 12c-1.6-2.1-3-3.4-4.9-3.4a3.4 3.4 0 0 0 0 6.8c1.9 0 3.3-1.3 4.9-3.4s3-3.4 4.9-3.4a3.4 3.4 0 0 1 0 6.8c-1.9 0-3.3-1.3-4.9-3.4z` |
| `undo` | `undo` | yes | stroke 2.5: `M8.5 5.5 4 10l4.5 4.5`<br>stroke 2.5: `M4.6 10H15a5 5 0 0 1 0 10h-3` |
| `hint` | `hint` | no | stroke 2.5: `M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z` |
| `ad` | `ad` | no | stroke 2.5: `M5.5 5H18.5A2.5 2.5 0 0 1 21 7.5V16.5A2.5 2.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5V7.5A2.5 2.5 0 0 1 5.5 5Z`<br>fill: `M10 9.2v5.6l4.6-2.8z`<br>stroke 1.4 (butt cap, round join): `M10 9.2v5.6l4.6-2.8z` |
| `hash` | `hash` | no | stroke 2.5: `M9.6 4 8 20M16 4l-1.6 16M4.5 9h15.5M4 15h15.5` |
| `theme` | `theme` | no | stroke 2.5: `M3.4 12A8.6 8.6 0 1 0 20.6 12A8.6 8.6 0 1 0 3.4 12Z`<br>fill: `M12 3.4a8.6 8.6 0 0 1 0 17.2z` |
| `eye` | `eye` | no | stroke 2.5: `M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z`<br>fill: `M8.9 12A3.1 3.1 0 1 0 15.1 12A3.1 3.1 0 1 0 8.9 12Z` |
| `motion` | `motion` | no | stroke 2.5: `M2.8 12h3.4l2.6-5.5 4.2 11 2.6-5.5h5.6` |
| `bug` | `bug` | no | stroke 2.5: `M12 7.6H12A5 5 0 0 1 17 12.6V15A5 5 0 0 1 12 20H12A5 5 0 0 1 7 15V12.6A5 5 0 0 1 12 7.6Z`<br>stroke 2.5: `M12 11v9M7 13H3.6M20.4 13H17M7.4 17.4l-2.8 2M16.6 17.4l2.8 2M7.5 9.6 5 7.2M16.5 9.6 19 7.2M9.4 7.8a2.6 2.6 0 0 1 5.2 0` |
| `dash` | `dash` | no | stroke 3.1: `M7 12h10` |

**Star rating (two colours, not an `Icon`).** The rating star is the path `M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z`. Filled: fill `starOn`, edge stroke 1.8 (2.2 on 13 pt mini stars) in `border`, round join. Hollow: no fill, edge 1.8 in `starOff` (`onPrimary` on the current level tile). In code: two stacked icon rasters of that path (a `fill` layer and a `stroke 1.8` layer, each tinted) for tiles and rows; a Skia canvas for the animated result stars (section 4.15). The `star-filled` and `star-outline` icons above are the single-colour glyphs for icon tiles and rows.

### 3.13 Logos and pictures (multi-colour art)

These are Skia canvases (doc 05 rule 45: at most 8 per screen outside the board) and are **never mirrored**.

**Game logos** (`viewBox 0 0 48 48`, drawn at 88 % of the logo tile, section 4.23). Roles: `p` = fill `pop` + toy-ink stroke 2.6, round join; `w` = fill white + toy-ink stroke 2.6, round join; `w0` = fill white; `k` = fill toy ink; `kl` = toy-ink stroke 2.6, round cap and join; `pl` = `pop` stroke 4, round cap. Toy ink is `#1D1B3A` in both themes.

| Game | Layers (role: path), in draw order |
|---|---|
| Line Siege | `p`: `M22 2.5H26A1.5 1.5 0 0 1 27.5 4V16A1.5 1.5 0 0 1 26 17.5H22A1.5 1.5 0 0 1 20.5 16V4A1.5 1.5 0 0 1 22 2.5Z`<br>`w`: `M7 42V16h7.5v5.5h4.3V16h10.4v5.5h4.3V16H41v26z`<br>`kl`: `M7 30h34M7 36.3h34M16 30v6.3M32 30v6.3M24 36.3V42M24 21.5V30` |
| Flock Tilt | `pl`: `M4 42.5 44 35`<br>`kl`: `M16.5 33v6.5M22.5 34v6.5M28.5 34v6.5` (transform `rotate(-10 24 27)`)<br>`w`: `M11.5 31a5 5 0 0 1 .5-9.5 6.2 6.2 0 0 1 10.5-4.6 6.2 6.2 0 0 1 10.7 2.4 5.2 5.2 0 0 1 .3 10.2 5.2 5.2 0 0 1-7.2 3.3 6.2 6.2 0 0 1-8.6.2 5 5 0 0 1-6.2-2z` (transform `rotate(-10 24 27)`)<br>`k`: `M31.1 21.5A5.4 6.4 0 1 0 41.9 21.5A5.4 6.4 0 1 0 31.1 21.5Z` (transform `rotate(-10 24 27)`)<br>`w0`: `M36.8 20.2A1.5 1.5 0 1 0 39.8 20.2A1.5 1.5 0 1 0 36.8 20.2Z` (transform `rotate(-10 24 27)`) |
| Scrap Shove | `kl`: `M24 12.5V7.5M9.5 24H5.8M38.5 24h3.7`<br>`p`: `M20.7 6.2A3.3 3.3 0 1 0 27.3 6.2A3.3 3.3 0 1 0 20.7 6.2Z`<br>`p`: `M17 35H31A2 2 0 0 1 33 37V40.5A2 2 0 0 1 31 42.5H17A2 2 0 0 1 15 40.5V37A2 2 0 0 1 17 35Z`<br>`w`: `M15 12.5H33A5.5 5.5 0 0 1 38.5 18V30A5.5 5.5 0 0 1 33 35.5H15A5.5 5.5 0 0 1 9.5 30V18A5.5 5.5 0 0 1 15 12.5Z`<br>`k`: `M15 22.5A3.5 3.5 0 1 0 22 22.5A3.5 3.5 0 1 0 15 22.5Z`<br>`kl`: `M26.5 19.5l6 6M32.5 19.5l-6 6M18 30.2h12` |

**Statistics empty picture** (S10, `viewBox 0 0 190 150`, drawn 190 pt wide), in draw order: lid `M34 66 48 24 150 36 142 74z` rotated −6° about (90, 50), fill `pop`, `outline` stroke 2.5; dashed star `M95 33l5.5 11.2 12.3 1.8-8.9 8.7 2.1 12.2L95 60.1l-11 5.8 2.1-12.2-8.9-8.7 12.3-1.8z`, no fill, `ink` stroke 3, dash 5 5, round join; box rect x 30 y 68 w 130 h 72 r 10, fill `accent`, `outline` stroke 2.5; rim line `M30 88h130`, `ink` stroke 3.5, round cap and join; label rect x 80 y 98 w 30 h 20 r 4, fill white, toy-ink stroke 2.5.

**How-to-play pictures** (S13) are game art; the mockup's placeholders only fix the frame (section 4.30) and the style roles a game may reuse: board `sunken` fill + `outline` 3; cell grid `inkSoft` at 35 % opacity, stroke 1.5, radius 5; blocks `accent` + `outline` 2.5; beams and bursts `pop`; ghost moves `inkSoft` stroke 2.5 dashed 4 5; direction arrows `ink` stroke 3.5, round.

---

## 4. Components

Every part the mockup draws, with anatomy, measurements (in pt, exactly as `design/toybox/tokens.json` → `components` lists them), states and do / don't. Colour names are the roles of section 3. "Radius", "border" and "elevation" follow sections 3.8–3.10.

### 4.1 Button (kinds × states)

**Anatomy:** a raised key: face (fill, 3 pt outline, radius 14) on a hard shadow of 5; content row centred, gap 10: optional start icon (24), label (`label` role: 17 Rubik Bold, line height 1.25), optional end icon (24).

*Measurements* (`components.button`): minHeight 54 · paddingBlock 10 · paddingInline 18 · gap 10 · radius 14 · border 3 · elevation 5 · iconSize 24 · label type.roles.label.

| Kind | Fill | Label and icons | Edge |
|---|---|---|---|
| primary | `accent` | `onAccent` | `outline` |
| secondary (default) | `surface` | `ink` (row-button descriptions `inkSoft`) | `outline` |
| pop | `pop` | `onPop` | `outline` |
| danger | `surface` | `danger` | `danger` |
| quiet | none (transparent 3 pt edge keeps the layout) | `ink`, underlined 2 pt, offset 5 | none, no shadow |

**States:** default · pressed (translateY 5, scale 1.03 × 0.94, shadow 0; quiet: scale 0.97 and `sunken` fill) · disabled (`sunken` fill, `inkSoft` label, dashed `inkSoft` edge, sits at translateY 5, no shadow; quiet: transparent, `inkSoft`, no transform) · busy (label kept, the icon replaced by three hopping 9 pt blocks in the label colour, section 4.24; sits at translateY 5, no shadow). **Block** buttons stretch to the body width. Two side-by-side buttons use a 2-column grid with gap 12 (`.two`).

Quiet button: *Measurements* (`components.quietButton`): minHeight 44 · paddingBlock 8 · paddingInline 10 · underlineThickness 2 · underlineOffset 5 · elevation 0.

**Do:** keep the label on one line where it fits; let it wrap (centred) at 200 % text. Put the icon at the start, except forward arrows ("Next", "Continue"), which sit at the end.

**Don't:** use accent for destructive actions; put two primary buttons side by side (a pair is secondary + primary: Later / Restart now, Previous / Next); give a quiet button a shadow.

### 4.2 Hero key (the one big "go")

**Anatomy:** a primary button 80 tall with elevation 6 and the `heroKeyLabel` style (25, display face). With a **cap** (Play, Resume, Try again, Buy, Play a level): a 50 × 50 square at the start (3 pt `outline` edge, radius 11, `surface` fill, 26 pt `ink` icon), start padding 12, content start-aligned, gap 10. Without a cap (Continue, Next level, Choose options): label centred, forward icon at the end.

*Measurements* (`components.heroKey`): minHeight 80 · paddingBlock 10 · paddingInline 18 · paddingStartWithCap 12 · gap 10 · radius 14 · border 3 · elevation 6 · capSize 50 · capRadius 11 · capBorder 3 · capIcon 26 · label type.styles.heroKeyLabel.

**States:** as 4.1 with elevation 6 (pressed translateY 6; busy and disabled pushed in; disabled cap keeps its square). **Do:** one per screen (rule 13), always `block`. **Don't:** put two lines of text in it; use it for Cancel or destructive actions.

### 4.3 Row button (menu card)

**Anatomy:** a block button laid out as a row, start-aligned, min height 68, padding 10 × 14, gap 12: icon tile (4.12) · text column (label 17 Rubik Bold, gap 1, description `rowButtonDescription` 14) · chevron 22 at the end. Used for "Endless – Best 4,210" (secondary, accent icon tile) and the Premium key (pop, gold icon tile).

*Measurements* (`components.rowButton`): minHeight 68 · paddingBlock 10 · paddingInline 14 · gap 12 · chevron 22 · labelGap 1.

**States:** as 4.1 (elevation 5). **Don't:** use it inside a list (lists use flat rows, 4.11).

### 4.4 Home keys

**Anatomy:** three secondary buttons in a 3-column grid (gap 10), each 94 tall, padding 10 × 6, content stacked and centred, gap 6: icon 30, label 15 Rubik Bold (line height 1.2 / 1.4), up to two lines. Levels (`grid`), Statistics (`stats`), How to play (`book`).

*Measurements* (`components.key`): minHeight 94 · paddingBlock 10 · paddingInline 6 · gap 6 · icon 30 · columns 3 · columnGap 10.

**States:** as 4.1. **Do:** at 200 % text stack the three keys vertically (doc 05 rule 49).

### 4.5 Icon button

**Anatomy:** a 48 × 48 raised square (radius 12) or 44 × 44 (radius 11, `sm`), 3 pt `outline` edge, `surface` fill, 24 pt `ink` icon centred, elevation 4. Back (start of every top bar), settings gear, pause, undo and hint (game top bar). Needs an accessibility label (doc 05 rule 36).

*Measurements* (`components.iconButton`): size 48 · sizeSmall 44 · radius 12 · radiusSmall 11 · border 3 · elevation 4 · icon 24.

**States:** default · pressed (translateY 4, scale 1.05 × 0.93, shadow 0; reduce motion: translateY only) · disabled (as 4.1). **Don't:** go below 44 pt; use an icon button without a label.

### 4.6 Toggle

**Anatomy:** track 58 × 36, radius 10, 3 pt `outline` edge; knob 26 × 26, radius 7, 2.5 pt `outline` edge, `surface` fill, knob shadow 2, inset 2 from the track's inner edge; the knob holds a 15 pt icon: `check` when on, `dash` when off.

*Measurements* (`components.toggle`): width 58 · height 36 · radius 10 · border 3 · knob 26 · knobRadius 7 · knobBorder 2.5 · knobInset 2 · knobTravel 22 · knobElevation 2 · knobIcon 15.

**States:** off (track `sunken`, knob at the start, dash) · on (track `accent`, knob at the end: travels 22, check) · slide 300 ms boing. The toggle itself is not a separate target: the whole 60 pt settings row is the switch (`accessibilityRole="switch"`, `accessibilityState.checked`). **Do:** keep the check / dash (rule 10). **Don't:** use colour alone; animate under reduce motion.

### 4.7 Segmented control

**Anatomy:** a row of equal segments (flex 1 each), gap 8, each min 48 tall, padding 5 × 3, radius 10, 2.5 pt `outline` edge, `surface` fill, elevation 3; label 15 Rubik Bold centred (14 inside a settings row), wraps and hyphenates; optional preview line 13 regular under it (the Numbers row shows `123` / `123` / `۱۲۳`).

*Measurements* (`components.segmentedControl`): minHeight 48 · gap 8 · radius 10 · border 2.5 · elevation 3 · paddingBlock 5 · paddingInline 3 · checkIcon 15.

**States:** unselected (raised) · selected (`accent` fill, `onAccent` text, 15 pt check icon before the label, pushed in: translateY 3, no shadow) · pressed (**Chosen**, not drawn: as a level tile). One segment is always selected (`accessibilityRole="radio"` inside a radiogroup, or `tab`). **Don't:** show the check on more than one segment.

### 4.8 Slider

**Anatomy:** a 44 pt tall target (min width 120). Track: 14 tall at top 15, radius 5, 2.5 pt `outline` edge, `sunken` fill; fill from the **start edge** to the value in `accent`, closed by a 2.5 pt `outline` edge at its end; thumb 30 × 30 at top 7, radius 9, 3 pt `outline` edge, `surface` fill, shadow 3, centred on the value.

*Measurements* (`components.slider`): height 44 · minWidth 120 · trackTop 15 · trackHeight 14 · trackRadius 5 · trackBorder 2.5 · thumb 30 · thumbTop 7 · thumbRadius 9 · thumbBorder 3 · thumbElevation 3.

**States:** normal · off (the sound or music it controls is off: fill `inkSoft`) · dragging (**Chosen**, not drawn: thumb pushed in, translateY 3, no shadow). Used in settings sub-rows (volume). RTL: fills right to left. **Do:** step in 10 % with VoiceOver adjust actions (**Chosen**).

### 4.9 Progress bar

**Anatomy:** 16 tall (min width 60), radius 6, 2.5 pt `outline` edge, `sunken` track, `accent` fill from the start edge with a 2.5 pt `outline` end edge. S8 pack progress (31 % in the mock). Not interactive.

*Measurements* (`components.progressBar`): height 16 · minWidth 60 · radius 6 · border 2.5 · fillEdge 2.5.

### 4.10 Option card and radio mark (S2, S11a)

**Option card (S2):** a raised row, min 66 tall, padding 10 × 14, gap 12, radius 14, 3 pt `outline` edge, `surface`, elevation 5: language autonym (`optionName` 21 Rubik / Vazirmatn Bold in its own script and direction) · optional sticker ("Phone language", 4.20, small, tilt +3) · radio mark at the end. Selected: `accent` fill, `onAccent` text, pushed in (translateY 5, no shadow), radio shows a check.

*Measurements* (`components.optionCard`): minHeight 66 · paddingBlock 10 · paddingInline 14 · gap 12 · radius 14 · border 3 · elevation 5.

**Radio mark:** 32 × 32 square, radius 9, 3 pt `outline` edge, `surface` fill, 20 pt `check` when selected, empty otherwise.

*Measurements* (`components.radio`): size 32 · radius 9 · border 3 · icon 20.

**Chosen:** the "Phone language" sticker marks the phone's own language; the mockup draws it on the selected option because the default selection is the phone language.

### 4.11 List, row, sub-row and group tab

**List:** a flat panel (3 pt `outline` edge, radius 14, `surface`, no shadow, clips its rows).

*Measurements* (`components.list`): radius 14 · border 3.

**Row:** min 60 tall, padding 10 × 14, gap 12, centred vertically: icon tile (38, 4.12) · text column (label `rowLabel` 17 regular, gap 2, description `rowDescription` 14 `inkSoft`) · end slot: value (`rowValue` 15 `inkSoft`, end-aligned) + chevron 20 `inkSoft`, or a toggle, or a radio mark. Rows after the first have a 2 pt `line` separator on top. **Wrap row:** the end content drops to a full-width line under the label (Numbers and Theme rows carry a segmented control there). **Danger row:** label `danger` Bold, icon tile `dangerFill` with `danger` icon and edge. **Sub-row** (volume under Sound effects and Music): no separator, min height 0, padding top 0, start padding 64 (lines up with the label), label 14 `inkSoft`, then a slider.

*Measurements* (`components.row`): minHeight 60 · paddingBlock 10 · paddingInline 14 · gap 12 · separator 2 · labelGap 2 · chevron 20 · subRowPaddingStart 64.

**Group tab:** a folder tab above each settings list: start margin 14, padding 4 top / 12 inline / 5 bottom, 2.5 pt `outline` edge on top and sides only, top radius 9, `pop` fill, `onPop` text (`groupTab` 15 display face), 16 pt icon, gap 6; it overlaps the list's top edge by 3 so it reads as one piece. It is a heading (`accessibilityRole="header"`).

*Measurements* (`components.groupTab`): marginStart 14 · paddingTop 4 · paddingBottom 5 · paddingInline 12 · border 2.5 · radiusTop 9 · overlap 3 · gap 6 · icon 16.

**Do:** make the whole row the target for chevron and toggle rows. **Don't:** add shadows to rows or lists; put a raised button inside a row.

### 4.12 Icon tile

**Anatomy:** 38 × 38 square, radius 10, 2.5 pt `outline` edge, 22 pt icon. Paints: default `pop` / `onPop`; `acc` `accent` / `onAccent` (Endless card, Premium benefits); `gold` gold / toy ink with toy-ink edge (Premium rows, debug Premium); `danger` `dangerFill` / `danger` with `danger` edge; `plain` `surface` / `ink` (locked pack). In stat panel headers: 34 with a 20 pt icon. Decorative (the row carries the label).

*Measurements* (`components.iconTile`): size 38 · radius 10 · border 2.5 · icon 22 · sizeInStatHeader 34 · iconInStatHeader 20.

### 4.13 Panel (card), note panel, offer box

**Panel:** flat information card: 3 pt `outline` edge, radius 14, `surface`, padding 14 × 16, **no shadow** (rule 1). Variants: daily card (padding 14 / 14 / 16, gap 12), streak cards (padding 12 × 14, gap 4: label 14 Bold `inkSoft` with an 18 pt icon, value `streakValue` 28 display), score panel (4.29), locked pack (dashed edge, `sunken` fill, gap 6).

*Measurements* (`components.panel`): radius 14 · border 3 · paddingBlock 14 · paddingInline 16 · elevation 0.

**Note panel:** a panel laid out as a row, gap 12, top-aligned: 22 pt icon (2 pt top margin) + body text. Error variant (S12): `danger` edge, `dangerFill` fill, `danger` icon.

**Offer box** (S7 lose): a dashed 3 pt `outline` frame, radius 14, padding 14, gap 10, no fill: the pop "Continue – watch an ad" button + a caption.

*Measurements* (`components.offer`): border 3 · style dashed · radius 14 · padding 14 · gap 10.

**Don't:** give a panel a shadow, or make a whole panel pressable (put a button inside it).

### 4.14 Level tile and level grid

**Grid:** 6 columns, row gap 10, column gap 8, packs as sections (doc 05 section 3.9); on the 350 pt body a tile is about 51.7 × 62.

**Tile anatomy:** 62 tall, radius 10, 2.5 pt `outline` edge, `surface`, elevation 3, content stacked and centred, gap 5: number (`levelNumber` 21 display, line height 1) + mini stars (3 × 13 pt, gap 1).

*Measurements* (`components.levelTile`): height 62 · radius 10 · border 2.5 · borderCurrent 3 · elevation 3 · gap 5 · miniStar 13 · miniStarGap 1 · lockIcon 16 · gridColumns 6 · rowGap 10 · columnGap 8 · flag.size 24 · flag.radius 7 · flag.border 2 · flag.ring 2.5 · flag.rotate 8 · flag.top -11 · flag.end -9 · flag.icon 12.

**States:**
- **Completed** (1–3 stars): filled mini stars (`starOn` with a 2.2 edge in `border`) and hollow ones (`starOff`).
- **Current** (the next level): `accent` fill, `onAccent` number and hollow stars, 3 pt edge, bobs (translateY 0 → −3 → 0, 1.6 s loop); a **flag** sticker at the top-end corner: 24 × 24, radius 7, gold, 2 pt toy-ink edge, 2.5 pt white ring, tilt +8°, offset −11 top / −9 end, 12 pt `play` icon.
- **Locked:** `sunken` fill, dashed `inkSoft` edge, `inkSoft` number and a 16 pt `lock` instead of stars, no shadow, pushed in (translateY 3).
- **Pressed:** translateY 3, scale 1.04 × 0.94, shadow 0.
- **Locked, tapped:** focus ring (3 pt, 2 pt gap, section 3.5) and the toast "Unlock this one by finishing level n." (4.19).

**Do:** keep the padlock (shape) and the dashed edge together; label locked tiles for VoiceOver with `levels.level-tile.locked.a11y-label` and the hint key. **Don't:** hatch locked tiles (cut from the design as too busy).

### 4.15 Stars

**Rating star** (section 3.12): filled = `starOn` fill + `border` edge 1.8; hollow = `starOff` edge 1.8. Sizes: **13** on level tiles (edge 2.2), **18** in stickers, **22** in the S8 progress line and stat headers, **34** in rating rows (gap 6), **86 / 102 / 86** on the result screen (the middle star 24 higher, row 124 tall, gap 8, bottom-aligned).

*Measurements* (`components.star`): mini 13 · inline 22 · inSticker 18 · rating 34 · ratingGap 6 · result 86 · resultMiddle 102 · resultMiddleLift 24 · resultRowHeight 124 · resultGap 8.

**Result stars:** a Skia canvas, popping in one by one (section 3.11); `accessibilityLabel` from `result.win.stars.a11y-label` on the row. **Do:** keep filled vs hollow readable in greyscale. **Don't:** colour-code star counts.

### 4.16 Top bar, brand lock and game top bar

**Top bar** (every second-level screen): min 66 tall, padding 4 / 16 / 8, gap 12, centred vertically: back icon button (48, flips in RTL, label `common.back`) · title (`topBarTitle` 27 display, flex 1, `isHeader`) · optional end action (icon button, or a sticker such as the S15 "Test build" badge).

*Measurements* (`components.topBar`): minHeight 66 · gap 12 · back iconButton 48.

**Brand lock** (S4 Home top bar): logo tile 46 · column (gap 6, start-aligned): game name (`gameName` 28, Lilita One, +0.01 em) and, for Premium owners, the xs Premium sticker · settings icon button at the end.

**Game top bar** (S5, S6 background): padding 4 / 14 / 8, gap 10: pause icon button 48 · column: level line (`gameTopBarLevel` 16 Bold) and progress (`gameTopBarProgress` 13 `inkSoft`, the game's `progress` message) · score (`gameTopBarScore` 24 display) · undo and hint icon buttons (44).

**Do:** keep the title on one line where it fits and let it wrap at 200 % text. **Don't:** put more than one end action in a top bar.

### 4.17 Banner ad slot

**Anatomy:** a full-bleed band at the bottom of the body (it cancels the 20 pt gutters), padding 6 block, `adBg` fill with 2 pt dashed `adLine` rules on top and bottom; the ad view centred inside.

*Measurements* (`components.bannerSlot`): paddingBlock 6 · borderDashed 2 · box.width 320 · box.height 50 · box.radius 4 · box.border 2 · chip.inset 4 · chip.paddingBlock 2 · chip.paddingInline 6 · chip.radius 3.

**Mock only:** the dashed 320 × 50 box (radius 4, 2 pt dashed `adLine`), the "Ad" chip at its top-start corner (inset 4, padding 2 × 6, radius 3, `adInk` fill, `adBg` 11 Bold text, `common.ad-label`) and the "320 × 50" label (12, `adInk`) stand in for the creative. The real slot holds doc 11's anchored adaptive banner (full width, height set by Google) and has **zero height until an ad loads** (doc 11 rule 10). **Chosen:** the band (`adBg` + dashed rules) frames the loaded ad; it collapses with the slot.

**Do:** only on Home, Levels and Statistics; pinned below the scrolling content (**Chosen**: the mockup's long Statistics capture shows it at the end of the scroll). **Don't:** style the creative; put it over controls.

### 4.18 Dialog, scrim and hold-to-confirm

**Anatomy:** the scrim covers the whole screen (`scrim`); the overlay centres the dialog with padding 28 × 20, so the dialog is the body width (350 on the reference phone). Dialog: 3 pt `outline` edge, radius 22, `surface`, padding 22 top / 20 inline / 20 bottom, **hard shadow 8** (static), gap 12. Contents, in order: optional art tile (64, 4.22; the reset dialog uses 56 with `dangerFill` / `danger`) · title (`dialogTitle` 25 display, `isHeader`) · body (17) · buttons.

*Measurements* (`components.dialog`): radius 22 · border 3 · paddingTop 22 · paddingInline 20 · paddingBottom 20 · gap 12 · elevation 8 · buttonRowGap 12 · buttonRowMarginTop 6 · buttonMinBasis 120 · pausePaddingTop 20 · pausePaddingInline 18 · pausePaddingBottom 18.

**Buttons:** either a wrap row (gap 12, 6 pt extra top margin, each flex 1 1 120 pt) in start → end order with the **safe choice at the start** (Cancel / Later, then the action), mirroring in RTL; or stacked block buttons (reset: the danger hold button, a caption, then Cancel).

**Hold-to-confirm** (S14 reset): a danger block button whose `dangerFill` layer grows from the start edge under the label while the finger is down (2 s, `dialog.reset-progress.hold-hint`); releasing early empties it; VoiceOver gets an `accessibilityActions` alternative (doc 05 rule 40).

**Pause dialog** (S6): the same card with padding 20 / 18 / 18.

**Do:** always offer a way out; keep the body to two or three lines. **Don't:** put a banner, a sticker or a second hero key in a dialog (the Pause dialog's Resume is its one hero key).

### 4.19 Toast

**Anatomy:** an inverted chip: `toastBg` fill, `toastInk` text (`toast` 15, line height 1.35 / 1.55) and 20 pt icon at the start, padding 12 × 14, radius 12, gap 10, **no outline and no shadow**. It spans the body width (inset 20 each side), drops in (section 3.11) and leaves after about 3 s (**Chosen**; the mockup shows no timing). S12 "restore" results stack toasts with gap 10; a busy toast uses the hop blocks instead of an icon.

*Measurements* (`components.toast`): paddingBlock 12 · paddingInline 14 · radius 12 · gap 10 · icon 20 · stackGap 10.

**Position** (**Chosen:** above the banner slot, 14 pt over the bottom of the body; the S8 mock places it at 352 pt below the top bar, under the tapped tile's row, for illustration). Announce it with `AccessibilityInfo.announceForAccessibility` (doc 05 `use-announce.ts`).

### 4.20 Stickers, Premium badge, "Today" tag

**Sticker anatomy:** a tilted label: padding 5 top and bottom / 9 start / 11 end (**Chosen:** logical; the mockup's CSS pads 9 left / 11 right in both directions), gap 6, radius 8, 2.5 pt toy-ink edge, **3.5 pt white die-cut ring** (`cut`) outside the edge, text `sticker` style (16 display, line height 1.15 / 1.45) in toy ink, optional 18 pt icon or rating star at the start; default tilt −4°, range 2–8° either way; never wider than its container.

*Measurements* (`components.sticker`): paddingBlock 5 · paddingStart 9 · paddingEnd 11 · gap 6 · radius 8 · border 2.5 · ring 3.5 · icon 18 · rotateDefault -4 · rotateRange 2/8 · sm.paddingBlock 3 · sm.paddingStart 7 · sm.paddingEnd 9 · xs.paddingBlock 2 · xs.paddingStart 5 · xs.paddingEnd 7 · xs.gap 4 · xs.icon 14.

**Papers:** gold (default: streak, New best, Phone language, Premium) · `acc` (`accent`: the game's win title, "The wall holds!") · `pop` (`pop`: the Home tagline, tilt −2°) · `ink` (toy ink with **white** text: Locked, Test build). **Sizes:** regular 16; `sm` 14 (padding 3 / 7 / 9); `xs` 12 (padding 2 / 5 / 7, gap 4, 14 pt icon).

**Premium badge:** the xs gold sticker with a `crown`, tilt −5°, under the game name on Home for Premium owners (`home.premium-badge.label`); the S12 "Premium active" sticker is the regular gold one with a crown, tilt −3°, slapped in on success.

**"Today" tag** (S9 week strip): 11 Bold toy ink on gold, padding 1 × 5, radius 5, 1.5 pt toy-ink edge, tilt −4°, no ring.

**Level flag:** see 4.14.

**Do:** reserve stickers for news (principle 3); let long German or Sorani texts wrap inside (max width 100 %). **Don't:** tilt more than 8°; mirror the tilt in RTL (**Chosen**, as the mockup: the same angle in both directions); put a sticker on a raised key.

### 4.21 Chip

**Anatomy:** a small flat label: padding 4 × 12, gap 6, radius 8, 2.5 pt `outline` edge, `surface`, `chip` text (15 Bold). Level chip on results ("Level 12"), "Today" on S9, the version chip (S11b), the step counter (S13). Not interactive.

*Measurements* (`components.chip`): paddingBlock 4 · paddingInline 12 · gap 6 · radius 8 · border 2.5.

### 4.22 Art tile and Premium art

**Art tile:** a 64 × 64 "boxed toy": radius 16, 3 pt toy-ink edge, `pop` fill (or gold), toy-ink 36 pt icon, 4 pt white ring, tilt −5°. Leads S2 (globe), S3 (gold shield) and dialogs (globe, gold restore; reset: 56 pt, `dangerFill` fill, `danger` icon). S11c uses a 52 pt gold shield. Decorative.

*Measurements* (`components.art`): size 64 · radius 16 · border 3 · ring 4 · rotate -5 · icon 36.

**Premium art:** 108 × 108, radius 22, gold, 3 pt toy-ink edge, 5 pt white ring, tilt −6°, 64 pt toy-ink crown (S12).

*Measurements* (`components.premiumArt`): size 108 · radius 22 · border 3 · ring 5 · rotate -6 · icon 64.

### 4.23 Logo tile

**Anatomy:** a square of *s* pt, radius 0.24 *s*, `accent` fill, 3 pt `outline` edge, tilt −4°, the game logo (3.13) at 88 %. Sizes: 46 (Home brand lock), 36 (S10 game panel), 92 (S11b, **cut**: toy-ink edge and a 5 pt white ring), 104 (S7 lose: 6 pt ring, tilt +17°, 6 pt lower), 152 (S1 splash: 4 pt edge, 7 pt ring, tilt −6°). A Skia canvas; never mirrored.

*Measurements* (`components.logoTile`): radiusRatio 0.24 · border 3 · rotate -4 · artScale 0.88 · sizes.home 46 · sizes.statsHeader 36 · sizes.about 92 · sizes.lose 104 · sizes.splash 152 · splash.border 4 · splash.ring 7 · splash.rotate -6 · about.ring 5 · about.border toyInk · lose.ring 6 · lose.rotate 17 · lose.translateY 6.

### 4.24 Busy indicator and splash loader

**Busy blocks:** three 9 × 9 squares (radius 2) in the current text colour, gap 5, hopping 7 pt (900 ms loop, 120 ms stagger). Inside busy buttons (before the label) and the restoring toast. Reduce motion: static. Pair it with `accessibilityState.busy` and a text (`premium.loading`, `premium.purchasing`, `premium.restoring`).

*Measurements* (`components.busy`): block 9 · radius 2 · gap 5 · hop 7.

**Splash loader:** three 14 × 14 squares, radius 4, `ink`, gap 9, the same hop, 44 pt above the bottom of the body; `accessibilityLabel` = `splash.loading.a11y-label`.

*Measurements* (`components.splashLoader`): block 14 · radius 4 · gap 9 · paddingBottom 44.

### 4.25 Pause toggle key

**Anatomy:** one of three keys in a 3-column grid (gap 10) inside the Pause dialog: min 84 tall, padding 6 × 4, gap 3, radius 10, 2.5 pt `outline` edge, `surface`, elevation 3, stacked and centred: 26 pt icon (sound, music, vibration), label 14 Bold, state line 13 regular with a 13 pt check or dash + "On" / "Off" (`common.on` / `common.off`).

*Measurements* (`components.toggleKey`): minHeight 84 · paddingBlock 6 · paddingInline 4 · gap 3 · radius 10 · border 2.5 · elevation 3 · icon 26 · stateIcon 13 · columns 3 · columnGap 10.

**States:** off (raised) · on (`accent` fill, `onAccent`, pushed in: translateY 3, no shadow) · pressed (**Chosen**, not drawn: as a level tile). A switch for VoiceOver.

### 4.26 Calendar tile

**Anatomy:** 88 wide, radius 12, 3 pt `outline` edge, `surface`, tilt −3°, clipped: a month band (`accent` fill, `onAccent` `calendarMonth` 16 display, padding 2 / 0 / 3, 3 pt `outline` bottom edge) over the day number (`calendarDay` 42 display, line height 1.15, padding 4 / 0 / 6). Decorative (the date is also written next to it).

*Measurements* (`components.calendarTile`): width 88 · radius 12 · border 3 · rotate -3 · monthPadding 2/0/3 · dayPadding 4/0/6.

### 4.27 Week strip and legend (S9)

**Anatomy:** seven equal columns (gap 4), each centred with gap 6: weekday letter (`weekdayLetter` 13 Bold `inkSoft`, `date.weekday-strip.1..7`) · mark 38 × 38, radius 10, 2.5 pt edge, 20 pt icon · the "Today" tag under today's mark. Marks: **done** `accent` fill, `onAccent` check · **missed** dashed `inkSoft` edge, `inkSoft` close icon · **today** dashed `outline` edge, `surface` fill, `ink` play icon. Legend (wrap row, gap 8 × 18, 14 top margin, 14 `inkSoft`): 22 pt marks (radius 6, 2 pt edge, 13 pt icon) + "Done" / "Missed". Runs right to left in fa/ckb. Each mark has its own label (`daily.week.day-done.a11y-label`, `…day-missed…`, `daily.today.label`).

*Measurements* (`components.weekStrip`): gap 4 · dayGap 6 · mark 38 · markRadius 10 · markBorder 2.5 · markIcon 20 · markXs 22 · markXsRadius 6 · markXsBorder 2 · markXsIcon 13 · tag.paddingBlock 1 · tag.paddingInline 5 · tag.radius 5 · tag.border 1.5 · tag.rotate -4.

### 4.28 Stat cell, stat grid, stat list

**Stat grid:** 2 columns (or 3, `sgrid three`), gap 14. **Cell:** value (`number` 30 display; 23 and no wrap in 3 columns) over label (`statLabel` 14 `inkSoft`), gap 2.

*Measurements* (`components.statGrid`): columns 2 · columnsCompact 3 · gap 14 · cellGap 2.

**Stat list** (best scores): rows split key / value, baseline-aligned, gap 12, padding 9 block, 2 pt `line` rule between rows (none above the first): key 15 (`statListKey`; the first row is a bold sub-heading with no value), value `statListValue` 22 display, end-aligned.

*Measurements* (`components.statList`): rowPaddingBlock 9 · separator 2 · gap 12.

**Stat panel header:** icon tile 34 (20 pt icon) or logo tile 36 + heading 21 display, gap 10, 12 below.

### 4.29 Score panel and bar chart

**Score panel** (S7 win): a panel; first row (wrap, gap 6 × 12, centred): "Score" (`scoreLabel` 17 Bold `inkSoft`) · value (`scoreValue` 44 display, line height 1) · the "New best!" sticker pushed to the end. Then lines (gap 6, 12 top margin and padding over a 2 pt `line` rule, 16 text): a 20 pt `success` check + the game's full progress line, and the moves line (`result.win.moves`).

**Bar chart** (S10 last 7 days): seven equal columns; each a 124 pt plot area bottom-aligned on a 3 pt `outline` baseline (gap 4): value (`barValue` 13 Bold `ink`) over a bar 26 wide, height = value / max × 92, `accent`, 2.5 pt `outline` edge on top and sides, top radius 5; the day letter (`barDay` 13 Bold `inkSoft`) 6 below. Zero days show only the value. Runs right to left in fa/ckb; each column has `stats.week.bar.a11y-label`.

*Measurements* (`components.barChart`): plotHeight 124 · barWidth 26 · maxBar 92 · barRadiusTop 5 · border 2.5 · baseline 3 · valueGap 4 · dayMarginTop 6.

### 4.30 Pager dots and how-to stage

**Stage:** 3 pt `outline` edge, radius 16, `surface`, padding 12, holding the game's picture (full width, height by its aspect).

*Measurements* (`components.howToStage`): radius 16 · border 3 · padding 12.

**Pager dots:** 12 × 12 squares, radius 3, 2.5 pt `outline` edge, no fill, gap 8; the current step is 30 wide and `accent`. Decorative (the step chip carries the text).

*Measurements* (`components.pagerDots`): size 12 · activeWidth 30 · radius 3 · border 2.5 · gap 8.

### 4.31 Empty state

**Anatomy** (S10 new player): a column centred vertically in the body, start-aligned, gap 14: picture (3.13, 190 wide) · title (`title` 30) · lead (18) · hero key with a play cap · caption (`stats.local-note`).

*Measurements* (`components.emptyIllustration`): width 190 · viewBox 0 0 190 150.

### 4.32 Bottom sheet (Mock only)

The S3 frame shows where Google's consent form appears: scrim, then a sheet from 250 pt to the bottom (top radius 26, padding 12 / 18 / 46, gap 14): grabber 44 × 5 (radius 3) and a dashed, striped placeholder with two lines of text. Google UMP draws the real form natively; the Shell never builds this sheet.

*Measurements* (`components.sheet`): top 250 · radiusTop 26 · paddingTop 12 · paddingInline 18 · paddingBottom 46 · gap 14 · grabber.width 44 · grabber.height 5 · grabber.radius 3.

### 4.33 Hazard strip (S15)

A 20 pt band under the status bar: stripes at −45°, gold and toy ink, 12 pt each, with 3 pt toy-ink rules top and bottom. Test builds only (debug menu). Drawn once by Skia (the only repeating fill).

*Measurements* (`components.hazardStrip`): height 20 · stripe 12 · angle -45 · border 3.

### 4.34 Confetti (S12 success)

Five 16 × 16 squares (radius 4, 2.5 pt toy-ink edge) in `accent`, `pop` and gold, scattered in a 70 pt band and tilted (18°, −12°, 30°, −24°, 8°). Static in the mockup; **Chosen:** they fall with the success sticker's slap timing and are hidden under reduce motion.

*Measurements* (`components.confetti`): size 16 · radius 4 · border 2.5.

### 4.35 Board placeholder (Mock only)

In S6 the dimmed game board is drawn as a dashed 3 pt `inkSoft` frame (radius 18, `sunken`, margin 4 / 14 / 40) with a "game board" label. The real S5 board fills that area (doc 08).

---

## 5. Screens S1–S15

### 5.0 The common frame

All mock screens are 390 × 844 pt with a 54 pt status bar and a 34 pt home-indicator zone (the system's safe areas; on other phones use the real insets). Unless a screen says otherwise:

- **Ground** fills the whole screen, including behind the status bar.
- **Top bar** (4.16) directly under the status bar: min 66, padding 4 / 16 / 8, back button at the start.
- **Body:** a column with padding 6 top, 20 inline, 34 bottom (the home-indicator zone) and **gap 14** between blocks. "grow" below means a flexible spacer (`flex: 1`) that pushes what follows to the bottom.
- **Long screens** (S10, S11, S11c, S11d, S15) scroll; the mockup shows their full scroll height. **Chosen:** the top bar stays fixed and only the body scrolls; the banner (4.17) stays pinned below the scroll.
- **Tablets and wide windows:** the column is centred and at most 640 pt wide (doc 05 rule 48); nothing else changes.
- Keys in brackets are copy-deck keys; `games.<id>.*` are the game's texts.

### 5.1 S1 Splash

Body: centred, gap 0. Column (flex 1, centred, gap 22): logo tile 152 (splash variant: 4 pt edge, 7 pt ring, −6°) → game name (`gameName` 50, 8 pt extra top margin, `games.<id>.name`) → tagline (`splashTagline` 18 `inkSoft`, max 290, centred, `games.<id>.tagline`). Then the splash loader (4.24) 44 above the body bottom (`splash.loading.a11y-label`). No top bar, no banner. The native splash (doc 09) shows the same logo on the same ground, so the hand-off is seamless.

### 5.2 S2 First-run language choice

Body: header column (start-aligned, gap 10, 18 pt top padding): art tile `globe` (4.22) → title (`title` 30, `language-choice.title`) → subtitle (body `inkSoft`, `language-choice.subtitle`). Then the options column (gap 12, 10 extra top margin): four option cards (4.10) in the order English, Deutsch, فارسی, کوردیی ناوەندی, each autonym in its own font and direction (`meta.languageNames`), the phone's language carrying the small "Phone language" sticker (`language-choice.phone-badge`, tilt +3°). grow. Hero key without cap, forward icon at the end (`language-choice.continue-button`). No top bar (first launch), no banner.

### 5.3 S3 Consent moment (and Google's form)

Body: grow → art tile gold `shield` → title (`title`, `consent.intro.title`) → lead (18, `consent.intro.body`) → note panel with `info` icon (`consent.intro.detail`) → grow → hero key without cap, forward at the end (`consent.intro.continue-button`) → caption (`consent.intro.footnote`). The two grows centre the text block between the top and the key. No top bar, no banner.

**Google's form** (second frame): the same screen under the scrim, with Google's sheet on top. **Mock only:** the sheet placeholder (4.32); the real form is Google UMP's (doc 11 section 3.5).

### 5.4 S4 Home

**Top bar:** brand lock (4.16): logo 46, game name 28, the Premium badge for owners; settings icon button at the end (`common.settings`).

**Body** (gap 14), in order:
1. Tagline sticker (pop paper, tilt −2°, `games.<id>.tagline`), start-aligned — only when the game has no Endless mode or the player owns Premium (room on screen).
2. Hero key with a `play` cap: "Continue – Level 12" (`home.play-button.continue`; a new player sees `home.play-button.play`).
3. Daily panel (4.13, padding 14 / 14 / 16, gap 12): header row (gap 12, top-aligned): icon tile `calendar` → text column (heading 21 `daily.title`, date `inkSoft` `date.weekday-day-month`) → small streak sticker (tilt +4°, `chain`, `daily.streak.count`, 2 pt top margin); then a secondary block button with a `play` icon (`daily.today.play-button`). **Not drawn (Chosen):** once today is played, the button is replaced by a row with a 20 pt `check` in `success` and `daily.today.done` (body).
4. Endless row button (only games with Endless): accent icon tile `endless`, "Endless – Best 4,210" (`home.endless-card.label`), description (`home.endless-card.description`), chevron.
5. Home keys (4.4): Levels, Statistics, How to play (`common.levels`, `common.statistics`, `common.how-to-play`).
6. Premium row button (pop; not for owners): gold icon tile `crown`, `home.premium-button.label`, hint `home.premium-button.hint`, chevron.
7. Banner slot (not for owners), pinned to the bottom (`margin-top: auto`).

**Premium variant:** badge under the name, tagline shown, no Premium key, no banner.

### 5.5 S5 Game screen (Shell parts)

Not drawn on its own; its Shell parts come from the S6 frame. Game top bar (4.16): pause icon button → level line (`game-screen.mode.level`, or `game-screen.mode.daily` / `common.mode.endless`) and progress line (`games.<id>.progress`) → score (24 display) → undo and hint icon buttons (44). The board area below it (margin 4 / 14 / 40 in the mock) belongs to the game (doc 08); no banner, no stickers over the board.

### 5.6 S6 Pause

The S5 screen stays visible, dimmed by the scrim. Overlay (padding 28 × 20, centred) holds the Pause dialog (4.18, padding 20 / 18 / 18, gap 12), in order:
1. Header row (baseline-aligned, space-between, wraps, gap 10): title (`title` 30, `pause.title`) and the mode line (`inkSoft`, "Level 12").
2. Hero key with a `play` cap: `pause.resume-button`.
3. Secondary block button, `restore` icon: `pause.restart-button` (opens the restart-level dialog).
4. Secondary block button, `book` icon: `common.how-to-play`.
5. Three pause toggle keys (4.25), gap 10: Sound (on), Music (off), Vibration (on) (`pause.sound`, `pause.music`, `pause.vibration`).
6. Quiet button with a `home` icon, centred, 15 regular (`common.home`).

Never an ad (N8).

### 5.7 S7 Result — win

Body (gap 14): result chip centred (4 pt top padding, `game-screen.mode.level`) → stars row (4.15: 86 / 102 / 86, 124 tall, middle star lifted 24, pop-in) → title (`display` 38, centred, `result.win.title`) → the game's win-title sticker (accent paper, tilt −3°, slap at 700 ms, 2 pt pulled up, centred, `games.<id>.winTitle`) → score panel (4.29: "Score" `common.score`, 1,840, "New best!" sticker tilt +6° slapped at 950 ms `result.win.new-best`; lines: `games.<id>.progress` in full and `result.win.moves`) → grow → hero key without cap, forward at the end (`result.win.next-button`) → two buttons (gap 12): Replay (`restore`, `result.win.replay-button`) and Levels (`grid`, `common.levels`) → quiet nudge with a `crown`, centred, 15 regular (`result.premium-nudge` with the store price; not for owners).

**Not drawn (Chosen):** the **Daily result** uses this layout without the stars row: chip `game-screen.mode.daily`, title `result.daily.title`, the gold streak sticker (`chain`, `daily.streak.count`) in the sub-sticker place, the score panel, caption `result.daily.come-back`, grow, hero key with a `home` cap (`common.home`). The **Endless result**: chip `common.mode.endless`, title `result.endless.title`, score panel with a `common.best-score` line, grow, hero key with a `restore` cap (`common.try-again`), secondary block Home.

### 5.8 S7 Result — lose

Body: result chip centred → grow → lose picture: logo tile 104 (tilt +17°, 6 pt lower, 6 pt ring), centred, padding 8 top / 4 bottom → title (`display`, centred, `result.lose.title`) → reason panel (row, gap 12: 28 pt `alert` icon in `danger` + heading 21 `games.<id>.loseReason`, or `result.lose.reason.no-moves`) → offer box (4.13): pop block button with the `ad` icon (`result.lose.continue-ad`; Premium owners: `result.lose.continue-premium`, **Chosen**: same button with a `play` icon) + caption (`result.lose.continue-note`) → grow → hero key with a `restore` cap (`common.try-again`) → secondary block button with `grid` (`common.levels`).

### 5.9 S8 Levels

Top bar "Levels" (`common.levels`). Body, per pack section:
1. Pack header (row, centred, wraps, gap 6 × 10): heading 21 (`levels.pack.heading` with `games.<id>.packs`, flex 1) and the level count (`inkSoft`, `levels.pack.level-count`).
2. Progress line (row, centred, gap 10, 10 top / 16 bottom margin, 15 Bold): filled star 22 → "28 / 90 stars" (`levels.pack.progress`) → progress bar (flex 1).
3. The level grid (4.14): completed tiles, the current tile with its flag, locked tiles.

Then the next locked pack as a panel (dashed, `sunken`, gap 6): header row (plain icon tile `lock` → heading → small ink sticker "Locked" tilt −4° `levels.pack.locked-badge`) → requirement in Bold (`levels.pack.requirement`) → explanation (`inkSoft`, `levels.pack.locked`). Banner slot at the bottom. Tapping a locked tile shows its focus ring and the toast (4.19, `levels.level-tile.locked-toast`).

### 5.10 S9 Daily challenge

Top bar "Daily challenge" (`daily.title`). Body (gap 14):
1. Today panel (row, centred, gap 18): calendar tile (4.26) → column (start-aligned, gap 8): chip "Today" (`daily.today.label`) and heading 21 with the date (`date.weekday-day-month`).
2. Hero key with a `play` cap (`daily.today.play-button`). **Not drawn (Chosen):** after today's game, the key becomes a secondary block "Replay" (`daily.today.replay-button`) with the caption `daily.replay-note`, and the today panel adds the score line (`daily.today.score`) and `daily.next-in`.
3. Two streak panels in two columns (gap 12): current (`chain` icon, `daily.streak.current`, `daily.streak.days`) and best (filled star, `daily.streak.best`).
4. Rule line (row, gap 8, 15 `inkSoft`, `chain` 20): `daily.streak.rule`.
5. Week panel: heading 21 (`daily.week.title`) → week strip (4.27, 12 top margin) → legend (`daily.week.done`, `daily.week.missed`).

No banner.

### 5.11 S10 Statistics (and empty)

Top bar "Statistics" (`common.statistics`). Body gap **16**, panels in order (header: icon tile 34 + heading 21, 12 below):
1. Overview (`stats` icon, `stats.overview.title`): 2-column grid: games played, wins, win rate (`::percent`), play time (`stats.duration`).
2. Levels (`grid`, `common.levels`): 3 columns: completed, stars (`stats.levels.stars-value`), three-star levels.
3. Best scores (filled star, `stats.best.title`): stat list: bold sub-heading `stats.best.score`; Levels, Daily (`common.mode.daily`) and Endless (`common.mode.endless`, only games with Endless) values; best level score (`stats.best.level-score-value`); best win streak.
4. Daily challenge (`calendar`, `daily.title`): 3 columns: completed, current streak, best streak.
5. Last 7 days (`stats`, `daily.week.title`): subtitle 14 `inkSoft` (`stats.week.subtitle`) → bar chart (4.29, 8 top margin).
6. The game's panel: logo tile 36 + heading (`stats.game.title`) → 3 columns of the game's own stats (`games.<id>.stats`; values such as ×6 keep the multiplication sign).

Then a danger block button with `trash` (`stats.reset-button`), a caption row with a `lock` icon (`stats.local-note`) and the banner slot.

**Empty (new player):** top bar, then the empty state (4.31: picture, `stats.empty.title`, `stats.empty.body`, hero key `stats.empty.play-button`, caption `stats.local-note`) and the banner slot.

### 5.12 S11 Settings

Top bar "Settings" (`common.settings`). Body gap **20**: seven groups, each a group tab (4.11) over a list, then the footer. Rows (icon tile, label, end):

| Group tab (icon) | Rows |
|---|---|
| Language (`globe`, `settings.group.language`) | Language (`globe`) → value "System (English)" / the autonym + chevron · Numbers (`hash`, wrap row) → segmented control Automatic / Latin / Local with previews |
| Sound and feel (`sound`, `settings.group.sound`) | Sound effects (`sound`) → toggle · sub-row Volume → slider 70 % · Music (`music`) → toggle · sub-row Volume → slider 40 % · Vibration (`vibration`) → toggle |
| Display (`theme`, `settings.group.display`) | Theme (`theme`, wrap row) → segmented control System / Light / Dark · Colour-blind colours (`eye`, with description) → toggle · Reduce motion (`motion`, with description) → toggle · Hints (`hint`, with description) → toggle |
| Premium (`crown`, `settings.group.premium`) | Remove ads – €1.99 (gold icon tile `crown`, label Bold, `settings.premium.remove-ads`; `…remove-ads-no-price` offline) → chevron · Restore purchase (`restore`) → chevron |
| Privacy (`shield`, `settings.group.privacy`) | Ad privacy options (`shield`, with description; only where required, doc 11) → chevron · Privacy policy (`doc`) → chevron |
| Data (`trash`, `settings.group.data`) | Reset statistics (danger row, `trash`) → chevron · Reset all progress (danger row, with description) → chevron |
| About (`info`, `settings.group.about`) | About and credits (`info`) · Licences (`doc`) · Rate this game (icon tile with a hollow rating star) · Contact (`mail`), each → chevron |

Footer (column, start-aligned, gap 4, 14 `inkSoft`, padding 0 / 4 / 8): an 18 pt check + `settings.autosave-note`, then `about.version`. **Not drawn (Chosen):** for Premium owners the Premium group shows one row with the gold "Premium active" sticker (`premium.active`) and keeps Restore purchase. No banner.

### 5.13 S11a Language

Top bar (`language.title`). Body: a list: first row "System (English)" (`settings.language.system`) with description (`language.system.description`) and a radio mark; then one row per language with its autonym (18 Bold, own script and direction) and a radio mark (check on the chosen one). Then a note panel (row, centred, gap 12): icon tile `globe` + `language.direction-note`. Choosing a language of the other direction opens the S14 restart dialog.

### 5.14 S11b About and credits

Top bar (`settings.about.label`). Body: header row (centred, gap 20, padding 6 / 0 / 4): logo tile 92 (cut) → column (start-aligned, gap 6): game name (`gameName` 34), tagline (`inkSoft`), version chip (`about.version`). Then a list of three facts without chevrons: `hint` "Made with…" (`about.made-with`), `wifi-off` (`about.offline`), `music` (`about.art-sound`). A panel (column, gap 6): heading 21 (`about.support.label`) + body (`about.support.body` with the support e-mail). A list: Contact (`mail`) and Licences (`doc`), each with a chevron.

### 5.15 S11c Privacy policy

Top bar (`settings.privacy-policy.label`). Body gap **18**: summary panel (row, centred, gap 14): gold art tile 52 with `shield` + heading 21 (`privacy.summary`). Five sections (column, gap 6): heading 21 + paragraph (`prose` 16, line height 1.5 / 1.75): game, ads, purchase, backup, contact (`privacy.<k>.title`, `privacy.<k>.body`). Last: small print `privacy.updated` with the date. No banner.

### 5.16 S11d Licences

Top bar (`settings.licences.label`). Body gap **18**: intro paragraph (`licences.intro`), then four groups (group tab + list): Fonts (`doc`), Software (`grid`), Ads and store (`ad`), Sounds (`music`) (`licences.group.*`). A row with a description (Vazirmatn) is a column: name + version in Bold (isolated LTR), description 14, licence 14, and a quiet "Show licence text" nudge with a chevron at the end (`licences.show-text`). Other rows: name (+ version) as the label, the licence as the description, chevron. Fonts group rows: **Vazirmatn 33.003**, **Lilita One**, **Rubik** (each "SIL Open Font License 1.1"). Names and licences are never translated. Doc 09 section 9 owns the data.

### 5.17 S12 Premium (normal and states)

Top bar (`common.premium`). Body: header row (centred, gap 20, padding 6 block): Premium art (4.22) → column (gap 6): title `display` 38 (`common.premium`) + subtitle `inkSoft` (`premium.subtitle`). Benefits list (accent icon tiles): `close` "No ads" (`premium.benefit.no-ads`), `hint` (`premium.benefit.free-perks`), `star-filled` (`premium.benefit.support`). grow. Hero key with a `crown` cap (`premium.buy-button` with the store price). Quiet nudge with `restore`, centred (`common.restore-purchase`). Small print (`premium.small-print`). No banner.

The **states** (drawn as small frames, padding 24 × 20, gap 12, heading `title` 30 `common.premium`):

| State | Content under the heading |
|---|---|
| Loading price | subtitle · grow · busy hero key (`premium.loading`) · quiet Restore · small print |
| Store unavailable / offline | note panel `wifi-off` (`premium.store-unavailable`) · grow · disabled hero key with `crown` cap (`settings.premium.remove-ads-no-price`) · disabled quiet Restore |
| Purchase in progress | subtitle · grow · busy hero key (`premium.purchasing`) · disabled quiet Restore · small print |
| Pending approval | note panel `clock` with Bold `premium.pending` · `inkSoft` `premium.pending-detail` · grow · quiet Restore |
| Success | confetti (4.34) · title `display` (`premium.success.title`) · lead (`premium.success.body`) · "Premium active" sticker (crown, tilt −3°, slap) |
| Error | error note panel (`danger` edge, `dangerFill`, `alert` in `danger`, `premium.error`) · grow · hero key with `restore` cap (`premium.try-again`) · quiet Restore |
| Already owned | "Premium active" sticker (tilt −3°) · lead (`premium.owned.body`) · grow · secondary block Restore purchase |
| Restore results | heading `common.restore-purchase` · toast stack (gap 10): busy + `premium.restoring`; `check` + `premium.restore-success`; `info` + `premium.restore-empty`; `alert` + `premium.restore-failed` |
| Cancelled | no screen: the page returns quietly to normal |

### 5.18 S13 How to play

Top bar (`common.how-to-play`). Body: goal (`inkSoft`, `games.<id>.goal`) → how-to stage (4.30) with the game's picture → row (centred, space-between, gap 12): step chip (`how-to-play.step-counter`) and pager dots → step text (heading 21 display, `games.<id>.howToPlay[n]`) → grow → two buttons (gap 12): Previous (secondary, `back` icon, `common.previous`) and Next (primary, `forward` at the end, `common.next`) → quiet nudge with `restore`, centred (`how-to-play.replay-tutorial`). No banner.

### 5.19 S14 Dialogs

The screen underneath stays visible (from under the status bar), dimmed by the scrim; the dialog (4.18) is centred.

| Dialog | Art tile | Title / body | Buttons |
|---|---|---|---|
| Reset all progress (over Settings) | 56 pt, `dangerFill`, `danger` `trash` | `dialog.reset-progress.title` / `…body` | danger block hold button with `trash` (`dialog.reset-progress.confirm`; the mock shows it 46 % held) · small `dialog.reset-progress.hold-hint` · secondary block Cancel (`common.cancel`) |
| Restart to apply (over S11a) | pop `globe` | `settings.language.restart.title` / `…body` | row: Later (secondary, `…restart.later`) · Restart now (primary, `restore`, `…restart.confirm`) |
| Progress restored (over Home) | gold `restore` | `dialog.save-restored.title` / `…body` | row: OK (primary, `common.ok`) |
| Restart level (from Pause; component board) | none | `dialog.restart-level.title` / `…body` | row: Cancel (secondary) · Restart (primary, `restore`, `dialog.restart-level.confirm`) |
| Reset statistics (from S10 or S11) | as reset progress | `dialog.reset-stats.title` / `…body` | danger block confirm with `trash` (`dialog.reset-stats.confirm`) · secondary block Cancel (**Chosen**, not drawn: the reset-progress layout without the hold) |
| Newer save found | gold `restore` | `dialog.newer-save.title` / `…body` | row: Later (secondary, `dialog.newer-save.later-button`) · Update (primary, `dialog.newer-save.update-button`) (**Chosen**, not drawn) |
| Crash (doc 05 `CrashScreen`) | pop `alert` | `dialog.crash.title` / `…body` | one primary block button with `home` (`dialog.crash.home-button.label`) (**Chosen**, not drawn: the only way out, doc 05 rule 52) |

### 5.20 S15 Debug menu (test builds only)

Under the status bar: the hazard strip (4.33). Top bar "Debug menu" (`debug.title`) with the small ink sticker "Test build" (tilt +5°, `bug` icon, `debug.badge`) at the end. Body: one list of 14 rows: Jump to level (`grid`, value 12) · Unlock all (`lock`) · Give stars (`star-filled`) · Set date (`calendar`, value = date) · Show state (`doc`) · Ads always test (`ad`, toggle on) · Ads never (`close`, toggle off) · Premium (gold `crown`, toggle off) · Force locale (`globe`, value "en · ltr · 123" isolated LTR) · Simulate offline (`wifi-off`, toggle off) · Export save (`forward`) · Import save (`back`) · Error log (`alert`, value 0) · Font test (`hash`) (`debug.*` keys). English in every language on purpose. Compiled out of store builds (doc 14).

---

## 6. RTL rules specific to Toybox

Doc 10 owns direction, digits and bidi; these are the Toybox parts.

1. **Layout mirrors, shadows do not.** Rows use `flexDirection: 'row'` and start/end keys, so the whole screen mirrors in fa/ckb. Hard shadows point straight down in both directions, and scale transforms are symmetric, so nothing else changes.
2. **Mirrored icons:** only `back`, `chevron`, `forward`, `undo` (section 3.12): top-bar back, row chevrons, "Next" / "Continue" arrows (they stay at the end, pointing towards the reading direction), undo. Play, pause, clocks, stars, logos, pictures and the lock never mirror.
3. **Things that fill from the start edge** run right to left in RTL: slider and progress fills, the hold-to-confirm fill, the toggle knob's "on" position (the end, which is the left), the week strip and the bar chart (Monday on the right).
4. **Things at the start or end** follow: the hero-key cap (start), the level-tile flag (top-end corner: top-left in RTL), the group tab (14 from the start), the ad chip (top-start), the "New best" sticker (end of the score row), dialog buttons (safe choice at the start: on the right in RTL).
5. **Sticker tilt does not mirror** (**Chosen**, as in the mockup): a −4° sticker is −4° in both directions. Sticker padding is logical (9 start / 11 end).
6. **Fonts:** every Lilita One role becomes Vazirmatn Bold with line height 1.45 (numbers 1.1); every Rubik role becomes Vazirmatn Regular or Bold with line height 1.5 (caption 1.6, prose 1.75, labels 1.45). Game names stay in Lilita One, isolated LTR (FSI … PDI). Autonyms in the language lists use their own script's font. Letter-spacing is always 0 in Arabic script.
7. **Digits:** Persian digits (`۰–۹`) in fa/ckb for numbers set in Vazirmatn, including level numbers, scores, the calendar day and chart values; the Numbers setting can switch them (doc 10). The debug menu's force-locale value stays LTR.
8. **Status bar and system chrome** are not mirrored by the app.

## 7. Dark theme rules

1. **Toy chest at night:** the ground becomes a deep night colour of the game's hue, surfaces are one step lighter, `sunken` sits between them.
2. **The ink family inverts and tints:** text becomes moonlight (`#F4F2FF`, `#F2F7FF`, `#F7F2FF`), outlines a pale chalk line of the game's hue, `inkSoft` a light dusk. The outline is lighter than the text's surroundings, so edges still read (≥ 9.2:1 against surface).
3. **Shadows go near-black** (`#07061A`, `#050E1C`, `#0B0718`). They are subtle against the dark ground (1.2–1.3:1, **Derived**); depth then reads from the chalk outline and the offset. Keep them: pressing still visibly sinks the key.
4. **Accent and pop brighten** (`#FF7D5E`, `#52D67F`, `#36D1C4`; `#FFD84D`, `#86CFFF`, `#FF9A55`), and text on them turns dark: `onAccent` and `onPop` = the game's dark ground.
5. **Printed parts do not change:** stickers keep gold / accent / pop paper with toy-ink `#1D1B3A` edges and text, the ink sticker stays `#1D1B3A` with white text, art tiles and gold icon tiles keep toy-ink edges and icons, the cut ring stays white, logos keep their toy-ink line art. On the dark ground the white ring is what frames them.
6. **Semantic colours lighten:** success `#7EE3A6`, warning `#FFC95C`, danger `#FF8593`, `dangerFill` `#4A1F3A`, focus `#FF8AD8`, filled star `#FFD23F` (stickers keep gold `#FFC928`).
7. **The toast inverts again:** a pale `#F4F2FF` chip with `#1B1943` text (for every game).
8. **Scrim deepens** to `rgba(3,2,12,.7)`; separators use `rgba(228,224,255,.16)` in every game (**Chosen**, as in the HTML, which uses Line Siege's outline here); the ad band uses dark neutrals (`#2A2C38`, `#6B7080`, `#C3C6D6`).
9. The theme follows the S11 setting (System / Light / Dark); doc 05's `ThemeProvider` resolves it.

## 8. Accessibility

**Contrast, measured** (**Derived**, WCAG 2.2 relative-luminance formula, the same as the mockup's own table; bold = below the need). L = light, D = dark.

| Pair (need) | Line L | Line D | Flock L | Flock D | Scrap L | Scrap D |
|---|---|---|---|---|---|---|
| Body text on ground (4.5:1) | 10.96 | 14.99 | 11.93 | 13.48 | 12.45 | 14.31 |
| Body text on surface (4.5:1) | 15.93 | 12.00 | 15.94 | 10.43 | 16.36 | 11.41 |
| Body text on sunken (4.5:1) | 13.48 | 13.70 | 13.69 | 11.94 | 13.82 | 12.81 |
| Muted text on ground (4.5:1) | 6.39 | 8.51 | 6.95 | 8.31 | 7.25 | 8.43 |
| Muted text on surface (4.5:1) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Muted text on sunken (disabled) (4.5:1) | 7.85 | 7.78 | 7.98 | 7.36 | 8.05 | 7.55 |
| Text on accent (onAccent) (4.5:1) | 5.87 | 6.59 | 6.89 | 7.79 | 6.49 | 8.30 |
| Text on pop (onPop) (4.5:1) | 11.45 | 11.99 | 9.10 | 8.55 | 7.05 | 7.50 |
| Danger text on surface (4.5:1) | 5.53 | 5.70 | 5.53 | 4.82 | 5.68 | 5.39 |
| Danger text on ground (4.5:1) | **3.80** | 7.13 | **4.14** | 6.23 | **4.32** | 6.77 |
| Danger label on dangerFill (hold) (4.5:1) | **4.43** | 5.83 | **4.43** | 5.83 | **4.43** | 5.83 |
| Success icon on surface (3:1) | 4.79 | 8.48 | 4.79 | 7.17 | 4.92 | 8.02 |
| Toast text on toast (4.5:1) | 15.93 | 14.99 | 15.93 | 14.99 | 15.93 | 14.99 |
| Ad text on ad band (4.5:1) | 7.09 | 8.16 | 7.09 | 8.16 | 7.09 | 8.16 |
| Sticker ink on gold (4.5:1) | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 | 10.74 |
| Sticker ink on accent paper (4.5:1) | 5.87 | 6.57 | 6.89 | 8.88 | 6.49 | 8.72 |
| Sticker ink on pop paper (4.5:1) | 11.45 | 11.95 | 9.10 | 9.75 | 7.05 | 7.88 |
| White on ink sticker (4.5:1) | 16.53 | 16.53 | 16.53 | 16.53 | 16.53 | 16.53 |
| Outline vs ground (3:1) | 10.96 | 12.95 | 11.93 | 11.99 | 12.45 | 12.85 |
| Outline vs surface (3:1) | 15.93 | 10.37 | 15.94 | 9.28 | 16.36 | 10.24 |
| Outline vs accent fill (3:1) | 5.87 | **1.97** | 6.89 | **1.54** | 6.49 | **1.55** |
| Outline vs pop fill (3:1) | 11.45 | **1.08** | 9.10 | **1.40** | 7.05 | **1.71** |
| Accent fill vs ground (3:1) | **1.87** | 6.59 | **1.73** | 7.79 | **1.92** | 8.30 |
| Pop fill vs ground (3:1) | **1.04** | 11.99 | **1.31** | 8.55 | **1.77** | 7.50 |
| Surface vs ground (3:1) | **1.45** | **1.25** | **1.34** | **1.29** | **1.31** | **1.25** |
| Star fill vs surface (3:1) | **1.48** | 9.19 | **1.48** | 7.77 | **1.52** | 8.69 |
| Star edge (outline) vs star fill (3:1) | 10.74 | **1.13** | 10.74 | **1.19** | 10.74 | **1.18** |
| Off star (starOff) vs surface (3:1) | 9.28 | 6.81 | 9.29 | 6.43 | 9.53 | 6.72 |
| Focus ring vs ground (3:1) | 3.62 | 7.80 | 3.94 | 6.82 | 4.11 | 7.40 |
| Focus ring vs sunken (locked tile) (3:1) | 4.45 | 7.13 | 4.52 | 6.04 | 4.57 | 6.63 |
| Hard shadow vs ground (3:1) | 10.96 | **1.21** | 11.93 | **1.33** | 12.45 | **1.26** |

What the numbers mean:

- **All text passes AA** where Toybox puts it: body, muted, on-accent, on-pop, sticker, toast and ad texts are ≥ 4.8:1 in every game and scheme.
- **Light accent, pop and star fills are weaker than 3:1 against the ground (1.0–1.9:1) and the star against the surface (1.5:1).** This is by design: every such fill carries the 3 pt ink outline (10.9–16.4:1 against ground and surface), which is the visual boundary WCAG 1.4.11 asks for, and filled vs hollow stars differ in shape.
- **Dark outline vs accent / pop fills is low (1.1–2.0:1)**, but there the fills themselves stand 6.6–12:1 off the ground, so the shape is still clear.
- **Surface vs ground is 1.25–1.45:1 in every paint:** panels, lists and keys are delimited by their ink outline, never by their fill (rule 3).
- **In dark, the star's chalk edge nearly matches the star fill (1.1–1.2:1)**; the fill itself stands 7.8–9.2:1 off the surface, and hollow stars are a different shape.
- **Dark hard shadows are faint (1.2–1.3:1 against the ground)**; they are depth cues, not boundaries (section 7).
- **Danger text on the light ground fails (3.8–4.3:1):** Toybox never puts danger text on the ground; it is always on a surface (4.8–5.7:1). Rule: danger text only on `surface`.
- **The danger label during hold-to-confirm** sits on `dangerFill` at **4.43:1** in light (just under 4.5 for 17 pt Bold). See open issue 5.
- **Focus** is ≥ 3.6:1 against every ground and ≥ 4.4:1 against the sunken locked tile.

**Doc 15's automated pairs.** Doc 15's `checkPaletteContrast` expects `primary` vs `background` ≥ 3, `starOn` vs `surface` ≥ 3 and `danger` vs `background` ≥ 4.5. A Toybox palette fails exactly those three in light (measured in `toybox-tokens.test.ts`, section 9.8). Doc 15 should check `border` vs `background` and `border` vs `primary` (≥ 3) and `danger` vs `surface` (≥ 4.5) for Toybox instead (open issue 4).

**Other rules:**
- Targets ≥ 44 pt (rule 14); icon buttons 48 (44 in the game top bar); rows 60; keys 94; tiles about 51.7 × 62.
- Every state has a shape cue (rule 10), so the colour-blind palette can equal the standard one (section 3.4).
- Roles and states: buttons `button`; toggle rows and pause keys `switch` with `checked`; segments and language options `radio` with `selected`; group tabs, top-bar titles and panel headings `header`; decorative art, logos, pager dots and the calendar tile hidden; stars, week marks, chart columns and the splash loader labelled with their deck keys (`result.win.stars.a11y-label`, `daily.week.day-*.a11y-label`, `stats.week.bar.a11y-label`, `splash.loading.a11y-label`, `levels.level-tile.*`).
- **200 % text:** text wraps, never truncates (doc 05 rule 29). When `isLargeText` (doc 05 rule 49): home keys, the two-button rows, the streak panels and 3-column stat grids stack vertically; row values drop under their labels (like wrap rows); level tiles grow in height with the font (grid stays 6 columns on phones); the hero key grows taller (min 80). **Chosen:** the mockup shows no large-text frames.
- **Reduce motion:** section 3.11's last column; the setting follows the phone and can be changed in S11 (doc 05 section 3.13).

---

## 9. React Native implementation mapping

Everything here follows doc 05's rules (typed theme, `makeStyles`, logical keys, `AppText`, `Icon`, no colour literals in styles) and doc 10's fonts. Code blocks marked with a path passed `tsc` 6.0.3, doc 04's ESLint (`--max-warnings 0`), Prettier and Jest in a copy of the handbook lab on 2026-09-28 (see [Verified](#verified)).

### 9.1 Theme: `ColorTokens`, palettes, Shell constants

**`ColorTokens` gains five fields** — `sunken`, `pop`, `onPop`, `shadow`, `focus` — in doc 05 section 3.6 (`theme-types.ts`, with `TEST_PALETTE` filled). Section 3.1 above maps every field to its paint.

**Each game's palette** is written from `tokens.json` (`color.games.<id>.colorTokens`), with the colour-blind mode equal to the standard one (section 3.4). Line Siege:

```ts
// apps/line-siege/src/theme/palette.ts
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

/** Toybox paint for Line Siege, light: Sky wash, Chalk, Toy ink, Pencil, Brick tomato, Sunshine. */
const LIGHT: ColorTokens = {
  background: '#A5DAF3',
  surface: '#F8FBFF',
  sunken: '#D3ECF8',
  text: '#1D1B3A',
  textMuted: '#43406A',
  primary: '#FF6B4A',
  onPrimary: '#1D1B3A',
  pop: '#FFD23F',
  onPop: '#1D1B3A',
  border: '#1D1B3A',
  shadow: '#1D1B3A',
  danger: '#C4243A',
  focus: '#C8157A',
  icon: '#1D1B3A',
  starOn: '#FFC928',
  starOff: '#43406A',
};
/** Dark, "toy chest at night": Toy chest, Lid, Moonlight, Dusk, Ember, Lantern. */
const DARK: ColorTokens = {
  background: '#1B1943',
  surface: '#2B2862',
  sunken: '#221F52',
  text: '#F4F2FF',
  textMuted: '#B9B4EA',
  primary: '#FF7D5E',
  onPrimary: '#1B1943',
  pop: '#FFD84D',
  onPop: '#1B1943',
  border: '#E4E0FF',
  shadow: '#07061A',
  danger: '#FF8593',
  focus: '#FF8AD8',
  icon: '#F4F2FF',
  starOn: '#FFD23F',
  starOff: '#B9B4EA',
};

/** Colour-blind mode keeps the same paints: in the Shell, shapes carry every meaning (doc 18). */
export const PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
```

Flock Tilt and Scrap Shove use the same shape with their values from section 3.2. The app passes `PALETTE` to `createThemeSet` (doc 05 section 3.6).

**Shell constants** (section 3.3) are one data module, picked by the theme's scheme inside `makeStyles` (`const shell = SHELL_COLORS[theme.scheme];`):

```ts
// packages/shell/src/theme/shell-colors.ts
import type { ColorScheme } from './theme-types.ts';

/** Toybox colours that no game repaints; they follow only the light/dark scheme (doc 18). */
export type ShellColors = {
  readonly success: string;
  readonly warning: string;
  /** Tint behind destructive icons and the hold-to-confirm fill. */
  readonly dangerFill: string;
  /** Sticker paper, flags, the Premium art. */
  readonly gold: string;
  /** The white die-cut ring around stickers and art tiles. */
  readonly cut: string;
  /** Outline and text of printed parts (stickers, flags, art tiles) in both schemes. */
  readonly toyInk: string;
  readonly toastBackground: string;
  readonly toastText: string;
  readonly scrim: string;
  /** Row separators and the score-panel rule. */
  readonly line: string;
  readonly adBackground: string;
  readonly adLine: string;
  readonly adText: string;
};

export const SHELL_COLORS: Readonly<Record<ColorScheme, ShellColors>> = {
  light: {
    success: '#17804A',
    warning: '#8A5A00',
    dangerFill: '#FFD9DD',
    gold: '#FFC928',
    cut: '#FFFFFF',
    toyInk: '#1D1B3A',
    toastBackground: '#1D1B3A',
    toastText: '#F8FBFF',
    scrim: 'rgba(29,27,58,.55)',
    line: 'rgba(29,27,58,.14)',
    adBackground: '#E6E9ED',
    adLine: '#8D949E',
    adText: '#474C55',
  },
  dark: {
    success: '#7EE3A6',
    warning: '#FFC95C',
    dangerFill: '#4A1F3A',
    gold: '#FFC928',
    cut: '#FFFFFF',
    toyInk: '#1D1B3A',
    toastBackground: '#F4F2FF',
    toastText: '#1B1943',
    scrim: 'rgba(3,2,12,.7)',
    line: 'rgba(228,224,255,.16)',
    adBackground: '#2A2C38',
    adLine: '#6B7080',
    adText: '#C3C6D6',
  },
};
```

### 9.2 `tokens.ts`

Doc 05's `packages/shell/src/theme/tokens.ts` now carries the Toybox scales: `LAYOUT` (gutter 20, block gap 14), `RADII` (6 / 10 / 14 / 22), `STROKE` (2 / 2.5 / 3) and `ELEVATION` (2 / 3 / 4 / 5 / 6 / 8). Component-specific numbers (section 4, `tokens.json` → `components`) stay next to their component as named constants.

The **type scale switch** waits for doc 10 (open issue 2), because display roles need a second face that doc 10's `scriptFontFor` cannot pick yet. The target, compiled in the lab (it changes one expectation in doc 10's `t.test.tsx`: the `heading` line height becomes 32 instead of 30):

```ts
// packages/shell/src/theme/tokens.ts (excerpt: the Toybox type scale, pending doc 10)
export type TypeRole = 'display' | 'title' | 'heading' | 'number' | 'body' | 'label' | 'caption';
/** 'display' = Lilita One (Vazirmatn Bold in fa/ckb); 'text' = Rubik (Vazirmatn). See doc 18. */
export type TypeFace = 'display' | 'text';
export type TypeStyle = {
  readonly fontSize: number;
  readonly weight: FontWeightToken;
  readonly face: TypeFace;
};

/** Sizes in points before Dynamic Type (Toybox, doc 18). Line height comes from the script (doc 10). */
export const TYPE_SCALE: Readonly<Record<TypeRole, TypeStyle>> = {
  display: { fontSize: 38, weight: 'bold', face: 'display' },
  title: { fontSize: 30, weight: 'bold', face: 'display' },
  heading: { fontSize: 21, weight: 'bold', face: 'display' },
  number: { fontSize: 30, weight: 'bold', face: 'display' },
  body: { fontSize: 17, weight: 'regular', face: 'text' },
  label: { fontSize: 17, weight: 'bold', face: 'text' },
  caption: { fontSize: 13, weight: 'regular', face: 'text' },
};
```

### 9.3 Fonts

- **Files** in every `apps/<game>/assets/fonts/`: `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` (doc 10), `LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, with their licences: `OFL.txt` (Vazirmatn, doc 10), `OFL-LilitaOne.txt`, `OFL-Rubik.txt` (**Chosen** names). Sources: `https://github.com/google/fonts/tree/main/ofl/lilitaone` (`LilitaOne-Regular.ttf`, renamed) and `…/ofl/rubik` (`Rubik[wght].ttf`, cut as in section 3.6).
- **`expo-font` plugin entry** (doc 02 `shellPlugins`): `['expo-font', { fonts: ['./assets/fonts/Vazirmatn-Regular.ttf', './assets/fonts/Vazirmatn-Bold.ttf', './assets/fonts/LilitaOne.ttf', './assets/fonts/Rubik-Regular.ttf', './assets/fonts/Rubik-Bold.ttf'] }]`. Family names = file names = PostScript names: `LilitaOne`, `Rubik-Regular`, `Rubik-Bold`, `Vazirmatn-Regular`, `Vazirmatn-Bold`. Never `fontWeight` with them.
- **Face selection** (the doc 10 change, open issue 2): `scriptFontFor(language, weight, face)` returns

| Script | `face` · `weight` | `fontFamily` | Line-height ratio |
|---|---|---|---|
| Latin (en, de) | display · any | `LilitaOne` | 1.1 |
| Latin | text · regular | `Rubik-Regular` | 1.32 (caption 1.4) |
| Latin | text · bold | `Rubik-Bold` | 1.25 on buttons (`label`), 1.32 elsewhere |
| Arabic (fa, ckb) | display · any | `Vazirmatn-Bold` | 1.45 (`number` 1.1) |
| Arabic | text · regular | `Vazirmatn-Regular` | 1.5 (caption 1.6, prose 1.75) |
| Arabic | text · bold | `Vazirmatn-Bold` | 1.45 on buttons, 1.5 elsewhere |

  Game names use `LilitaOne` in every language (they are Latin brand names, isolated LTR).
- **Licences:** S11d lists Lilita One and Rubik under Fonts (doc 09 section 9 has the `credits.json` rows).

### 9.4 Press squash: `RaisedSurface`

The only press implementation (rule 2). The key is an animated wrapper holding two children: the **shadow** (same box, `shadow` colour) and the **face**. Pressing moves the wrapper down by the elevation and squashes it, while the shadow slides up inside it by the same amount, so at full press the shadow is exactly under the face — as in CSS, where the shadow belongs to the element and scales with it. (The HTML note's "sibling View" would leave a 1.6 pt band of shadow above and below a squashed 54 pt key.) Reduce motion: the screen model passes `isReducedMotion` from `useReduceMotion()` (doc 05 section 3.13), which removes the squash; `MotionConfig` makes the timing and spring instant.

```tsx
// packages/shell/src/ui/raised-surface.tsx
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { MIN_TOUCH, STROKE } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';

export type RaisedSurfaceProps = {
  /** Translated; also the accessibility label. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  /** ELEVATION.tile, .iconButton, .control or .hero: shadow offset and press depth. */
  readonly elevation: number;
  readonly radius: number;
  /** Face paint from the theme: colors.surface, .primary or .pop. */
  readonly fill: string;
  /** From useReduceMotion() in the screen model: sink without the squash. */
  readonly isReducedMotion: boolean;
  readonly isDisabled?: boolean;
  readonly children: ReactNode;
};

/** Press in: 70 ms ease-out. Release: spring back with overshoot (doc 18, motion). */
const PRESS_IN = { duration: 70, easing: Easing.bezier(0, 0, 0.58, 1) };
const RELEASE = { damping: 12, stiffness: 420, mass: 1 };
/** Squash at full press: scale (1.03, 0.94). */
const SQUASH_X = 0.03;
const SQUASH_Y = -0.06;

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // Same box as the face; it slides from `elevation` below the face to 0 as the key sinks.
    shadow: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
    shadowPaint: { backgroundColor: theme.colors.shadow },
    face: {
      minHeight: MIN_TOUCH,
      minWidth: MIN_TOUCH,
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faceDisabled: {
      backgroundColor: theme.colors.sunken,
      borderColor: theme.colors.textMuted,
      borderStyle: 'dashed',
    },
  });
  return styles;
});

/** A Toybox key: ink outline, hard shadow, and a press that sinks into the shadow and springs back. */
export function RaisedSurface(props: RaisedSurfaceProps): ReactNode {
  const { elevation, radius, isReducedMotion, isDisabled = false } = props;
  const styles = useStyles();
  const depth = useSharedValue(0);
  const squash = isReducedMotion ? 0 : 1;

  const keyStyle = useAnimatedStyle(() => {
    const sunk = isDisabled ? 1 : depth.get();
    return {
      transform: [
        { translateY: sunk * elevation },
        { scaleX: 1 + SQUASH_X * squash * sunk },
        { scaleY: 1 + SQUASH_Y * squash * sunk },
      ],
    };
  });
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - (isDisabled ? 1 : depth.get())) * elevation }],
  }));

  function handlePressIn(): void {
    depth.set(withTiming(1, PRESS_IN));
  }
  function handlePressOut(): void {
    depth.set(withSpring(0, RELEASE));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={props.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={props.testID}
    >
      <Animated.View style={keyStyle}>
        <Animated.View
          style={[styles.shadow, styles.shadowPaint, { borderRadius: radius }, shadowStyle]}
        />
        <View
          style={[
            styles.face,
            { borderRadius: radius, backgroundColor: props.fill },
            isDisabled && styles.faceDisabled,
          ]}
        >
          {props.children}
        </View>
      </Animated.View>
    </Pressable>
  );
}
```

```tsx
// packages/shell/src/ui/raised-surface.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ELEVATION, RADII } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';
import { RaisedSurface } from './raised-surface.tsx';

describe('RaisedSurface', () => {
  it('is a named button that reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RaisedSurface
        label="Replay"
        onPress={onPress}
        testID="result.replay-button"
        elevation={ELEVATION.control}
        radius={RADII.md}
        fill="transparent"
        isReducedMotion={false}
      >
        <AppText text="Replay" variant="label" />
      </RaisedSurface>,
    );

    await user.press(screen.getByRole('button', { name: 'Replay' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RaisedSurface
        label="Buy"
        onPress={onPress}
        testID="premium.buy-button"
        elevation={ELEVATION.hero}
        radius={RADII.md}
        fill="transparent"
        isReducedMotion
        isDisabled
      >
        <AppText text="Buy" variant="label" />
      </RaisedSurface>,
    );

    const button = screen.getByRole('button', { name: 'Buy' });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

Buttons, row buttons, keys, icon buttons, option cards, segments, pause keys and level tiles compose `RaisedSurface` with their own content (doc 05 rule 6). Never use iOS `shadowRadius`/`shadowOpacity` or Android `elevation`: they blur.

### 9.5 Static hard shadows, die-cut rings, focus ring, outlines

React Native 0.86 (New Architecture) has CSS-like `boxShadow` and `outline*` style props (read in `StyleSheetTypes.d.ts`; iOS draws `boxShadow` with a `CALayer` shadow path whose radius is half the blur, so blur 0 is crisp). Toybox uses them for parts that never move:

```ts
// packages/shell/src/ui/toybox-styles.ts
import type { ViewStyle } from 'react-native';

/** CSS `box-shadow: 0 <offset>px 0 <color>`: Toybox's hard shadow, no blur. For parts that never move. */
export function hardShadow(offset: number, color: string): ViewStyle {
  return { boxShadow: [{ offsetX: 0, offsetY: offset, blurRadius: 0, spreadDistance: 0, color }] };
}

/** CSS `box-shadow: 0 0 0 <width>px <color>`: the white die-cut ring around stickers, flags and art. */
export function dieCutRing(width: number, color: string): ViewStyle {
  return { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: width, color }] };
}

/** CSS `outline: 3px solid <focus>; outline-offset: 2px`. Follows the border radius. */
export function focusRing(color: string): ViewStyle {
  return { outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2, outlineColor: color };
}
```

Recipes (excerpt of a probe file that passed `tsc`, ESLint and Prettier):

```ts
// packages/shell/src/ui/<component>.tsx (excerpt: Toybox StyleSheet recipes)
const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    // Flat information panel: ink edge, no shadow.
    panel: {
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
      paddingBlock: 14,
      paddingInline: 16,
    },
    // Dialog: the one static hard shadow.
    dialog: {
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      borderRadius: RADII.lg,
      backgroundColor: theme.colors.surface,
      ...hardShadow(ELEVATION.dialog, theme.colors.shadow),
    },
    // Sticker: toy-ink edge, gold paper, white die-cut ring, tilt.
    sticker: {
      alignSelf: 'flex-start',
      borderWidth: STROKE.tile,
      borderColor: shell.toyInk,
      borderRadius: 8,
      backgroundColor: shell.gold,
      transform: [{ rotate: '-4deg' }],
      ...dieCutRing(3.5, shell.cut),
    },
    // Locked level tile: dashed, sunken, pushed in, no shadow.
    lockedTile: {
      borderWidth: STROKE.tile,
      borderStyle: 'dashed',
      borderColor: theme.colors.textMuted,
      borderRadius: RADII.sm,
      backgroundColor: theme.colors.sunken,
      transform: [{ translateY: ELEVATION.tile }],
    },
    lockedTileTapped: focusRing(theme.colors.focus),
  });
  return styles;
});
```

**Outline** = `borderWidth` from `STROKE` + `borderColor: theme.colors.border` (danger: `theme.colors.danger`; printed parts: `shell.toyInk`); dashed states add `borderStyle: 'dashed'` with `textMuted`. The group tab's open bottom is `borderBottomWidth: 0` with `borderTopStartRadius`/`borderTopEndRadius` 9 and a −3 bottom margin.

### 9.6 Icons

`icon-paths.ts` is generated from `tokens.json` by this script (Node 26, headless Skia from doc 09 / doc 07); doc 05's `Icon`, rasterizer and `tintColor` pipeline stay unchanged. It produces the 41 names of section 3.12 (126 KB of path data) and `DIRECTIONAL_ICONS = back, chevron, forward, undo`.

```ts
// packages/tooling/src/art/build-icon-paths.ts
// Turns the Toybox icon layers (design/toybox/tokens.json, doc 18) into one nonzero fill path per icon
// and writes packages/shell/src/ui/icons/icon-paths.ts. Run: node packages/tooling/src/art/build-icon-paths.ts
import { readFileSync, writeFileSync } from 'node:fs';

import { loadHeadlessSkia } from '@e07/tooling/visual/load-headless-skia.ts';

import type { HeadlessSkia } from '@e07/tooling/visual/load-headless-skia.ts';
import type { SkPath } from '@shopify/react-native-skia';

type IconLayer =
  | {
      readonly op: 'stroke';
      readonly width: number;
      readonly cap: 'round' | 'butt';
      readonly join: 'round';
      readonly d: string;
    }
  | { readonly op: 'fill'; readonly fillRule: 'nonzero' | 'evenodd'; readonly d: string };
type IconTokens = {
  readonly icons: {
    readonly directional: readonly string[];
    readonly glyphs: Readonly<Record<string, { readonly layers: readonly IconLayer[] }>>;
  };
};

// Numeric values of Skia's StrokeCap, StrokeJoin, FillType and PathOp enums (types-only import rule).
const CAP_BUTT = 0;
const CAP_ROUND = 1;
const JOIN_ROUND = 1;
const FILL_EVEN_ODD = 1;
const OP_UNION = 2;
const TOKENS = 'design/toybox/tokens.json';
const OUT = 'packages/shell/src/ui/icons/icon-paths.ts';

function layerPath(skia: HeadlessSkia, layer: IconLayer): SkPath {
  const path = skia.Path.MakeFromSVGString(layer.d);
  if (path === null) throw new Error(`Bad path data: ${layer.d}`);
  if (layer.op === 'stroke') {
    const cap = layer.cap === 'round' ? CAP_ROUND : CAP_BUTT;
    const stroked = skia.Path.Stroke(path, { width: layer.width, cap, join: JOIN_ROUND });
    if (stroked === null) throw new Error(`Stroke failed: ${layer.d}`);
    return stroked;
  }
  if (layer.fillRule === 'nonzero') return path;
  return skia.PathBuilder.MakeFromPath(path).setFillType(FILL_EVEN_ODD).build();
}

/** Union of all layers, rewritten with the nonzero rule (path ops return even-odd paths). */
export function flattenIcon(skia: HeadlessSkia, layers: readonly IconLayer[]): string {
  let union: SkPath | null = null;
  for (const layer of layers) {
    const path = layerPath(skia, layer);
    union = union === null ? path : skia.Path.MakeFromOp(union, path, OP_UNION);
    if (union === null) throw new Error('Union failed');
  }
  const winding = union === null ? null : skia.Path.AsWinding(union);
  if (winding === null) throw new Error('Winding conversion failed');
  // Two decimals on a 24-unit grid is 0.06 px at 3x: invisible, and about half the size.
  return winding
    .toSVGString()
    .replace(/-?\d*\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100));
}

async function main(): Promise<void> {
  const skia = await loadHeadlessSkia();
  const tokens = JSON.parse(readFileSync(TOKENS, 'utf8')) as IconTokens;
  const entries = Object.entries(tokens.icons.glyphs).map(
    ([name, glyph]) => `  '${name}': '${flattenIcon(skia, glyph.layers)}',`,
  );
  const directional = tokens.icons.directional.map((name) => `'${name}'`).join(', ');
  writeFileSync(
    OUT,
    [
      '// packages/shell/src/ui/icons/icon-paths.ts',
      '// GENERATED by packages/tooling/src/art/build-icon-paths.ts from design/toybox/tokens.json. Do not edit.',
      '/** Every Shell icon: one SVG path on a 24 x 24 grid, nonzero fill, single colour (tintColor). */',
      'export const ICON_PATHS = {',
      ...entries,
      '} as const;',
      '',
      'export type IconName = keyof typeof ICON_PATHS;',
      '',
      '/** Icons that point along the reading direction flip in RTL (spec 7.5, doc 18). */',
      `export const DIRECTIONAL_ICONS: ReadonlySet<IconName> = new Set<IconName>([${directional}]);`,
      '',
    ].join('\n'),
  );
}

await main();
```

Run it after any change to `tokens.json` → `icons`, then render a contact sheet and look at it (doc 05 section 3.10). The rating star is not in `ICON_PATHS`: tiles and rows stack two rasters of the star path (fill, and a 1.8 edge; section 3.12), result stars are a canvas.

### 9.7 Component map

Proposed files, named by doc 03, all presentational (`packages/shell/src/ui/` unless noted):

| Toybox part (section) | File | Built from |
|---|---|---|
| Button, hero key, row button, home key (4.1–4.4) | `button.tsx` (`kind`, `size: 'regular' \| 'hero'`), `row-button.tsx`, `key-button.tsx` | `RaisedSurface`, `AppText`, `Icon` |
| Icon button (4.5) | `icon-button.tsx` (doc 05, restyled) | `RaisedSurface` (elevation 4) |
| Toggle, pause key (4.6, 4.25) | `toggle.tsx`, `toggle-key.tsx` | Reanimated knob; `RaisedSurface` |
| Segmented control (4.7) | `segmented-control.tsx` | `RaisedSurface` per segment |
| Slider, progress bar (4.8, 4.9) | `slider.tsx`, `progress-bar.tsx` | Views; Gesture Handler pan for the thumb |
| Option card, radio mark (4.10) | `option-card.tsx`, `radio-mark.tsx` | `RaisedSurface` |
| List, row, group tab, icon tile (4.11, 4.12) | `list-group.tsx`, `list-row.tsx`, `group-tab.tsx`, `icon-tile.tsx` | Views |
| Panel, note panel, offer (4.13) | `panel.tsx`, `note-panel.tsx` | Views |
| Level tile (4.14) | `screens/levels/level-tile.tsx` (doc 05 section 3.9) | `RaisedSurface` (elevation 3) |
| Stars (4.15) | `rating-stars.tsx`; `screens/result/result-stars.tsx` | stacked `Icon` rasters; Skia canvas |
| Top bar, brand lock, game top bar (4.16) | `top-bar.tsx`; `screens/home/brand-lock.tsx`; `game-host/game-top-bar.tsx` | `IconButton`, `AppText` |
| Banner slot (4.17) | doc 11's `ad-banner-slot.tsx` inside a band | Views |
| Dialog, scrim, hold (4.18) | `dialog-card.tsx`, `scrim.tsx`, `use-hold-to-confirm.ts` (doc 05) | `hardShadow` |
| Toast (4.19) | `toast.tsx` | Reanimated entering animation |
| Sticker, chip (4.20, 4.21) | `sticker.tsx`, `chip.tsx` | `dieCutRing` |
| Art tile, logo tile, pictures (4.22, 4.23, 3.13) | `art-tile.tsx`, `logo-tile.tsx` | Views; Skia canvas for logos |
| Busy blocks, splash loader (4.24) | `busy-blocks.tsx` | Reanimated loop |
| Calendar tile, week strip (4.26, 4.27) | `screens/daily/calendar-tile.tsx`, `screens/daily/week-strip.tsx` | Views |
| Stat grid, stat list, score panel, bar chart (4.28, 4.29) | `stat-grid.tsx`, `stat-list.tsx`, `screens/result/score-panel.tsx`, `screens/stats/week-bars.tsx` | Views |
| Stage, pager dots (4.30) | `screens/how-to-play/how-to-stage.tsx`, `pager-dots.tsx` | Views |
| Hazard strip (4.33) | `screens/debug/hazard-strip.tsx` | Skia canvas (test builds only) |

`AppText` needs more tones for Toybox (open issue 3): `onPop`, `sticker` (toy ink), `onInkSticker` (white), `toast`.

### 9.8 Token parity test

Every app palette and the Shell constants are pinned to `tokens.json` by one root test (it reads the file: `design/` is outside the workspaces, and parent-relative imports are banned). Its third case records exactly which doc 15 pairs a Toybox palette misses in light (section 8).

```ts
// test/integration/toybox-tokens.test.ts
import { readFileSync } from 'node:fs';

import { PALETTE } from '@e07/line-siege/theme/palette.ts';
import { checkPaletteContrast } from '@e07/shell/testing/palette-checks.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import type { ColorScheme, Palette } from '@e07/shell/theme/theme-types.ts';

type ShellTokens = Readonly<Record<string, string>>;
type ToyboxTokens = {
  readonly color: {
    readonly toyInk: string;
    readonly games: Readonly<Record<string, { readonly colorTokens: Palette }>>;
    readonly shell: Readonly<Record<ColorScheme, ShellTokens>>;
  };
};

// Jest runs from the repo root (doc 07); design/ is outside every workspace, so it is read, not imported.
const tokens = JSON.parse(readFileSync('design/toybox/tokens.json', 'utf8')) as ToyboxTokens;

describe('Toybox tokens', () => {
  it('matches the Line Siege palette to design/toybox/tokens.json', () => {
    expect(PALETTE).toStrictEqual(tokens.color.games['lineSiege']?.colorTokens);
  });

  it('keeps the Shell constants in step with the token file', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const shell = tokens.color.shell[scheme];
      expect(SHELL_COLORS[scheme]).toStrictEqual({
        success: shell['success'],
        warning: shell['warning'],
        dangerFill: shell['dangerFill'],
        gold: shell['gold'],
        cut: shell['cut'],
        toyInk: tokens.color.toyInk,
        toastBackground: shell['toastBg'],
        toastText: shell['toastInk'],
        scrim: shell['scrim'],
        line: shell['line'],
        adBackground: shell['adBg'],
        adLine: shell['adLine'],
        adText: shell['adInk'],
      });
    }
  });

  it('flags exactly the light pairs that Toybox carries with the ink outline (doc 18)', () => {
    const failures = checkPaletteContrast(PALETTE).filter((line) => line.startsWith('standard.'));
    expect(failures).toStrictEqual([
      'standard.light: danger on background is 3.80:1 < 4.5:1',
      'standard.light: primary on background is 1.87:1 < 3:1',
      'standard.light: starOn on surface is 1.48:1 < 3:1',
    ]);
  });
});
```

When Flock Tilt and Scrap Shove exist, add one `it` per app.

### 9.9 Pixel-parity checks

- **Reference renders:** open `design/toybox.html` in headless Chrome at device scale factor 3, set the page controls (`[data-set=theme|lang|game]` buttons, remembered in `localStorage` keys `pa-toybox.theme`, `.lang`, `.game`), set `--pz: 1` on `:root` (the page zooms phones to 0.72, or 0.84 below 520 px), and screenshot each `.scr` element (390 × 844 pt; tall screens are longer). The page loads Lilita One, Rubik and Vazirmatn from Google Fonts: capture online, or install the fonts locally. The PNGs in `design/reference/toybox/` are full-page captures at zoom 0.72 for review, not for diffing.
- **Device size:** the mockup phone is 390 × 844; the handbook's baseline simulator (iPhone 17 Pro) is 402 × 874. **Chosen:** re-render the mockup with `.scr` set to 402 × 874 before capture (the layout is fluid in width and height; only the S8 toast offset and the S3 sheet top are absolute), or use a 390 × 844 simulator if one is installed.
- **Masks and tolerances:** mask the status bar (top 54) and the home indicator; compare geometry strictly (edges, radii, shadow offsets within ±1 pt) and text regions with doc 07's pixel threshold, because Chrome and iOS anti-alias text differently. Compare light and dark, all four languages, and every game that exists.

---

## 10. Checklist

Before calling Shell UI work done:

- [ ] Colours come only from `theme.colors` and `SHELL_COLORS`; the app palette matches `tokens.json` (`toybox-tokens.test.ts` green) and its colour-blind mode equals the standard one.
- [ ] Every raised control uses `RaisedSurface`; static shadows use `hardShadow`; no `shadowRadius`, `shadowOpacity` or `elevation` anywhere.
- [ ] Radii, strokes and elevations come from `RADII`, `STROKE`, `ELEVATION` or the component's section-4 constants; no pill shapes.
- [ ] Every state has its shape cue (rule 10); only stickers, flags, art and logos are tilted.
- [ ] Fonts: five TTFs and three OFL files embedded; Lilita One never gets a `fontWeight`; S11d lists Lilita One and Rubik.
- [ ] Icons regenerated with `build-icon-paths.ts` after an icon change; contact sheet inspected; only the four directional icons flip.
- [ ] The screen matches section 5 (order, spacing, components, keys) and the mockup in light and dark, LTR and RTL, and at 200 % text (stacking rules of section 8).
- [ ] Reduce motion: no squash, no loops, fades as in section 3.11.
- [ ] Banner only on Home, Levels, Statistics; none for Premium owners.

---

## 11. Sources

- The mockup: `design/toybox.html` (2026-09-27): its CSS (`.app` layer), its palette data (`PAL`, `NAMES`, `SEM`, `INK`, `applyVars`), icon data (`ICONS`, `STAR_D`, `LOGOS`) and screen builders; the copy deck `design/shared/copy-deck.json` (draft 1, 2026-09-27) and `design/shared/copy-deck.md`; the captures in `design/reference/toybox/`.
- Fonts: [Lilita One on Google Fonts](https://github.com/google/fonts/tree/main/ofl/lilitaone) (`METADATA.pb`, `OFL.txt`) · [Rubik](https://github.com/googlefonts/rubik) and [its Google Fonts folder](https://github.com/google/fonts/tree/main/ofl/rubik) · [Vazirmatn](https://github.com/rastikerdar/vazirmatn) · [SIL OFL 1.1](https://openfontlicense.org/) · [fontTools varLib.instancer](https://fonttools.readthedocs.io/en/latest/varLib/instancer.html).
- Accessibility: [WCAG 2.2 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) · [relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).
- React Native 0.86.3 source read on 2026-09-28: `Libraries/StyleSheet/StyleSheetTypes.d.ts` (`boxShadow`, `outlineWidth`, `outlineOffset`, `outlineColor`, `outlineStyle`), `React/Fabric/Utils/RCTBoxShadow.mm`, `React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm` (outline layer) · [View style props](https://reactnative.dev/docs/view-style-props).
- `react-native-reanimated` 4.5.1 `src/animation/spring/springConfigs.ts` (default mass 4) · [withSpring](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/).
- `@shopify/react-native-skia` 2.6.2 `PathFactory` (`Stroke`, `AsWinding`, `MakeFromOp`) and `PathBuilder` (`setFillType`); its runtime deprecation notices for `SkPath.stroke()`, `makeAsWinding()` and `setFillType()` · [path migration guide](https://shopify.github.io/react-native-skia/docs/shapes/path-migration).

---

## Verified

On **2026-09-28** (macOS 27.0, Node 26.4.0):

- **Token file.** `design/toybox/tokens.json` was generated by evaluating the HTML's own `PAL`, `NAMES`, `SEM` and `INK` literals and the `line` values of `applyVars`, and by extracting `ICONS`, `STAR_D` and `LOGOS` (rects and circles converted to exact arc paths). It parses as JSON (13 top-level keys). It contains **75 distinct hex values: 71 appear verbatim in `toybox.html`, and the 4 others (`#1D1B3A8C`, `#1D1B3A24`, `#03020CB3`, `#E4E0FF29`) are the translucent twins listed in `meta.derivedHex`; none is unaccounted for.**
- **Contrast.** Computed with the WCAG 2.2 formula the mockup uses (`lum`/`cr` in its script); the mockup's own one-decimal table (body on ground, body on surface, muted on surface, text on accent, accent vs ground, outline vs ground, danger text, focus ring) matches these values.
- **Icons.** All 41 layer sets went through `build-icon-paths.ts` on headless Skia (`@shopify/react-native-skia` 2.6.2 on CanvasKit) with no errors or deprecation notices; the generated `icon-paths.ts` is 126 391 bytes. A contact sheet of the generated paths was inspected: all 41 correct. Without the `AsWinding` step, `mail`, `globe`, `theme` and `eye` filled solid (the union comes back even-odd). Doc 05's `icon-raster.golden.test.ts` rasterized all 41 (golden project: 47 tests pass).
- **Code.** In a copy of the handbook lab (scratchpad `fix-final/repo`: doc 04's ESLint config, doc 07's Jest projects): doc 05's updated `theme-types.ts`, `tokens.ts` and `test-palette.ts` and this doc's `palette.ts`, `shell-colors.ts`, `toybox-styles.ts`, `raised-surface.tsx` (+ test), the recipe probe, `build-icon-paths.ts` and `toybox-tokens.test.ts` passed `tsc` 6.0.3 for the shell, app, tooling and root projects, ESLint 9.39.5 with `--max-warnings 0` and Prettier 3.9.9. The full Jest run passed (unit: 28 suites, 110 tests; golden: 2 suites, 47 tests), and ESLint was clean over all of `packages/shell/src`, `apps/line-siege/src` and `packages/tooling/src`. The Toybox `TYPE_SCALE` of section 9.2 also compiled; with it, doc 10's `t.test.tsx` fails only on the expected heading line height (32 instead of 30).
- **Fonts.** `LilitaOne-Regular.ttf` (28 092 bytes) and `Rubik[wght].ttf` (359 804 bytes) were downloaded from `google/fonts` (main); their name tables give Lilita One "Version 1.002", PostScript `LilitaOne`, and Rubik "Version 2.300", axis wght 300–900. fontTools 4.60.2 cut `Rubik-Regular.ttf` and `Rubik-Bold.ttf` (212 KB each; PostScript `Rubik-Regular`, `Rubik-Bold`). Coverage (cmap): Lilita One has ä ö ü ß – ’ “ ” „ × · € … but no ẞ and no `tnum` feature; Rubik has all of these, ẞ and `tnum`.
- **Reanimated** 4.5.1 source: `withSpring`'s default mass is 4, hence `mass: 1` in section 3.11.
- **Not verified:** `boxShadow` and `outline*` rendering on the iOS simulator; `RaisedSurface`'s animation on a device; the Toybox fonts in a build; pixel parity of any real screen against the mockup.

---

## Open issues

1. **Dark ink family per game (Chosen: follow the data).** The design plan says games swap only ground, accent and pop, and principle 2 says one ink; the palette data tints the dark ink, outline, shadow, `inkSoft`, `onAccent` and `onPop` per game (and the light surface and sunken too). This doc follows the data (`PAL`). If the owner prefers one dark ink for all games, change `tokens.json` and the palettes together.
2. **Type scale and fonts in doc 05 / doc 10.** `TYPE_SCALE` still has doc 05's 34 / 28 / 20 sizes and no `number` role, and doc 10's `LATIN_SCRIPT` still uses the platform font. The switch (section 9.2 and the table in 9.3) needs doc 10's `fonts.ts` and `useLocalizedTextStyle` to take a `face` and per-role line heights, and one expectation in doc 10's `t.test.tsx` to change (30 → 32). Until then, display roles render in the platform font at doc 05's old sizes.
3. **`AppText` tones.** Toybox needs `onPop`, sticker ink, white-on-ink and toast text colours; doc 05's `TextTone` has only default, muted, onPrimary and danger.
4. **Doc 15's contrast pairs.** `checkPaletteContrast` requires `primary`/`background` ≥ 3, `starOn`/`surface` ≥ 3 and `danger`/`background` ≥ 4.5, which every light Toybox palette fails by design (section 8). Proposal for doc 15: check `border`/`background` and `border`/`primary` ≥ 3 and `danger`/`surface` ≥ 4.5 instead.
5. **Hold-to-confirm label contrast.** During the hold, the 17 pt Bold `danger` label sits on `dangerFill` at 4.43:1 in light (needs 4.5). Options for the owner: a lighter light `dangerFill` (`#FFDFE2` gives 4.62:1; not in the mockup), or accept it as a transient state.
6. **Screen gutters.** Doc 05's `ScreenFrame` pads its column by 16; Toybox pads the top bar by 16 and the body by 20. `ScreenFrame` should drop its padding and let the top bar and body apply theirs.
7. **Icon data size.** The one-path-per-icon contract costs 126 KB of path strings; storing the layers and stroking them at raster time would need about 10 KB and change doc 05's `rasterize()`. Kept as is for now.
8. **Unverified on device:** `boxShadow` crispness and cost with many tiles, `outline` around rotated or dashed views, and the spring feel. Check in the first simulator build; the fallback for a shadow is the `RaisedSurface` shadow View.
9. **Pixel-parity device size** (section 9.9): 390 × 844 mockup vs the 402 × 874 baseline simulator.
10. **Chosen values, collected** (each marked where it appears): sticker and chip radius 8 (token card says 6); elevations 2 and 4; `body` line height 1.32 and `label` 1.25 / 1.45; spring mass 1; `LilitaOne.ttf` rename and `OFL-<Family>.txt` names; colour-blind = standard; logical sticker padding and unmirrored tilt; `line` colour shared by all games in dark; fixed top bar and pinned banner on long screens; banner band collapses with the slot; toast position (above the banner, not at the S8 mock's 352 pt) and 3 s duration; hold fill animation; confetti motion; focus ring on iPad keyboard focus; the "Phone language" sticker marks the phone's language.
11. **States the mockup does not draw** (layouts chosen in section 5): Home and S9 after today's daily is played; Daily and Endless results; Continue for Premium owners; Premium owners' Settings group; the reset-statistics, newer-save and crash dialogs; S5 on its own; pressed segment, slider and pause key; large-text layouts.
12. **Mock-only parts:** the S3 consent sheet, the 320 × 50 banner placeholder and "Ad" chip, the board placeholder, the how-to-play pictures. The S11 "Ad privacy options" row shows only where doc 11 requires it, although the mockup always draws it.
13. **Copy deck is a draft:** fa and ckb await native review (copy-deck.md); longer final strings may change wrapping, so re-check S2, S4 keys and stickers after the review.
