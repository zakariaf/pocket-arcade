# Lists and surfaces

Everything that lies flat and informs: lists and rows, icon tiles, panels, chips, stickers, art tiles and confetti. None of these has a shadow; only pressable things are raised. Colour names as in keys-and-inputs.md.

**Rendered edge widths.** The token file gives tabs, icon tiles, stickers, chips and confetti a 2.5 pt edge (the Today tag 1.5), but the committed design references are Chrome renders, and Chrome floors a CSS border of 1 px or more to whole px: they draw 2 (and 1), every `.layout.json` style says `2px solid`, and the parity gates measure 2.0 pt. An app drawing 2.5 failed `[border]` on all six S11 group tabs and `[structure]` on every 38 pt icon tile. `write-component-specs.mjs` writes each CSS border as rendered (`asRenderedBorder(w) = w >= 1 ? floor(w) : w`), so the measurements below say "2 (token 2.5)". The sticker's 3.5 pt die-cut ring is a box-shadow, not a border, and keeps its token value.

**testID on the element the design measures.** A tab, chip or sticker is measured as the whole box (padding and edge), so its testID, `accessible`, role and label sit on that View, and the AppText inside has none. A testID on the inner text made Maestro report only the text (the group tab went missing from the parity list, the sticker's bounds shrank to its words). `check-components` fails `testid-on-inner-text` when a component's own testID sits on an AppText that is the only labelled child of a View that draws the box. Part ids (`.label`, `.value`) stay on their text.

## Contents

1. [List, list group and group tab (4.11)](#list-list-group-and-group-tab-411)
2. [List row and sub-row (4.11)](#list-row-and-sub-row-411)
3. [Icon tile (4.12)](#icon-tile-412)
4. [Panel, panel header, note panel, offer box (4.13)](#panel-panel-header-note-panel-offer-box-413)
5. [Sticker, Premium badge, Today tag (4.20)](#sticker-premium-badge-today-tag-420)
6. [Chip (4.21)](#chip-421)
7. [Art tile and Premium art (4.22)](#art-tile-and-premium-art-422)
8. [Confetti (4.34)](#confetti-434)

## List, list group and group tab (4.11)

**Templates:** `list.tsx` (`List`), `group-tab.tsx` (`GroupTab`), `list-group.tsx` (`ListGroup` = tab + list).

**List:** a flat panel: 3 pt `outline` edge, radius 14, `surface`, no shadow, clips its rows (`overflow: hidden`).

*Measurements* (`list`): radius 14 · border 3.

**Group tab:** a folder tab above each settings list, flush with the list's start edge: padding 4 top / 12 inline / 5 bottom, 2 pt `outline` edge on top and sides only (as rendered), top radius 9, `pop` fill, `onPop` text (`groupTab` 15 display face), 16 pt icon, gap 6; it sits on the list's top edge (above the list in z-order), so tab and list read as one piece. The tab View is the heading: it carries the testID, `accessible`, `accessibilityRole="header"` and the title as its label; the AppText inside has no testID.

As rendered (mockup overrides in `write-component-specs.mjs`): the token file says start margin 14 and a 3 pt overlap, but the references draw the tab flush at x = 20 with the list's edge unbroken 27.5 below the tab's top, so the specs hold `marginStart` 0 and `overlap` 0.

*Measurements* (`groupTab`): marginStart 0 (token 14, override) · paddingTop 4 · paddingBottom 5 · paddingInline 12 · border 2 (token 2.5) · radiusTop 9 · overlap 0 (token 3, override) · gap 6 · icon 16.

**testID:** `ListGroup testID="settings.group.sound"` gives the tab `settings.group.sound.tab` and the list `settings.group.sound.list`.

## List row and sub-row (4.11)

**Templates:** `list-row.tsx` (`ListRow`), `sub-row.tsx` (`SubRow`), example `examples/sound-group.tsx`.

**Row:** min 60 tall, padding 10 × 14, gap 12, centred vertically (`alignItems` and `alignContent: 'center'`: the row wraps, and Yoga's default `alignContent: 'flex-start'` put a single line of parts at the top of the 60 pt row, where CSS centres a one-line flex row; S11a failed until it was set): icon tile (38) · text column (label `rowLabel` 17 regular, gap 2; description `rowDescription` 14 `inkSoft`) · end slot (`end`): `chevron` (value `rowValue` 15 `inkSoft`, end-aligned, then a 20 pt `inkSoft` chevron that flips in RTL), `toggle` (the Toggle), `radio` (a RadioMark) or `none`. Rows after the first have a 2 pt `line` separator on top (`isFirst` drops it).

*Measurements* (`row`): minHeight 60 · paddingBlock 10 · paddingInline 14 · gap 12 · separator 2 · labelGap 2 · chevron 20 · subRowPaddingStart 64.

- **Wrap row** (`below`): the end content drops to a full-width line under the label (the Numbers and Theme rows carry a segmented control there).
- **Danger row** (`isDanger`): label `danger` Bold, icon tile `dangerFill` with `danger` icon and edge.
- **Strong row** (`isStrong`): label Bold in the normal ink, e.g. S11 "Remove ads – €1.99". Strong and danger labels use `rowLabelStrong` (17 Bold, line height 1.32 Latin / 1.5 Arabic, a mockup override in the theme's `TYPE_STYLES`), not the button `label` role (1.25), which made each such line 1.2 pt shorter than the reference.
- **Autonym row** (`labelLanguage`): the language list shows each name in its own script, in the option-name style (`optionNameList`, 18 Bold, the design's `opt-n`), never the 17 pt row label.
- **Icon** (`icon?: IconTileIcon`): an `IconName`, or the two-colour rating star (`'rating-star'` filled, `'rating-star-hollow'`), which the S11 "Rate this game" row uses (the design's `star(false)`, a 1.8 edge; the 2.5-stroke `star-outline` icon looked heavier).
- **Column row** (`textExtra`): more lines in the text column under the description, where each part keeps its own width (the column has `alignItems: 'flex-start'`), as the design's S11d licence column: the second muted line and the centred "Show licence text" nudge. Never put such lines in `below`, the wrapping end slot: its 12 pt row gap made every S11d row 10 pt taller and shifted the tall capture's scroll offsets.
- **Description id** (`descriptionTestID`): the description's own testID where the screen map names the part (S11d `settings-licences.<id>.licence`); the default is `<testID>.description`.
- **Sub-row** (volume under Sound effects and Music): no separator, min height 0, padding top 0, start padding 64 (lines up with the label), label 14 `inkSoft`, then a slider.

**Press:** a row is flat. It is one of the three files allowed to use `Pressable` directly: pressed = `sunken` background, nothing moves. The whole row is the target for chevron, toggle and radio rows.

**Accessibility:** role follows the end: `button` (chevron), `switch` with `accessibilityState.checked` (toggle), `radio` with `selected` (radio), no role and no press for `none`. The name is the label (plus value) as VoiceOver reads the row; the toggle and radio marks inside are hidden.

**testID parts:** `.icon`, `.label`, `.description` (or `descriptionTestID`), `.value`, `.toggle`, `.radio` (`settings.sound-effects-switch.toggle`). A sub-row: `.label`; its slider has its own id.

**Do:** make the whole row the target. **Don't:** add shadows to rows or lists; put a raised button inside a row.

## Icon tile (4.12)

**Template:** `icon-tile.tsx` (`IconTile`, paints pop, accent, gold, danger, plain; sizes row 38 and statHeader 34).

**Anatomy:** 38 × 38 square, radius 10, 2 pt `outline` edge (as rendered), 22 pt icon. Paints: default `pop` / `onPop`; `accent` / `onAccent` (Endless card, Premium benefits); `gold` gold / toy ink with toy-ink edge (Premium rows, debug Premium); `danger` `dangerFill` / `danger` with `danger` edge; `plain` `surface` / `ink` (locked pack). In stat panel headers: 34 with a 20 pt icon. It may also hold a rating star: `icon` is an `IconTileIcon` (`export type IconTileIcon = IconName | 'rating-star' | 'rating-star-hollow'`), which `ListRow`, `NotePanel` and the S10 Best panel pass through (the Best panel's header draws the gold `rating-star`, the design's `star(true)`, not an ink `star-filled`). Decorative (the row carries the label).

*Measurements* (`iconTile`): size 38 · radius 10 · border 2 (token 2.5) · icon 22 · sizeInStatHeader 34 · iconInStatHeader 20.

## Panel, panel header, note panel, offer box (4.13)

**Templates:** `panel.tsx` (`Panel`), `panel-header.tsx` (`PanelHeader`), `note-panel.tsx` (`NotePanel`), `offer-box.tsx` (`OfferBox`).

**Panel:** a flat information card: 3 pt `outline` edge, radius 14, `surface`, padding 14 × 16, **no shadow**. Variants: `padding="daily"` (14 / 14 / 16, gap 12), `padding="compact"` (streak and stat cards, 12 × 14, gap 4: label 14 Bold `inkSoft` with an 18 pt icon, value `streakValue` 28 display), `tone="locked"` (locked pack: the panel's own ink `outline` edge, 3 pt and dashed, on the `sunken` fill, gap 6), `tone="error"`. The score panel (4.29) is a panel too.

**Locked pack edge.** The design draws the locked pack `3px dashed` in ink (`#1D1B3A` light), the same colour as every panel edge; only the dash and the sunken fill say "locked" (with the padlock tile and the Locked sticker). The locked style therefore sets no `borderColor` of its own: an `inkSoft` (`textMuted`) edge failed every S8 `levels.pack.2` edge check. `lists.test.tsx` pins `borderStyle: 'dashed'`, `borderColor` = `border` and `backgroundColor` = `sunken`, and `check-components` fails `locked-pack-edge` when the locked style recolours the edge. (A locked level tile is different: the design draws its dashed edge in `inkSoft`.) React Native on iOS draws `borderStyle: 'dashed'` with its own dash length and phase, which no style sets, so the dashed edges of the locked pack, locked level tiles and the S7 offer box differ from Chrome's dashes in the parity structure check; that is a pre-listed platform waiver, never redrawn in Skia.

*Measurements* (`panel`): radius 14 · border 3 · paddingBlock 14 · paddingInline 16 · elevation 0.

**Panel header:** an icon tile 34 (20 pt icon) or a logo tile 36 at the start (`leading`), then the heading (`heading` 21 display, a header), gap 10, 12 pt above the content. testID = `<panel>.title`.

**Note panel:** a panel laid out as a row, gap 12, top-aligned (the design's `.note-p`: `align-items: flex-start`): the 22 pt icon has `alignSelf: 'flex-start'` and a 2 pt top margin, then the body text. A centred icon sat lower than the design's on every multi-line S12 note. Error variant (`isError`, S12): `danger` edge, `dangerFill` fill, `danger` icon. `isStrong` sets the text in `rowLabelStrong` (17 Bold on the body's 1.32 / 1.5 line, the design's `<b>` in a body paragraph), never the 17/1.25 `label` role, which made the S12 pending panel 2.4 pt short. `iconTile` (an `IconTilePaint`) puts the icon on a 38 pt tile of that paint, centred on the text: the S11a right-to-left note shows a pop globe tile, not a bare icon. **Width:** the design's `<p>` is a flex item as wide as its text, so a note that laid out on one line shrinks to its text (`flexShrink: 1`), while a wrapped note keeps `flex: 1` and fills the row. `AppText`'s `onLineCount` tells the panel which case it is. A one-line right-to-left note otherwise started 9 pt further left than the design's, and the parity text-ink window cut off the start of the line (S12 unavailable fa). `lists.test.tsx` pins both widths. Parts `.icon`, `.label`.

**Offer box** (S7 lose): a dashed 3 pt `outline` frame, radius 14, padding 14, gap 10, no fill: the pop "Continue – watch an ad" block button + a caption.

*Measurements* (`offer`): border 3 · style dashed · radius 14 · padding 14 · gap 10.

**Don't:** give a panel a shadow, or make a whole panel pressable (put a button inside it).

## Sticker, Premium badge, Today tag (4.20)

**Template:** `sticker.tsx` (`Sticker`: papers gold, accent, pop, ink; sizes regular, sm, xs; `tiltDeg`; `icon` or `rating-star`; `slapDelayMs`).

**Anatomy:** a tilted label: padding 5 top and bottom / 9 on the left / 11 on the right in both directions (the mockup pads physically, `padding: 5px 11px 5px 9px`, so in RTL the larger pad sits on the right, next to the icon; the component swaps its logical start and end pads when the layout is RTL, because physical style keys are banned), gap 6, radius 8, 2 pt toy-ink edge (as rendered), **3.5 pt white die-cut ring** (`dieCutRing`, colour `cut`) outside the edge, text `sticker` style (16 display) in toy ink, optional 18 pt icon or rating star at the start; default tilt −4°, range 2–8° either way; never wider than its container (`maxWidth: '100%'`, long German or Sorani text wraps inside).

*Measurements* (`sticker`, start/end as seen left to right): paddingBlock 5 · paddingStart 9 · paddingEnd 11 · gap 6 · radius 8 · border 2 (token 2.5) · ring 3.5 (box-shadow, token value) · icon 18 · rotateDefault -4 · rotateRange 2/8 · sm.paddingBlock 3 · sm.paddingStart 7 · sm.paddingEnd 9 · xs.paddingBlock 2 · xs.paddingStart 5 · xs.paddingEnd 7 · xs.gap 4 · xs.icon 14.

**The S7 New best sticker** is the gold `sm` sticker with the rating star, tilted **+6°** (the mockup's `sticker(t('result.win.new-best'), {cls: 'sm', r: 6, icon: 'star'})`): 2 + 7 + 18 + 6 + text + 9 + 2 pt wide (103 × 28 unrotated in en). `ScorePanel` sets both; the regular size (9 / 11 pads, 16 pt text) and the default −4° made it 12 pt wider than the design on the device.

**Papers:** gold (default: streak, New best, Phone language, Premium) · accent (the game's win title, "The wall holds!") · pop (the Home tagline, tilt −2°) · ink (toy ink with **white** text: Locked, Test build). **Sizes:** regular 16; `sm` 14; `xs` 12.

**Slap in:** 420 ms boing from scale 1.7 and the tilt minus 14°, opacity 0 → rest; delays 700 ms (win title), 950 ms (New best), 0 (Premium active). Reduce motion: 120 ms fade.

**Premium badge:** the xs gold sticker with a `crown`, tilt −5°, under the game name on Home for Premium owners (`home.premium-badge`). The S12 "Premium active" sticker is the regular gold one with a crown, tilt −3°, slapped in on success.

**Today tag** (S9 week strip): 11 Bold toy ink on gold, padding 1 × 5, radius 5, 1 pt toy-ink edge (token 1.5, as rendered), tilt −4°, no ring (drawn inside `WeekStrip`).

**Accessibility:** a sticker is one text element: the paper carries the testID, `accessible`, `accessibilityRole="text"` and the text as its label, so VoiceOver reads it where it sits and Maestro measures the whole tilted sticker. **Do:** reserve stickers for news. **Don't:** tilt more than 8°; mirror the tilt in RTL (Chosen: the same angle in both directions); put a sticker on a raised key.

**Centring a sticker or a chip.** Both hug their text: each sets `alignSelf: 'flex-start'` on itself, and a child's `alignSelf` wins over its parent's `alignItems`. So a wrapper with `alignItems: 'center'` leaves the sticker or chip at the start edge (the S7 win sticker and mode chip sat at the start on the device while the design centres both). Centre one with a row wrapper: `{ flexDirection: 'row', justifyContent: 'center' }` around the component. The components take no alignment prop; the screen that places them decides.

## Chip (4.21)

**Template:** `chip.tsx` (`Chip`). A small flat label: padding 4 × 12, gap 6, radius 8, 2 pt `outline` edge (as rendered), `surface`, `chip` text (15 Bold). The chip View is one text element with the testID (the design measures the box, `.chip`), like the sticker. Level chip on results ("Level 12"), "Today" on S9, the version chip (S11b), the step counter (S13). Not interactive. Like the sticker it hugs its text (`alignSelf: 'flex-start'`), so a centred chip (the S7 mode chip) sits in a row wrapper with `justifyContent: 'center'`, never under a parent's `alignItems: 'center'` alone.

*Measurements* (`chip`): paddingBlock 4 · paddingInline 12 · gap 6 · radius 8 · border 2 (token 2.5).

## Art tile and Premium art (4.22)

**Templates:** `art-tile.tsx` (`ArtTile`: paints pop, gold, danger; sizes regular 64, dialog 56, summary 52), `premium-art.tsx` (`PremiumArt`).

**Art tile:** a 64 × 64 "boxed toy": radius 16, 3 pt toy-ink edge, `pop` fill (or gold), toy-ink 36 pt icon, 4 pt white ring, tilt −5°. Leads S2 (globe), S3 (gold shield) and dialogs (globe, gold restore; reset: 56 pt, `dangerFill` fill, `danger` icon). S11c uses a 52 pt gold shield. Decorative (hidden from VoiceOver).

*Measurements* (`art`): size 64 · radius 16 · border 3 · ring 4 · rotate -5 · icon 36.

**Premium art:** 108 × 108, radius 22, gold, 3 pt toy-ink edge, 5 pt white ring, tilt −6°, 64 pt toy-ink crown (S12).

*Measurements* (`premiumArt`): size 108 · radius 22 · border 3 · ring 5 · rotate -6 · icon 64.

## Confetti (4.34)

**Template:** `confetti.tsx` (`Confetti`, testID `premium.confetti`). Five 16 × 16 squares (radius 4, 2 pt toy-ink edge as rendered) in `accent`, `pop` and gold, scattered in a 70 pt band and tilted (18°, −12°, 30°, −24°, 8°). Chosen: they fall with the success sticker's slap timing. Decorative.

- **Reduce motion:** `isHiddenBySetting` (the player's saved Reduce motion setting, from `useReduceMotionSetting()`; the screen passes it) hides the confetti entirely (spec S12). `isReducedMotion` alone (the answer of `useReduceMotion()`, which a parity capture turns on to hold motion still) draws the pieces at rest, the first still frame, with no fall. When the screen passes no `isHiddenBySetting`, it defaults to `isReducedMotion`. Returning nothing whenever motion was reduced left the frozen success card without its confetti (an S12 structure difference).
- **Never mirrored:** the mockup places the pieces with `left:`, so the scatter is the same in every language. Physical keys are banned, so the band has `direction: 'ltr'`, where `start` is the left edge; with `start: x` alone the scatter mirrored in fa and ckb (S12 success dark-fa). `check-components` rule `confetti-ltr` fails a band without it; `tiles.test.tsx` pins both cases.

*Measurements* (`confetti`): size 16 · radius 4 · border 2 (token 2.5).

Reference crops: `assets/reference/light-list-rows.png`, `dark-list-rows.png`, `light-card-flat.png`, `light-stickers.png`.
