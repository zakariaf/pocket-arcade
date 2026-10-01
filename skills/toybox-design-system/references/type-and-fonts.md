# Toybox type and fonts

## Contents

- The three faces and their files
- Installing the fonts in an app
- Type roles
- Component text styles
- Face selection per script
- Numbers and digits
- RTL font rules
- How AppText applies all of this
- Line heights on the pixel grid (text metrics vs the references)
- Persian overflow on iOS (the overflow guard)
- Balanced display text
- Tabular digits and stat-list baselines

## The three faces

All SIL OFL 1.1, bundled in the app, never downloaded at runtime. The files are in `assets/fonts/` of this skill (with `SOURCES.md`: URLs and sha256 of each file).

| Face | Files | Version | Used for |
|---|---|---|---|
| **Lilita One** Regular | `LilitaOne.ttf` (upstream `LilitaOne-Regular.ttf`, 28 KB, renamed so the file name equals the PostScript name `LilitaOne`) | 1.002 | display roles, headings, numbers, hero keys, stickers, group tabs, game names in every language. One weight: never set `fontWeight`. Covers German ä ö ü ß; lacks ẞ and tabular figures |
| **Rubik** Regular and Bold | `Rubik-Regular.ttf`, `Rubik-Bold.ttf` (static cuts, PostScript `Rubik-Regular`, `Rubik-Bold`) | 2.300 | body, labels, captions, all other text in en/de |
| **Vazirmatn** Regular and Bold | `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf` | 33.003 | all fa and ckb text: display roles in Bold, text roles in Regular or Bold at the same sizes |

`Rubik-Medium.ttf` is in the folder for completeness; Toybox uses only 400 and 700, so apps do not ship it.

## Installing the fonts in an app

1. Copy into `apps/<game>/assets/fonts/`: `LilitaOne.ttf`, `Rubik-Regular.ttf`, `Rubik-Bold.ttf`, `Vazirmatn-Regular.ttf`, `Vazirmatn-Bold.ttf`, and the licences `LilitaOne-OFL.txt`, `Rubik-OFL.txt`, `Vazirmatn-OFL.txt` (an older `OFL.txt` for Vazirmatn is also accepted). Copy the files byte for byte from this skill's `assets/fonts/`; `check-design-system` compares sha256.
2. The `expo-font` config plugin entry, in the Shell's one plugin list (`shellPlugins` in `packages/shell/src/config/shell-plugins.ts`; an older repo may list only the two Vazirmatn files there, so add the three Latin faces). The Shell build creates `shell-plugins.ts` at step 8 (before the first simulator build); until that file exists, and no `app.config.ts` holds an entry, `check-design-system` prints `SKIP packages/shell/src/config/shell-plugins.ts [font-plugin] due at Shell step 8: ... not yet created` and the rule does not count. From step 8 on it is strict. Paths are relative to the app folder; `check-design-system` fails with `font-plugin` when an Expo app exists and no entry names all five:
   ```ts
   ['expo-font', { fonts: [
     './assets/fonts/Vazirmatn-Regular.ttf', './assets/fonts/Vazirmatn-Bold.ttf',
     './assets/fonts/LilitaOne.ttf', './assets/fonts/Rubik-Regular.ttf', './assets/fonts/Rubik-Bold.ttf',
   ] }]
   ```
   Family names = file names = PostScript names: `LilitaOne`, `Rubik-Regular`, `Rubik-Bold`, `Vazirmatn-Regular`, `Vazirmatn-Bold`. Never `fontWeight` with them: pick the weight's own family.
   Dependency: `expo-font` (SDK 57: `~57.0.4`) is a native module, so it goes into the Shell's `peerDependencies` (`"*"`) and into every app's `dependencies` at the same version: run `npx expo install expo-font` in each app. Without it `npx expo config` cannot resolve the plugin entry above.
3. The S11d licences screen lists Lilita One 1.002, Rubik 2.300 and Vazirmatn 33.003, each "SIL Open Font License 1.1" (names and licences are never translated).

## Type roles

Sizes are points before Dynamic Type. Letter-spacing is 0 for every role.

| Role | Size | Latin face, line height | Arabic-script face, line height | Use |
|---|---|---|---|---|
| `display` | 38 | Lilita One, 1.1 (41.8 pt) | Vazirmatn Bold, 1.45 (55.1 pt) | result and Premium titles |
| `title` | 30 | Lilita One, 1.1 | Vazirmatn Bold, 1.45 | screen titles without a top bar, empty states, S12 state heads |
| `number` | 30 | Lilita One, 1.1 | Vazirmatn Bold, 1.1 | stat values; tabular figures (`isTabular`) |
| `heading` | 21 | Lilita One, 1.1 | Vazirmatn Bold, 1.45 | panel and pack headings, step text, reason line |
| `body` | 17 | Rubik 400, 1.32 | Vazirmatn Regular, 1.5 | running text, row labels |
| `label` | 17 | Rubik 700, 1.25 | Vazirmatn Bold, 1.45 | button labels |
| `caption` | 13 | Rubik 400, 1.4 | Vazirmatn Regular, 1.6 | small print, footnotes |

**Chosen:** `body` uses 1.32 (the mockup CSS; its note says 1.3); `label` 1.25 / 1.45 from the button rule; `number` keeps 1.1 in both scripts. In code every line height sits on the device pixel grid (`snapToPixels`, below), never on whole points.

## Component text styles

Components use these named styles (`TYPE_STYLES` in `type-styles.ts`; `AppText variant="..."`). "display" = Lilita One / Vazirmatn Bold; "text 700" = Rubik Bold / Vazirmatn Bold. Colours are the component's job (pass a `tone`).

| Style name(s) | Size | Face, weight | Line height Latin / Arabic | Notes |
|---|---|---|---|---|
| `gameNameHome` / `gameNameSplash` / `gameNameAbout` | 28 / 50 / 34 | brand (Lilita One everywhere) | 1.05 / 1.05 | +0.01 em, isolated LTR |
| `topBarTitle` | 27 | display | 1.1 / 1.45 | |
| `heroKeyLabel`, `dialogTitle` | 25 | display | 1.1 / 1.45 | |
| `groupTab` | 15 | display | 1.1 / 1.45 | tone onPop |
| `levelNumber` | 21 | display | 1 / 1.45 | fa and ckb 1.45: at 1.0 iOS clips Vazirmatn's digits (token file and design changed 2026-09-30, lead decision L2); the 62 pt tile centres a taller number, so its mini stars sit lower |
| `scoreValue` | 44 | display | 1 / 1.45 | fa and ckb 1.45 for the same reason (lead decision L9, token file and design changed 2026-09-30): the S7 score, the endless and daily results; 44 pt in Latin, 191/3 pt at 3x in fa and ckb (44 x 1.45 = 63.8); the score panel keeps no fixed row height |
| `statValueCompact` | 23 | display | 1.1 / 1.1 | no wrap (3-column grids); tabular figures (`isTabular`) |
| `statListValue` | 22 | display | 1.1 / 1.1 | align end |
| `streakValue` | 28 | display | 1.1 / 1.45 | |
| `gameTopBarScore` | 24 | display | 1.1 / 1.45 | |
| `calendarMonth` | 16 | display | 1.4 / 1.4 | tone onPrimary |
| `calendarDay` | 42 | display | 1.15 / 1.15 | |
| `sticker` / `stickerSm` / `stickerXs` | 16 / 14 / 12 | display | 1.15 / 1.45 | tone toyInk (onInk on the ink sticker) |
| `chip` | 15 | text 700 | 1.3 / 1.5 | |
| `rowButtonDescription` | 14 | text 400 | 1.3 / 1.5 | muted on secondary, onPop on pop |
| `keyLabel` | 15 | text 700 | 1.2 / 1.4 | |
| `toggleKeyLabel` | 14 | text 700 | 1.2 / 1.45 | |
| `toggleKeyState` | 13 | text 400 | 1.2 / 1.45 | |
| `segmentLabel` / `segmentLabelInRow` | 15 / 14 | text 700 | 1.2 / 1.45 | |
| `segmentPreview` | 13 | text 400 | 1.2 / 1.45 | |
| `rowLabel` | 17 | text 400 | 1.32 / 1.5 | |
| `rowLabelStrong` | 17 | text 700 | 1.32 / 1.5 | mockup override, not in the token file: strong rows ("Remove ads – €1.99") and danger rows (`.row.strong .rl`, `.row.danger .rl`); the `label` role's 1.25 made each line 1.2 pt short |
| `rowDescription` | 14 | text 400 | 1.3 / 1.5 | muted |
| `rowValue` | 15 | text 400 | 1.32 / 1.5 | muted, align end |
| `subRowLabel` | 14 | text 400 | 1.32 / 1.5 | muted |
| `optionNameChoice` / `optionNameList` | 21 / 18 | text 700 in the option's own script | 1.3 / 1.5 | pass `language` |
| `lead` | 18 | text 400 | 1.32 / 1.5 | |
| `prose` | 16 | text 400 | 1.5 / 1.75 | S11c policy paragraphs |
| `toast` | 15 | text 400 | 1.35 / 1.55 | tone toast |
| `nudge` | 15 | text 400 | 1.25 / 1.45 | quiet buttons; the style has no underline: `QuietButton` draws the design's 2 pt line itself (toybox-components) |
| `scoreLabel` | 17 | text 700 | 1.32 / 1.5 | muted |
| `scoreLines` | 16 | text 400 | 1.32 / 1.5 | |
| `statLabel` | 14 | text 400 | 1.3 / 1.5 | muted |
| `statListKey` | 15 | text 400 | 1.32 / 1.5 | |
| `statListHeading` | 15 | text 700 | 1.32 / 1.5 | mockup override, not in the token file: the stat list's first row ("Best score", `.slist>div:first-child`) is the key's size in Bold; the 17 pt `label` role made it 2 pt too tall |
| `streakLabel` | 14 | text 700 | 1.32 / 1.5 | muted |
| `packProgress` | 15 | text 700 | 1.32 / 1.5 | |
| `weekdayLetter` | 13 | text 700 | 1.2 / 1.5 | muted |
| `weekTodayTag` | 11 | text 700 | 1.3 / 1.3 | toyInk |
| `barValue` | 13 | text 700 | 1.2 / 1.2 | |
| `barDay` | 13 | text 700 | 1.3 / 1.5 | muted |
| `legend`, `settingsFooter` | 14 | text 400 | 1.32 / 1.5 | muted |
| `rule` | 15 | text 400 | 1.32 / 1.5 | muted |
| `splashTagline` | 18 | text 400 | 1.32 / 1.5 | muted, centred, max width 290 |
| `gameTopBarLevel` | 16 | text 700 | 1.32 / 1.5 | |
| `gameTopBarProgress` | 13 | text 400 | 1.32 / 1.5 | muted |
| `adChip` | 11 | text 700 | 1.3 / 1.3 | adBackground on adText |
| `adSize` | 12 | text 400 | 1 / 1 | adText |

## Face selection per script

`scriptFontFor(language, weight, face)` in `packages/shell/src/i18n/fonts.ts`:

| Script | face, weight | fontFamily | Default line height |
|---|---|---|---|
| Latin (en, de) | display, any | `LilitaOne` | 1.1 |
| Latin | text, regular | `Rubik-Regular` | 1.32 |
| Latin | text, bold | `Rubik-Bold` | 1.32 (labels 1.25) |
| Arabic (fa, ckb) | display, any | `Vazirmatn-Bold` | 1.45 (numbers 1.1) |
| Arabic | text, regular | `Vazirmatn-Regular` | 1.5 (caption 1.6, prose 1.75) |
| Arabic | text, bold | `Vazirmatn-Bold` | 1.5 (labels 1.45) |
| any | brand | `LilitaOne` | 1.05 |

The font follows the language of the **text**, not the UI: autonyms in the language list pass `language` so "فارسی" uses Vazirmatn even in the English UI.

## Numbers and digits

Digits follow the language (Persian `۰-۹` in fa/ckb, switchable in S11 Numbers). Stat values (the `number` role and `statValueCompact`) carry `isTabular: true`, which `AppText` maps to `fontVariant: ['tabular-nums']`, as the design's `.sv` sets `font-variant-numeric: tabular-nums`. Lilita One has no `tnum` feature, so Latin stat values look the same either way; Vazirmatn has one, and without it Persian stat values were proportional (S10: 12 pt of ink for ۱۱ where the design has 20.3). Other numbers keep proportional figures (**Chosen**, as the design).

## RTL font rules

- Every Lilita One role becomes Vazirmatn Bold with line height 1.45 (numbers 1.1; the level-tile number and the score value 1.45 as well); every Rubik role becomes Vazirmatn Regular or Bold at 1.5 (caption 1.6, prose 1.75, labels 1.45).
- Game names stay in Lilita One, isolated LTR (FSI ... PDI): `AppText` isolates any `brand` style.
- Letter-spacing is always 0 in Arabic script (`useLocalizedTextStyle` drops tracking there).

## How AppText applies it

`AppText` (the only component that renders text) takes `variant` (a role or a component style), `tone`, `align`, `language`, `numberOfLines`, `isHeader`, `testID` and `onLineCount` (called after each text layout with its line count; `NotePanel` fits a one-line note to its text with it). It asks `useLocalizedTextStyle` for family, size, the pixel-snapped line height, writing direction and alignment, caps Dynamic Type at 200 % (`maxFontSizeMultiplier={2}`), sets `accessibilityRole="header"` for headings, maps `isTabular` to tabular figures, balances display text (below) and guards Persian overflow (below). No style is underlined: the quiet button draws its own line. Tones: `default`, `muted`, `onPrimary`, `onPop`, `danger`, `success`, `toyInk`, `onInk` (white on the ink sticker), `toast`.

## Line heights on the pixel grid (text metrics vs the references)

The Toybox references are Chrome renders; the app is React Native on iOS (CoreText). Three facts decide how text boxes and glyphs line up with them, measured on the parity device (iPhone 16 Pro, 3 px per pt) with pixel scans of the row separators:

1. **React Native rounds every measured text box UP to whole device pixels.** A fractional line height (17 x 1.32 = 22.44) therefore made each text line up to 1/3 pt taller than Chrome's box: a Settings row with a two-line label and a two-line description grew 0.4-0.7 pt, the Display group ended 2.3 pt taller, and the bottom of S11 drifted 2.5 pt (`scroll-mismatch`). Rounding to whole points instead (26 for 25.5) drifted every Persian screen by about 1 pt per few lines.
2. **So a line height sits on the pixel grid:** `lineHeight = snapToPixels(fontSize * ratio)` = `round(value * PixelRatio.get()) / PixelRatio.get()`. The box is then exactly lines x lineHeight, which is what Chrome draws within 1/3 pt. At 3x: 14 x 1.3 = 18.2 -> **55/3**, 17 x 1.32 = 22.44 -> **67/3**, 17 x 1.5 = 25.5 -> **77/3** (not 26), 38 x 1.1 = 41.8 -> 125/3, the Persian level number 21 x 1.45 = 30.45 -> **91/3**. `snapToPixels` lives in the one shared `i18n/use-localized-text-style.ts`; the pure grid function `snapToGrid(points, pixelRatio)` and `lineHeightOf(variant, script, pixelRatio)` live in `theme/type-styles.ts`, and `type-styles.test.ts` pins 55/3, 67/3, 77/3 and the level number's 21 (Latin) and 91/3 (Arabic script). `check-design-system` fails `line-height-grid` on `Math.round`/`ceil`/`floor` line heights, on a hook that does not call `snapToPixels`, and on a `snapToGrid` that misses those three values.
3. **Product code has no glyph-position nudges.** With the boxes exact, what remains is where CoreText places glyphs inside a line box compared with Chrome: Rubik 14 sits up to 2.0 pt lower, Lilita One up to 1.7 pt, Rubik 17 within 0.3 pt, and a Persian madda (آ) is drawn 0.8-1.3 pt narrower. Players never see this, and a per-size `translateY`, padding or margin would break the box heights that are now exact (`check-design-system` fails `no-glyph-nudge` on such keys in `AppText` and `use-localized-text-style.ts`). The one exception is not a nudge but a font-metric rule for Arabic script: the overflow guard in the next section, derived from Vazirmatn's own ascent and descent, never from a measured offset. The parity text-ink gate absorbs the offset by measurement (per-role centre floors recorded with their evidence in the parity skill). Before blaming glyph placement for a text failure, rule out a type-role mismatch: compare the element's computed font-size and line-height in the reference `.layout.json` with the role the app uses (the strong row label was such a case: `label` 1.25 where the design has 1.32).

Jest tests that assert a line height mock the pixel ratio: `jest.spyOn(PixelRatio, 'get').mockReturnValue(3)`, then expect `67 / 3`, never a rounded number.

## Persian overflow on iOS (the overflow guard)

Vazirmatn's content box is its rounded hhea ascent plus its rounded descent, 2100 + 1100 of 2048 units per em: 1.5625 em, 47 pt at 30 pt in Chrome's layout. That is taller than most Toybox Arabic-script lines (a 30 pt stat value at 1.1 has a 33 pt line). Chrome centres the overflow on the line box (half above, half below) and lets the glyphs spill; iOS puts all of it above the line and clips the Text at its frame. On the device, Persian digits on the tight number lines lost their tops (S10: 17.7 pt of ink for 20.7) and every Arabic-script text sat half its overflow higher than the design (S12's 38 pt title: 3 pt, over the 2.1 pt parity limit).

`AppText` therefore guards Arabic-script text (the family starts with `Vazirmatn`) when half the overflow is at least 1.5 pt:

- `h = (round(1.0254 x size) + round(0.537 x size) - lineHeight) / 2` (1.0254 = 2100 / 2048, 0.537 = 1100 / 2048).
- The Text gets `paddingTop = ceil(h) + h`, `paddingBottom = ceil(h) - h` and `marginVertical = -ceil(h)`: the line moves down by half the overflow, the frame is tall enough to hold the ink, and the negative margins cancel the pads, so the element still takes the design's line box.
- The Text sits in a `View` that keeps the design's line box and carries the testID (Maestro and the parity bounds measure that box, not the padded Text).

Latin text and Arabic-script lines with less than 1.5 pt of half overflow render exactly as before (no wrapper). `app-text.test.tsx` pins the S10 case: a Persian `number` (30 pt, 33 pt line) gets `paddingTop` 14, `paddingBottom` 0 and `marginVertical` -7, with the testID on the wrapper. `check-design-system` fails `arabic-overflow-guard` when `AppText` lacks the Vazirmatn metrics, the pad and margin shape or the wrapper that carries the testID. Display numbers that must show their full digits (the level number, the score) also get a 1.45 Persian line height (`persian-number-clip`).

## Balanced display text

The design sets every display text (`.d`: titles, headings, dialog titles) with CSS `text-wrap: balance`: a heading that needs two lines gets two lines of nearly equal length, the narrowest width that keeps its line count. iOS fills the first line greedily, so two-line titles broke in other places (the S14 fa restart title, the S11c summary in en and fa). `AppText` runs `useBalancedWrap(style.face === 'display', text, align)` from `ui/use-balanced-wrap.ts`: after a layout it searches that width from the Text's own line measurements (`onTextLayout`) and applies it as a pad at the text's end (start pad for `align="end"`, half on each side when centred), so the element keeps the full width the design measures. Body text stays greedy.

Two iOS pitfalls made the obvious search wrong on the device while Jest passed:

1. **`onTextLayout` and `onLayout` arrive in one batch.** A handler that computes the next state from the closure's state loses one of the two events, so the search never started. The hook updates its state only with functional updates (`setMeasure((previous) => ...)`), in both handlers.
2. **An unchanged layout sends no event.** React Native sends no `onTextLayout` when a new width lays out the same lines as the last event. A bisection that probes a wider width straight after a failed probe can lay out the same lines again and then waits forever (the S11c en summary stuck at 4 lines where the design has 3). So every probe is narrower than the widest kept line; after a probe that adds a line the pad first goes back to the last kept width, and only then probes between; and a layout wider than the room the current pad leaves is dropped as stale.

`use-balanced-wrap.test.ts` replays the device-measured S11c sequence, and `app-text-balance.test.tsx` covers the pad at the end, the one-batch case and greedy body text. `check-design-system` fails `balanced-display` when `AppText` does not call `useBalancedWrap` for display text or when the hook sets its state from a closure.

## Tabular digits and stat-list baselines

- **Tabular figures:** see "Numbers and digits" above (`isTabular` on `number` and `statValueCompact`; `check-design-system` rule `tabular-digits`).
- **Stat-list baselines:** the design's stat list (`.slist`) aligns each key and value on one CSS baseline. With a Persian line that overflows its box, iOS reports another baseline, which put values 8 pt low. The toybox-components `StatList` therefore aligns its rows `flex-start` and places key and value on Chrome's baseline, computed from the font metrics (`ui/text-metrics.ts`: `lineMetricsOf`, `chromeBaseline`; `ui/use-chrome-baseline.ts`: the baseline of a type style in the current language), not from Yoga.
