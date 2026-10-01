# Styling and mirroring

What mirrors in Persian and Sorani, what must not, and how to write styles so React Native does the mirroring for you. Includes the Toybox design system's RTL rules, because every screen must match its RTL design screenshot.

## Contents

- Logical style keys
- Rows, grids and order
- Text alignment and writing direction
- Safe areas are physical
- Icons: which flip
- Toybox RTL rules
- Game boards stay physical
- The level grid

## Logical style keys

Physical left/right keys never appear in a style (`StyleSheet.create`, any `style`/`*Style` prop, `*Style`-typed variables). Game rules may still use `left`/`right` as **data** (a swipe left moves pieces left in every language).

| Instead of | Write |
|---|---|
| `marginLeft` / `marginRight` | `marginStart` / `marginEnd` (or `marginInline` when equal) |
| `paddingLeft` / `paddingRight` | `paddingStart` / `paddingEnd` (or `paddingInline`) |
| `left` / `right` (absolute position) | `start` / `end` |
| `borderLeftWidth`, `borderRightColor` … | `borderStartWidth`, `borderEndColor` … |
| `borderTopLeftRadius` … | `borderTopStartRadius`, `borderTopEndRadius`, `borderBottomStartRadius`, `borderBottomEndRadius` |
| `textAlign: 'left' / 'right'` | `AppText align="start" / "end"` |
| `flexDirection: 'row-reverse'` | `flexDirection: 'row'` (it already mirrors) |
| `transform: [{ scaleX: -1 }]` on content | nothing: only directional icons flip (inside `Icon`) |

The project's ESLint config enforces the same (style-scoped physical keys, `textAlignLiteral`, `rowReverse`); `check-rtl.mjs` proves it without ESLint.

## Rows, grids and order

- `flexDirection: 'row'` follows the layout direction: the first child sits at the start edge (left in LTR, right in RTL). Build every row that way; never reverse arrays or styles "for RTL".
- `flexWrap: 'wrap'` grids fill from the start edge: level 1 is top-left in LTR and top-right in RTL (verified for ScrollView, FlatList and FlashList).
- The 7-day strip, bar charts and progress bars mirror through `row` and `start`/`end`, not through transforms (Monday on the right in fa/ckb).
- Never read `I18nManager.isRTL` in components: use `useDirection()` (the one direction source).

## Text alignment and writing direction

Every text renders through `AppText` (or `<T>`, which renders it). `AppText` takes its style from `useLocalizedTextStyle()`, which always sets:

- `writingDirection` = the layout direction from `useDirection()` (the value of `DirectionProvider`; `direction-context.tsx` exports only `DirectionProvider`, `DirectionProviderProps` and `useDirection`, never the context object);
- `textAlign` explicitly, through `TEXT_ALIGN = { start: 'left', center: 'center', end: 'right' }`;
- the script font and line height for the language of the text (`scriptFontFor`).

Why explicit: React Native swaps `'left'`/`'right'` when the layout is RTL (`doLeftAndRightSwapInRTL`), so `'left'` means start. The default `'auto'` stays **physically left** for an in-app RTL choice on an LTR-language phone. Verified (iOS 26.5, forced RTL on an English phone): `'left'` rendered on the right, `'right'` on the left, `'auto'` stayed left, and `writingDirection: 'rtl'` produced a correct RTL paragraph.

`Text` from `react-native` is imported only in `packages/shell/src/ui/app-text.tsx`. Text in another language than the UI (the autonyms in the language list) passes `language={code}`, which picks that script's font and sets `accessibilityLanguage`.

## Safe areas are physical

Take safe areas from `ScreenFrame` (react-native-safe-area-context `SafeAreaView` with physical `edges`: `top`, `bottom`, `left`, `right`). Never convert raw insets into `marginStart`/`End` by hand: the notch and the home indicator do not mirror. The status bar and system chrome are not mirrored by the app either.

## Icons: which flip

Only icons that point along the reading direction flip, and `Icon` does it through `DIRECTIONAL_ICONS` (`packages/shell/src/ui/icons/icon-paths.ts`) with `transform: [{ scaleX: -1 }]` when `useDirection()` is `'rtl'`, so no call site can forget it.

| Flips in RTL | Never flips |
|---|---|
| `back` (top-bar back), `chevron` (row chevrons), `forward` ("Next" / "Continue" arrows), `undo` | `play`, `pause`, clocks (`clock`), `restore`, stars, `lock`, logos, pictures, the gear and every object icon |

`DIRECTIONAL_ICONS` is exactly the members of `{back, chevron, forward, undo}` that exist in `ICON_PATHS` (an earlier design listed only `back`; the Toybox icon set adds the other three, so code written before it may still flip too little). `check-rtl.mjs` fails on an extra or a missing entry.

## Toybox RTL rules

1. **Layout mirrors, shadows do not.** Hard shadows point straight down in both directions; scale transforms are symmetric.
2. **Mirrored icons:** only `back`, `chevron`, `forward`, `undo`. "Next"/"Continue" arrows stay at the end, pointing towards the reading direction.
3. **Things that fill from the start edge run right to left in RTL:** slider and progress fills, the hold-to-confirm fill, the toggle knob's "on" position (the end, which is the left), the week strip and the bar chart (Monday on the right).
4. **Things at the start or end follow:** the hero-key cap (start), the level-tile flag (top-end corner: top-left in RTL), the group tab (flush at the start), the ad chip (top-start), the "New best" sticker (end of the score row), dialog buttons (safe choice at the start: on the right in RTL).
5. **Confetti does not mirror:** the S12 success confetti scatters its pieces from the physical left in every language (the mockup places them with `left:`). Physical keys are banned, so `confetti.tsx` gives its band `direction: 'ltr'`, where `start` is the left edge; without it the scatter mirrored in fa and ckb (`toybox-components`' `confetti-ltr` rule).
6. **Sticker tilt does not mirror:** a −4° sticker is −4° in both directions. **Sticker padding does not mirror either:** the mockup pads physically (`padding: 5px 11px 5px 9px`: 9 on the left, 11 on the right), so in RTL the larger pad sits on the right, next to the icon. Physical keys stay banned, so `sticker.tsx` reads `useDirection()` and swaps its logical pads in RTL (`paddingStart: 11, paddingEnd: 9`), which React Native mirrors back to left 9 / right 11. This is the one sanctioned direction branch in a component; it keeps the rule-1 check green.
7. **Fonts:** every display role becomes Vazirmatn Bold; every text role Vazirmatn Regular or Bold; letter-spacing is always 0 in Arabic script. Game names stay in the Latin display face, isolated LTR. (Line heights: see the digits, bidi and fonts reference.)
8. **Digits:** Persian digits (`۰–۹`) in fa/ckb for numbers set in Vazirmatn, including level numbers, scores, the calendar day and chart values; the Numbers setting can switch them. The debug menu's force-locale value stays LTR.
9. **Status bar and system chrome** are not mirrored by the app.

Only the splash content, the result chip/stars/title/sub-sticker/lose picture, the Pause "Home" link, the quiet nudges under a hero key and the S3 Google sheet placeholder are centred; everything else starts at the start edge.

## Game boards stay physical

- The Shell wraps the board area in `BoardDirectionView` (`templates/shell-game-host/`): `direction: 'ltr'` unless the game module declares `isMirroredInRtl: true` (default: no). Verified: a `direction: 'ltr'` view kept `1 2 3` left to right and an absolute `left: 0` marker on the left while the UI around it mirrored.
- Skia draws in physical coordinates, so `direction` only affects React Native views inside the board (trays, overlays). A game that opts in to mirroring mirrors in its `BoardLayout` mapping (x -> width − x), used by both `draw` and `hitTest`; never with `scaleX: -1`.
- Gestures are physical: a swipe left moves things left, in every language.
- Numbers on boards are formatted in JS with `createNumberFormatter(localeTagFor(language, digits))` and passed to the draw function as strings.
- Arabic-script text on a board goes through a Skia `Paragraph` with `TextDirection.RTL` and the Vazirmatn typeface registered from the bundled TTF; `drawText` is only for Latin strings and lone digits. Board goldens register the same font files.
- The board's accessibility element (one `image` with a translated summary) sits inside the wrapper.

## The level grid

One `ScrollView`, packs as sections, tiles in a `flexDirection: 'row'` + `flexWrap: 'wrap'` container: level 1 at the top right in fa/ckb. Tile numbers use the chosen digits (formatted in the screen hook), and the tile's flag sits at the top-end corner.
