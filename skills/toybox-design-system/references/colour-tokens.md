# Toybox colours: roles, game paints, Shell constants, dark theme, new games

## Contents

- Colour roles (paint -> ColorTokens field)
- Paint per game: Line Siege, Flock Tilt, Scrap Shove
- Shell constants (every game, per scheme)
- Printed parts: fixed toy ink and white
- Colour-blind variant
- Focus ring
- Dark theme rules ("toy chest at night")
- Painting a new game (the other 23 apps)
- Mock-only colours (never built)

The machine-readable source is `assets/toybox-tokens.json` (`color.games`, `color.shell`, `color.fixed`). Scripts read it; never retype a hex value by hand, generate the palette with `scripts/write-palette.mjs`.

## Colour roles

Six named paints per theme per game, plus the ink family.

| Paint | `ColorTokens` field | Role |
|---|---|---|
| `ground` | `background` | the painted wash behind every screen |
| `surface` | `surface` | panels, lists, keys, buttons, tiles, dialogs |
| `sunken` | `sunken` | pushed-in, disabled and empty fills: toggle and slider tracks, progress track, locked tiles and packs, disabled buttons, pressed quiet button, board placeholder |
| `ink` | `text`, `icon` | body text, icons |
| `inkSoft` | `textMuted`, `starOff` | muted text, chevrons, values, hollow stars, disabled text and dashed edges |
| `outline` | `border` | every control and panel edge (in light = ink) |
| `shadow` | `shadow` | the hard shadow (in light = ink) |
| `accent` | `primary` | "go" fills |
| `onAccent` | `onPrimary` | text and icons on accent |
| `pop` | `pop` | icon tiles, group tabs, Premium key, Continue-with-ad, tagline sticker |
| `onPop` | `onPop` | text and icons on pop |
| (Shell) `danger` | `danger` | destructive text, icons, edges |
| (Shell) `focus` | `focus` | focus ring |
| (Shell) `star` | `starOn` | filled stars |

`sunken`, `pop`, `onPop`, `shadow` and `focus` are the five fields Toybox adds to the original eleven. `danger`, `focus` and `starOn` are Shell constants copied into every palette so contrast tests see them.

## Paint per game

Light is "one ink": `ink`, `outline`, `shadow`, `onAccent` and `onPop` are toy ink `#1D1B3A` in every game, and `inkSoft` is Pencil `#43406A`. In dark each game tints its whole ink family to its ground (**Chosen:** the palette data wins over the design plan's "other games swap only ground, accent and pop").

### Line Siege

| Paint | Field | Light | Dark |
|---|---|---|---|
| ground | background | `#A5DAF3` Sky wash | `#1B1943` Toy chest |
| surface | surface | `#F8FBFF` Chalk | `#2B2862` Lid |
| sunken | sunken | `#D3ECF8` | `#221F52` |
| ink | text, icon | `#1D1B3A` Toy ink | `#F4F2FF` Moonlight |
| inkSoft | textMuted, starOff | `#43406A` Pencil | `#B9B4EA` Dusk |
| outline | border | `#1D1B3A` | `#E4E0FF` |
| shadow | shadow | `#1D1B3A` | `#07061A` |
| accent | primary | `#FF6B4A` Brick tomato | `#FF7D5E` Ember |
| onAccent | onPrimary | `#1D1B3A` | `#1B1943` |
| pop | pop | `#FFD23F` Sunshine | `#FFD84D` Lantern |
| onPop | onPop | `#1D1B3A` | `#1B1943` |

### Flock Tilt

| Paint | Field | Light | Dark |
|---|---|---|---|
| ground | background | `#AEE8C6` Meadow wash | `#112A48` Night field |
| surface | surface | `#F7FCF9` Fleece | `#1C3C62` Barn roof |
| sunken | sunken | `#D2F1DF` | `#15325A` |
| ink | text, icon | `#1D1B3A` Toy ink | `#F2F7FF` Moonlight |
| inkSoft | textMuted, starOff | `#43406A` Pencil | `#AFC6E6` Mist |
| outline | border | `#1D1B3A` | `#DCEBFF` |
| shadow | shadow | `#1D1B3A` | `#050E1C` |
| accent | primary | `#3DBE66` Clover | `#52D67F` Glow clover |
| onAccent | onPrimary | `#1D1B3A` | `#112A48` |
| pop | pop | `#7CC8FF` Pond | `#86CFFF` Moon pond |
| onPop | onPop | `#1D1B3A` | `#112A48` |

### Scrap Shove

| Paint | Field | Light | Dark |
|---|---|---|---|
| ground | background | `#F7DF7E` Hazard lemon | `#261C45` Scrapyard night |
| surface | surface | `#FFFEF8` Enamel | `#372A63` Tin |
| sunken | sunken | `#F9EBB2` | `#2E2356` |
| ink | text, icon | `#1D1B3A` Toy ink | `#F7F2FF` Moonlight |
| inkSoft | textMuted, starOff | `#43406A` Pencil | `#C4B6EC` Smoke |
| outline | border | `#1D1B3A` | `#EDE4FF` |
| shadow | shadow | `#1D1B3A` | `#0B0718` |
| accent | primary | `#1FB5A9` Robot teal | `#36D1C4` Neon teal |
| onAccent | onPrimary | `#1D1B3A` | `#261C45` |
| pop | pop | `#FF8A3D` Rust | `#FF9A55` Hot rust |
| onPop | onPop | `#1D1B3A` | `#261C45` |

## Shell constants

They never change with the game and live in `SHELL_COLORS[scheme]` (`packages/shell/src/theme/shell-colors.ts`); read them in `makeStyles` with `const shell = SHELL_COLORS[theme.scheme];`.

| Token (file field) | Light | Dark | Used for |
|---|---|---|---|
| `success` | `#17804A` | `#7EE3A6` | check marks in the score panel, "done" confirmations |
| `warning` | `#8A5A00` | `#FFC95C` | reserved (no screen uses it yet) |
| `danger` (in ColorTokens) | `#C4243A` | `#FF8593` | destructive text, outline and icons |
| `dangerFill` | `#FFD9DD` | `#4A1F3A` | tint behind destructive icons, the hold-to-confirm fill, the Premium error panel |
| `focus` (in ColorTokens) | `#C8157A` | `#FF8AD8` | focus ring and the tapped-locked-tile highlight |
| `star` = `starOn` (in ColorTokens) | `#FFC928` | `#FFD23F` | filled stars (dark differs from gold) |
| `gold` | `#FFC928` | `#FFC928` | sticker paper, flags, the "Today" tag, gold icon tiles, Premium art, confetti |
| `cut` | `#FFFFFF` | `#FFFFFF` | the die-cut ring around stickers, flags, art tiles and cut logos |
| `toastBg` (`toastBackground`) | `#1D1B3A` | `#F4F2FF` | toast background (inverted ink chip) |
| `toastInk` (`toastText`) | `#F8FBFF` | `#1B1943` | toast text and icon |
| `scrim` | `rgba(29,27,58,.55)` | `rgba(3,2,12,.7)` | dims the screen under dialogs, the pause dialog and sheets |
| `line` | `rgba(29,27,58,.14)` | `rgba(228,224,255,.16)` | row separators, score-panel rule, stat-list rules |
| `adBg` (`adBackground`) | `#E6E9ED` | `#2A2C38` | banner slot band and ad-chip text |
| `adLine` | `#8D949E` | `#6B7080` | dashed banner borders |
| `adInk` (`adText`) | `#474C55` | `#C3C6D6` | banner placeholder text and the "Ad" chip |

`line` and `scrim` keep the mockup's `rgba()` strings (React Native accepts them). Their `#RRGGBBAA` twins (**Derived**) are `#1D1B3A8C` / `#03020CB3` (scrim) and `#1D1B3A24` / `#E4E0FF29` (line). `line` over Line Siege's surface composites to about `#D9DCE3` (light) and `#49457B` (dark).

## Printed parts

Toy ink `#1D1B3A` and white `#FFFFFF` stay fixed in both schemes for everything "printed": sticker edges and text (white text on the ink sticker), the level-tile flag, the week "Today" tag, art tiles and Premium art, gold icon tiles, logo line art, confetti edges and the S15 hazard stripes. In code: `shell.toyInk` and `shell.cut`.

## Colour-blind variant

The colour-blind palette is **identical** to the standard one for the Shell, in every game and scheme. This is allowed because rule 10 gives every state a shape cue, so no Shell meaning depends on hue. The `Palette` type still requires both modes, so each app writes `colorBlind: { light: LIGHT, dark: DARK }` with the same objects. The colour-blind switch keeps its full effect on the **boards**, whose piece colours come from each game's own board palette.

## Focus ring

`focus` = `#C8157A` (light) / `#FF8AD8` (dark) in every game: at least 3.6:1 against every ground and 4.4:1 against sunken. Geometry: a 3 pt solid ring drawn 2 pt outside the control's border, following its radius (`focusRing()` in `toybox-styles.ts`). It shows on (1) the locked level tile the player just tapped while its toast is up, and (2) any control with keyboard or Switch Control focus on iPad (**Chosen**).

## Dark theme rules

1. The ground becomes a deep night colour of the game's hue, surfaces are one step lighter, `sunken` sits between them.
2. The ink family inverts and tints: text becomes moonlight, outlines a pale chalk line of the game's hue, `inkSoft` a light dusk. The outline stays at least 9.2:1 against surface.
3. Shadows go near-black (`#07061A`, `#050E1C`, `#0B0718`); they are subtle against the ground (1.2 to 1.3:1) and read from the chalk outline and the offset. Keep them: pressing still visibly sinks the key.
4. Accent and pop brighten, and text on them turns dark: `onAccent` and `onPop` = the game's dark ground.
5. Printed parts do not change: stickers keep gold / accent / pop paper with toy-ink edges and text; the white ring frames them on the dark ground.
6. Semantic colours lighten (success `#7EE3A6`, warning `#FFC95C`, danger `#FF8593`, dangerFill `#4A1F3A`, focus `#FF8AD8`, filled star `#FFD23F`; stickers keep gold `#FFC928`).
7. The toast inverts again: a pale `#F4F2FF` chip with `#1B1943` text, in every game.
8. The scrim deepens to `rgba(3,2,12,.7)`; separators use `rgba(228,224,255,.16)` in every game (**Chosen**); the ad band uses dark neutrals.
9. The theme follows the S11 setting (System / Light / Dark); `ThemeProvider` resolves it and mirrors it into `Appearance.setColorScheme`.

## Painting a new game

Only three games have Toybox paints in the token file. For any other game, design the paints yourself, keep every shape rule, and let the script judge:

1. Pick the game's hue family from its toy (sky, meadow, lemon...). Give each paint a toy-ish name (Sky wash, Brick tomato...).
2. **Light:** `ground` is a pastel wash of the hue (relative luminance about 0.45 or more, or muted text fails); `surface` is near-white tinted with the hue (like `#F8FBFF`); `sunken` sits halfway between ground and surface; `accent` is a saturated mid tone for "go" and `pop` a second, contrasting paint (both need toy ink on them at 4.5:1, so luminance about 0.24 or more). The ink family is fixed (toy ink, pencil).
3. **Dark:** `ground` a deep night of the hue, `surface` one step lighter, `sunken` between; `ink` a moonlight near-white tinted to the hue; `inkSoft` a light dusk (4.5:1 on surface); `outline` a pale chalk line (3:1 on ground and surface); `shadow` near-black of the hue; `accent` and `pop` the light ones brightened. `onAccent` and `onPop` become the dark ground automatically.
4. Write the paint file (shape in `examples/new-game-paint.json`) and run `node ${CLAUDE_SKILL_DIR}/scripts/write-palette.mjs --game <id> --paint <file> --dry-run` until it prints `RESULT: PASS`, then run it without `--dry-run`.
5. A new paint is a design decision: include a light and a dark screenshot of Home in the report to the owner.

## Mock-only colours

Never build these: the S3 consent placeholder (`sheet #FFFFFF / #202124`, `line #9AA1AB / #80868B`, `ink #3D434C / #E8EAED`, `stripe #EEF0F3 / #2A2B2F`; Google draws the real form) and the how-to-play mock art (monster `#7B5CFF`, rock `#9AA3B5`; each game owns its pictures).
