# Toybox layout and shape tokens: spacing, radii, strokes, elevation, press

## Contents

- Spacing scale and layout steps
- The screen frame
- Radii (scale and every component radius)
- Strokes (outlines, dashed states, icon strokes)
- Elevation and hard shadows
- Press offsets per control
- How these reach code
- Logo tile

## Spacing

- **Scale** (`SPACING`): `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32`.
- **Layout steps off the scale** (`LAYOUT`, **Chosen** as named constants): screen gutter **20**, gap between blocks **14**, body padding top 6 and bottom 34, top bar inline padding 16, game top bar inline padding 14, panel padding 14 block / 16 inline, settings group gap 20, long-page gap 18 (Privacy, Licences), statistics gap 16.
- **Inside panels:** padding 14 block / 16 inline; small stat panels 12 / 14; row padding 10 / 14; gaps 12 inside rows and panels, 6 to 10 between a label and its value.

## The screen frame

The mockup phone is 390 x 844 pt with a 54 pt status bar and a 34 pt home-indicator zone (on other phones use the real safe-area insets).

- The ground fills the whole screen, behind the status bar too.
- **Top bar:** min height 66, padding 4 top / 16 inline / 8 bottom, gap 12.
- **Body:** padding 6 top / 20 inline / 34 bottom, vertical gap 14 (Settings 20, Privacy and Licences 18, Statistics 16).
- **Overlays (dialogs):** padding 28 block / 20 inline; the dialog is the body width (350 on the reference phone).
- **Long screens** (S10, S11, S11c, S11d, S15) scroll; the top bar stays fixed and only the body scrolls (**Chosen**); the banner stays pinned below the scroll.
- **Tablets and wide windows:** the column is centred and at most 640 pt wide (`CONTENT_MAX_WIDTH`).

## Radii

Scale (`RADII`): **xs 6 · sm 10 · md 14 · lg 22**. Components use these exact radii:

button 14 · panel 14 · list 14 · optionCard 14 · offer 14 · dialog 22 · sheetTop 26 · premiumArt 22 · iconButton 12 · iconButtonSmall 11 · heroCap 11 · calendar 12 · toast 12 · art 16 · howToStage 16 · boardPlaceholder 18 · levelTile 10 · iconTile 10 · segment 10 · toggleTrack 10 · toggleKey 10 · weekMark 10 · radio 9 · sliderThumb 9 · groupTabTop 9 · sticker 8 · chip 8 · flag 7 · toggleKnob 7 · weekMarkXs 6 · progressBar 6 · sliderTrack 5 · barTop 5 · weekTag 5 · adBox 4 · confetti 4 · splashBlock 4 · pagerDot 3 · grabber 3 · adChip 3 · busyBlock 2 · logo 0.24 x tile size.

**Chosen:** stickers and chips use **8** as drawn (the mockup's token card says 6, but nothing is drawn at 6). Never a pill, never a circle for a control: the largest control radius is 14.

## Strokes

- **Scale** (`STROKE`, as rendered): **hair 2** (row separators, score-panel rule, stat-list rules, banner dashes, flag edge, small week marks), **tile 2** (token 2.5; level tiles, segments, stickers, chips, icon tiles, toggle knob, slider track, progress bar, group tab, week marks, pause keys, chart bars, pager dots, confetti), **bold 3** (buttons, icon buttons, panels, lists, option cards, radio, toggle track, dialog, calendar, art tiles, logo tiles, hero cap, slider thumb, board placeholder, offer box, how-to stage).
- **Others:** splash logo 4; week "Today" tag 1 (token 1.5); chart baseline 3; slider and progress fill end edge 2 (token 2.5).
- **Why "as rendered":** the committed Toybox references are Chrome renders at deviceScaleFactor 3, and Chrome floors a CSS border of 1 px or more to whole CSS px (2.5 -> 2, 1.5 -> 1). Every `.layout.json` style says `2px solid` and the parity gates measure 2.0 pt, so an app drawing 2.5 fails `[border]` on every tab and segment and `[structure]` on every icon tile. The references are the visual truth: every value the mockup draws as a CSS border uses `asRenderedBorder(w) = w >= 1 ? floor(w) : w`. `tokens.ts` holds `STROKE` that way and `check-design-system` derives its expectation the same way; the component specs apply the same rule (the components skill). The token file itself is never edited.
- **Not borders, so token values stay:** icon and SVG strokes (below), box-shadow rings (the sticker's 3.5 die-cut ring, the flag's 2.5, art and logo rings) and Skia strokes on boards.
- **Dashed** (`borderStyle: 'dashed'`): locked tile and locked pack (2 as rendered, token 2.5 / 3 in `textMuted`), disabled button (3 in `textMuted`), missed and today week marks, the Continue offer box (3 in `border`), banner slot (2 in `adLine`).
- **Icon strokes** on the 24 grid: 2.5 regular, 3.1 bold (check, close, chevron, dash), 3.6 heavy (gear teeth), 1.4 rounded edge on filled shapes; star rating edges 1.8 (2.2 on 13 pt mini stars). They scale with the icon size.

Outline in code = `borderWidth` from `STROKE` + `borderColor: theme.colors.border` (danger: `theme.colors.danger`; printed parts: `shell.toyInk`).

## Elevation and hard shadows

Shadow = CSS `box-shadow: 0 <e>px 0 <shadow>`: straight down by the elevation *e*, blur 0, spread 0, colour `shadow`. Scale (`ELEVATION`):

| Name | pt | Used by |
|---|---|---|
| `flat` | 0 | panels, lists, rows, chips, toasts, stickers, quiet buttons |
| `knob` | 2 | toggle knob |
| `tile` | 3 | level tiles, segments, slider thumb, pause toggle keys |
| `iconButton` | 4 | icon buttons (48 and 44) |
| `control` | 5 | buttons, row buttons, home keys, option cards |
| `hero` | 6 | the hero key |
| `dialog` | 8 | dialogs (static) |

**Chosen:** 2 and 4 come from the mockup CSS (toggle knob, icon button); its elevation card lists only 0 / 3 / 5 / 6 / 8.

## Press offsets

| Control | Pressed transform | Shadow | Reduce motion |
|---|---|---|---|
| Buttons, hero key, row buttons, keys | translateY(*e*) scale(1.03, 0.94) | to 0 | translateY(*e*) only |
| Icon button | translateY(4) scale(1.05, 0.93) | to 0 | translateY(4) only |
| Level tile | translateY(3) scale(1.04, 0.94) | to 0 | translateY(3) only |
| Quiet button | scale(0.97), background `sunken` | none | no scale |
| Selected segment / option card / "on" pause key | moved down *e* by layout (`top: e`), static | none | same |
| Disabled button | moved down *e* by layout, `sunken` fill, `textMuted` text, dashed `textMuted` edge | none | same |
| Busy button | moved down *e* by layout, label kept, hop blocks | none | static blocks |
| Locked level tile | moved down 3 by layout, dashed, `sunken` | none | same |

Transforms scale around the control's centre; the shadow travels with the control and ends exactly under it at full press. `PRESS_SQUASH` in `motion.ts` holds the three squash pairs.

**A key that stays pushed in moves by layout, not by a transform.** VoiceOver and Maestro report the layout frame and ignore transforms, while the references measure the sunk position (the chosen "Automatic" segment sits 3 pt lower than its neighbours). So `RaisedSurface` gives a held-down key (`isPushedIn`, disabled, busy) `top: elevation` on its Pressable; the `translateY` transform is only the transient press (sink, squash, spring back). A transform-sunk segment measured 3 pt high in parity.

## How these reach code

`packages/shell/src/theme/tokens.ts` holds `SPACING`, `LAYOUT`, `RADII`, `STROKE` (as rendered), `ELEVATION`, `MIN_TOUCH` (44) and `CONTENT_MAX_WIDTH` (640). Component-specific numbers (every measurement of every component) live in the components' own constants, owned by the `toybox-components` skill. `check-design-system` compares `tokens.ts` with the token file value by value, with `STROKE` floored as rendered.

## Logo tile

The game logo tile (`ui/logo-tile.tsx`, drawn by the art and icons work) keeps its sizes as a typed-in table, `LOGO_TILE_VARIANTS`; `check-design-system` (rule `logo-tile-mismatch`) compares every value with the token file's `components.logoTile`:

| Variant | Size | Edge | Ring (white die-cut) | Tilt | Drop | Cut edge |
|---|---|---|---|---|---|---|
| `home` | 46 | 3 (`STROKE.bold`) | 0 | -4 deg | 0 | no |
| `statsHeader` | 36 | 3 | 0 | -4 deg | 0 | no |
| `about` | 92 | 3 | 5 | -4 deg | 0 | yes (toy-ink edge) |
| `lose` | 104 | 3 | 6 | 17 deg | 6 | no |
| `splash` | 152 | 4 | 7 | -6 deg | 0 | no |

Base values: edge 3, tilt -4 deg, corner radius 0.24 x the tile size, art 0.88 of the inner box. A variant's own entry overrides the base (`splash.border` 4, `about.border: "toyInk"` = the cut edge). The tile hides itself from VoiceOver (decorative), so the parity map compares it by crop only.

