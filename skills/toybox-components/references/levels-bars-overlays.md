# Level tiles, stars, bars and overlays

Level tiles and stars, the three top bars and the banner band, and everything that floats over a screen: scrim, dialog, hold-to-confirm and toasts. Colour names as in keys-and-inputs.md.

## Contents

1. [Level tile (4.14)](#level-tile-414)
2. [Stars (4.15)](#stars-415)
3. [Top bar, brand lock, game top bar (4.16)](#top-bar-brand-lock-game-top-bar-416)
4. [Banner band (4.17)](#banner-band-417)
5. [Scrim, dialog and dialog button row (4.18)](#scrim-dialog-and-dialog-button-row-418)
6. [Hold-to-confirm (4.18)](#hold-to-confirm-418)
7. [Toast and toast stack (4.19)](#toast-and-toast-stack-419)

## Level tile (4.14)

**Template:** `level-tile.tsx` (`LevelTile`: `numberText`, `state`, `label`, `hint`, `onPress`, `width`, `isFocused`).

**Grid** (the screen's job): 6 columns, row gap 10, column gap 8, packs as sections; on the 350 pt body a tile is about 51.7 × 62. The screen computes `width` from its layout function.

**Tile anatomy:** at least 62 tall (`minHeight`, never a fixed `height`: at 200 % text the number and stars grow the tile instead of clipping; the grid stays 6 columns), radius 10, 2 pt (as rendered) `outline` edge, `surface`, elevation 3, content stacked and centred, gap 5: number (`levelNumber` 21 display, line height 1 in en and de, **1.45 in fa and ckb**) + mini stars (3 × 13 pt, gap 1).

**Persian and Sorani numerals.** At line height 1 iOS clips the tops of Vazirmatn's digits (۱۲ lost its top in every S8 fa capture; Chrome lets the glyphs overflow a 21 px line box, so the old references hid it). The token file and the design therefore give the level number 1.45 in Arabic script (`TYPE_STYLES.levelNumber = display(21, [1, 1.45])`, a 91/3 pt box at 3x instead of 21), and the re-rendered references draw it that way. The tile keeps its 62 pt height and centres its content, so in fa and ckb the number box is about 9 pt taller and the mini stars sit about 4.7 pt lower than in en; nothing else moves. The tile needs no change of its own: `AppText variant="levelNumber"` picks the Arabic ratio from the language, and `tiles.test.tsx` renders a fa tile and pins its number at 91/3 pt (3x) on the 62 pt face.

*Measurements* (`levelTile`): height 62 · radius 10 · border 2 (token 2.5, as rendered) · borderCurrent 3 · elevation 3 · gap 5 · miniStar 13 · miniStarGap 1 · lockIcon 16 · gridColumns 6 · rowGap 10 · columnGap 8 · flag.size 24 · flag.radius 7 · flag.border 2 · flag.ring 2.5 · flag.rotate 8 · flag.top -11 · flag.end -9 · flag.icon 12.

**States** (`state` is a union, so impossible combinations cannot be written):
- `{ kind: 'completed', stars: 1 | 2 | 3 }`: filled mini stars (`starOn`, `border` edge) then hollow ones (`starOff`).
- `{ kind: 'current' }` (the next level): `accent` fill, `onAccent` number and hollow stars, 3 pt edge, bobs (translateY 0 → −3 → 0, 1.6 s loop ease-in-out; no loop under reduce motion); a **flag** at the top-end corner: 24 × 24, radius 7, gold, 2 pt toy-ink edge, 2.5 pt white ring, tilt +8°, offset −11 top / −9 end, 12 pt `play` icon.
- `{ kind: 'locked' }`: `sunken` fill, dashed `inkSoft` edge, `inkSoft` number and a 16 pt `lock` instead of stars, no shadow, pushed in (`isPushedIn`: the tile sits 3 pt lower by layout, `top: 3` on its Pressable, never by a transform, so Maestro and the parity bounds measure the sunk tile). It stays pressable: tapping it shows the focus ring (`isFocused`: 3 pt `focus` outline, 2 pt gap) and the screen's toast "Unlock this one by finishing level n."
- Pressed (the transient press only): translateY 3, scale 1.04 × 0.94, shadow 0.

**Accessibility:** role `button`; `label` from the screen ("Level 9: 2 stars", "Level 13, locked"); locked tiles add a translated hint. **testID parts:** `levels.level-tile.<n>` with `.number`, `.stars-<k>`, `.flag`.

**Do:** keep the padlock and the dashed edge together (shape before colour). **Don't:** hatch locked tiles (cut from the design as too busy).

## Stars (4.15)

**Templates:** `rating-star.tsx` (`RatingStar`: one star from two stacked icon rasters, `rating-fill` + `rating-edge` / `rating-edge-mini`), `rating-stars.tsx` (`RatingStars`: 0–3 earned, sizes mini and rating), `result-stars.tsx` (`ResultStars`).

**Rating star:** filled = `starOn` fill + `border` edge 1.8; hollow = `starOff` edge 1.8 (`hollowColor` = `onPrimary` on the current level tile). Sizes: **13** on level tiles (edge 2.2), **18** in stickers, **22** in the S8 progress line and stat headers, **34** in rating rows (gap 6), **86 / 102 / 86** on the result screen (the middle star 24 higher, row 124 tall, gap 8, bottom-aligned).

*Measurements* (`star`): mini 13 · inline 22 · inSticker 18 · rating 34 · ratingGap 6 · result 86 · resultMiddle 102 · resultMiddleLift 24 · resultRowHeight 124 · resultGap 8.

**Result stars:** pop in one by one: 540 ms each, delays 250 / 400 / 550 ms, boing, keyframes scale 0 and −30° → 1.22 and 8° (55 %) → 0.94 and −2° (78 %) → 1 and 0°. Reduce motion: all shown at once with a 120 ms fade. The row is one image labelled "3 of 3 stars" (`result.stars-<count>`).

**Do:** keep filled vs hollow readable in greyscale. **Don't:** colour-code star counts.

## Top bar, brand lock, game top bar (4.16)

**Templates:** `top-bar.tsx` (`TopBar`), `brand-lock.tsx` (`BrandLock`), `game-top-bar.tsx` (`GameTopBar`).

**Top bar** (every second-level screen): min 66 tall, padding 4 / 16 / 8, gap 12, centred vertically: back icon button (48, flips in RTL, label "Back") · title (`topBarTitle` 27 display, flex 1, a header) · optional end action (one icon button, or a sticker such as the S15 "Test build" badge). Parts: `.back-button`, `.title` (`levels.top-bar.back-button`).

*Measurements* (`topBar`): minHeight 66 · gap 12 · back iconButton 48.

**Brand lock** (S4 Home top bar; passed as `TopBar start={...}`, which replaces back and title): logo tile 46 · column (gap 6, start-aligned): game name (`gameNameHome` 28, Lilita One in every language, +0.01 em, isolated LTR) and, for Premium owners, the xs Premium sticker (`badge`) · the settings icon button goes in `end`. Gap logo to column 12. ids: `home.brand-lock`, name `home.game-name`.

**Game top bar** (S5, behind S6): padding 4 / 14 / 8, gap 10: pause icon button 48 · column: mode line (`gameTopBarLevel` 16 Bold: "Level 12", "Daily", "Endless") and progress (`gameTopBarProgress` 13 `inkSoft`, the game's progress message) · score (`gameTopBarScore` 24 display) · undo and hint icon buttons (small, 44), each only when the game supports it. `testIDBase="game"` gives `game.top-bar`, `game.pause-button`, `game.mode-label`, `game.progress-label`, `game.score`, `game.undo-button`, `game.hint-button`.

**Do:** keep the title on one line where it fits and let it wrap at 200 % text. **Don't:** put more than one end action in a top bar.

## Banner band (4.17)

**Templates:** `use-banner-band-style.ts` (`useBannerBandStyle()`, the band's look) and `banner-band.tsx` (`BannerBand`, the same look as a frame). The live ad is never a child of `BannerBand`: a native banner must stay mounted to load, so the screens render the ads skill's `AdBannerSlot` and pass `loadedStyle={useBannerBandStyle()}`; the band then appears only once an ad has loaded.

**Anatomy:** a full-bleed band (the window's width), padding 6 block, `adBackground` fill with 2 pt dashed `adLine` rules on top and bottom; the ad view centred inside. The band itself never has a negative margin: where it sits decides that it is full bleed (a `marginInline: -20` inside the band made it 40 pt wider than the window and shifted it 20 pt against `home.banner-ad`).

*Measurements* (`bannerSlot`): paddingBlock 6 · borderDashed 2 (the box and chip values describe the mockup's stand-in only).

**Where the slot sits** (the design differs per screen, and the screen templates follow it):
- **Home (S4) and Statistics (S10):** pinned under the body, outside the scrolling content and its 20 pt gutters (the slot is a sibling after the body in the screen frame, which keeps the bottom inset under it). Full bleed by placement.
- **Levels (S8):** the last item of the body's column, inside the scrolling body. The design's `.body` closes with the banner: pushed to the bottom while the packs fit, one block gap after them when they do not. The screen wraps `AdBannerSlot` in a View with `{ marginTop: 'auto', marginInline: -20 }`: `marginTop: 'auto'` pushes it down, and the wrapper (not the band) cancels the body's 20 pt gutters once, so the slot is full bleed. The body runs under the home indicator there (`ScreenFrame edges={UNDER_HOME_INDICATOR_EDGES}`, `ScreenBody isUnderHomeIndicator`). A slot pinned outside the S8 body made `levels.grid` 100 pt shorter than the design.

**Rule:** the real slot holds an anchored adaptive banner (full width, height set by Google) and has **zero height until an ad loads**: `isVisible={false}` renders nothing, and the band collapses with the slot (Chosen). Only on Home, Levels and Statistics. ids: `home.banner-ad`, `levels.banner-ad`, `stats.banner-ad`. **Mock only:** the dashed 320 × 50 box, the "Ad" chip and the "320 × 50" label stand in for the creative; never build them. **Don't:** style the creative; put it over controls; give the band itself a negative margin.

## Scrim, dialog and dialog button row (4.18)

**Templates:** `scrim.tsx` (`Scrim`), `dialog-card.tsx` (`DialogCard`), `dialog-button-row.tsx` (`DialogButtonRow`).

**Scrim:** covers the whole screen in `scrim` (the only translucent paint: `rgba(29,27,58,.55)` light, `rgba(3,2,12,.7)` dark) and centres its child with padding 28 block × 20 inline, so the dialog is the body width (350 on the reference phone). id `<dialog>.scrim`.

**Dialog card:** 3 pt `outline` edge, radius 22, `surface`, padding 22 top / 20 inline / 20 bottom, **hard shadow 8** (static, `hardShadow`), gap 12. Contents in order: optional art tile (64; the reset dialog uses 56 with `dangerFill` / `danger`) · title (`dialogTitle` 25 display, a header) · body (17) · buttons. `accessibilityViewIsModal` keeps VoiceOver inside.

*Measurements* (`dialog`): radius 22 · border 3 · paddingTop 22 · paddingInline 20 · paddingBottom 20 · gap 12 · elevation 8 · buttonRowGap 12 · buttonRowMarginTop 6 · buttonMinBasis 120 · pausePaddingTop 20 · pausePaddingInline 18 · pausePaddingBottom 18.

**Pause dialog** (S6): `variant="pause"` (padding 20 / 18 / 18), `cardTestID="pause.dialog"`, no `title` prop (its header holds the title and the mode line), the Resume hero key, then block buttons.

**ids:** `testIDBase="restart-dialog"` gives `restart-dialog.card`, `.title`, `.body`; the caller passes `restart-dialog.art` to the ArtTile, `restart-dialog.buttons` to the DialogButtonRow and `restart-dialog.scrim` to the Scrim.

**Buttons:** either a `DialogButtonRow` (wrap row, gap 12, 6 pt extra top margin, each `Button isInRow`: flex 1 1 120 pt) in start → end order with the **safe choice at the start** (Cancel / Later, then the action), mirroring in RTL; or stacked block buttons (reset: the danger hold button, a caption, then Cancel).

**Do:** always offer a way out; keep the body to two or three lines. **Don't:** put a banner, a sticker or a second hero key in a dialog (the Pause dialog's Resume is its one hero key).

## Hold-to-confirm (4.18)

**Templates:** `use-hold-to-confirm.ts` (`useHoldToConfirm`, `HOLD_TO_CONFIRM_MS` 2000), `hold-button.tsx` (`HoldButton`).

A danger block button (S14 "Reset all progress", `reset-progress-dialog.confirm-button`) whose `dangerFill` layer grows from the **start edge** under the label while the finger is down: 2 s linear (Chosen; the mockup draws a static 46 % fill). Releasing early empties it in 150 ms. A short tap does nothing. The timer passes `reduceMotion: ReduceMotion.Never`: it is a safety timer, and a global Reduce motion setting would otherwise finish it instantly. VoiceOver users confirm with the `activate` accessibility action (double tap); the hint says "Hold for 2 seconds" (`dialog.reset-progress.hold-hint`, also shown as a caption under the key). Part `.fill`.

**Frozen fill (parity captures).** `useHoldToConfirm(onConfirm, frozenProgress?)` and `HoldButton`'s `frozenProgress?: number` (0 to 1, read at mount) hold the fill at that value: no timer runs, a press neither fills nor empties it, and it never confirms (the `activate` action still does). Only the parity capture of the reset dialog passes it: the Settings model opens the dialog in the frame state `reset-progress-dialog-held` with `frozenProgress` 0.46, so the key shows the design's static 46 % fill. Players never get a frozen key. `use-hold-to-confirm.test.ts` covers the 2 s hold, the early release, the frozen fill and the clamp to 0..1; `dialogs.test.tsx` shows `HoldButton` at `width: '46%'` after a press.

Known contrast gap: during the hold the 17 pt Bold danger label sits on `dangerFill` at 4.43:1 in light (needs 4.5); see decisions-and-open-issues.md. accessibility's `check-contrast.mjs` checks danger on `dangerFill` as an icon pair (3:1, which it passes) and body text on `dangerFill` at 4.5:1; the hold label's 4.43:1 stays an open owner decision that goes into every report, never an `--allow`.

## Toast and toast stack (4.19)

**Templates:** `toast.tsx` (`Toast`: `icon` or `'busy'`, `delayMs`), `toast-stack.tsx` (`ToastStack`).

**Anatomy:** an inverted chip: `toastBackground` fill, `toastText` text (`toast` 15, line height 1.35 / 1.55) and a 20 pt icon at the start (or the busy blocks), padding 12 × 14, radius 12, gap 10, **no outline and no shadow**. It spans the body width. It drops in: 380 ms boing after 500 ms, from translateY 22, scale 0.9, opacity 0 (reduce motion: 120 ms fade); until it lands it is transparent and VoiceOver skips it.

*Measurements* (`toast`): paddingBlock 12 · paddingInline 14 · radius 12 · gap 10 · icon 20 · stackGap 10.

**Position and life** (Chosen): above the banner band, 14 pt over the bottom of the body; it leaves after about 3 s (the screen owns the timer). S12 restore results stack toasts with gap 10 (`ToastStack`). The S8 locked-tile toast follows its design instead: absolute, 352 pt below the top of the scrolling body, over the last rows of the pack (the mockup's `.lv-toast{top:352px}`).

**Accessibility:** role `alert` with a polite live region, and the screen also announces the text (`AccessibilityInfo.announceForAccessibility` through the app's announce hook): iOS does not read live regions. ids: `levels.level-tile.locked-toast`, `premium.restoring-toast`, `premium.restore-success-toast`, `premium.restore-empty-toast`, `premium.restore-failed-toast`.

Reference crops: `assets/reference/light-level-tiles.png`, `dark-level-tiles.png`, `light-star-rating.png`, `light-top-bar.png`, `light-banner-slot.png`, `light-dialog.png`, `dark-dialog.png`, `light-toast.png`.
