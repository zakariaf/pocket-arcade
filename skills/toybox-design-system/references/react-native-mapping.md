# Toybox in React Native: the theme module, press squash, hard shadows

## Contents

- File map (what lives where)
- ColorTokens, palettes and Shell constants
- makeStyles recipes
- Static hard shadows, die-cut rings, focus rings
- RaisedSurface: the only press implementation
- Outlines, dashed states and the group tab
- RTL rules specific to Toybox
- What is verified and what is not

## File map

| File (app repo) | What it holds | Template |
|---|---|---|
| `packages/shell/src/theme/theme-types.ts` | `ColorTokens` (16 fields), `Palette`, `Theme` | yes |
| `packages/shell/src/theme/tokens.ts` | `SPACING`, `LAYOUT`, `RADII`, `STROKE` (as rendered: tile 2), `ELEVATION`, `MIN_TOUCH`, `CONTENT_MAX_WIDTH`, `TYPE_SCALE` | yes |
| `packages/shell/src/theme/type-styles.ts` | `TYPE_STYLES` (with the `rowLabelStrong` override), `TypeVariant`, `typeStyleOf()`, `snapToGrid()`, `lineHeightOf()` | yes |
| `packages/shell/src/theme/shell-colors.ts` | `SHELL_COLORS[scheme]` | yes |
| `packages/shell/src/theme/motion.ts` | `EASING`, `MOTION_MS`, `RELEASE_SPRING`, `PRESS_SQUASH`, `KEYFRAMES` | yes |
| `packages/shell/src/theme/theme-set.ts`, `theme-context.ts`, `use-theme.ts`, `make-styles.ts`, `theme-provider.tsx`, `contrast.ts` | the four themes built once, context, hook, style factory, provider, WCAG maths | yes |
| `packages/shell/src/i18n/fonts.ts` | `FONT_FAMILIES`, `scriptFontFor(language, weight, face)` (synced from the library; the RTL skill ships the same file) | yes |
| `packages/shell/src/i18n/use-localized-text-style.ts` | family, size, pixel-snapped line height (`snapToPixels`), tracking, direction, alignment (synced from the library; the RTL skill ships the same file) | yes |
| `packages/shell/src/ui/app-text.tsx` | the only text component | yes |
| `packages/shell/src/ui/raised-surface.tsx` | the pressable key (shadow, sink, squash) | yes |
| `packages/shell/src/ui/toybox-styles.ts` | `hardShadow()`, `dieCutRing()`, `focusRing()` | yes |
| `packages/shell/src/testing/test-palette.ts` | the fixture palette for component tests (not a Toybox paint) | yes |
| `packages/shell/src/testing/toybox-palette-checks.ts` | `checkToyboxPalette()` | yes |
| `apps/<game>/src/theme/palette.ts` | the game's `PALETTE` | `write-palette.mjs` |
| `apps/<game>/assets/fonts/` | the five TTFs and three OFL texts | `assets/fonts/` |
| `test/integration/toybox-palettes.test.ts` | one `it` per app: `checkToyboxPalette(PALETTE)` is `[]` | yes |

`theme-provider.tsx` reads the settings store (`selectThemePreference`, `settings.colorBlind`); those belong to the stores. Apps may import `@e07/shell/theme/theme-types.ts` (it is game-facing), so `palette.ts` compiles inside the app zone.

## ColorTokens, palettes and Shell constants

- Each game writes one `Palette`: standard and colour-blind, light and dark, with colour-blind = the same objects. The app passes it to `createThemeSet(PALETTE)` once at startup (four themes with stable identities).
- Every colour in a style comes from `theme.colors.<token>` or `SHELL_COLORS[theme.scheme].<name>`. Colour literals in styles are a lint error (`react-native/no-color-literals`) and a `check-design-system` failure (`no-color-literal`).
- Fonts are not in the theme: `AppText` picks them from the language of the text.

## makeStyles recipes

```ts
const useStyles = makeStyles((theme) => {
  const shell = SHELL_COLORS[theme.scheme];
  const styles = StyleSheet.create({
    // Flat information panel: ink edge, no shadow.
    panel: {
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
      paddingBlock: LAYOUT.panelPaddingBlock,
      paddingInline: LAYOUT.panelPaddingInline,
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
      borderRadius: COMPONENT_SPECS.sticker.radius, // 8: component measurements, toybox-components
      backgroundColor: shell.gold,
      transform: [{ rotate: '-4deg' }],
      ...dieCutRing(COMPONENT_SPECS.sticker.ring, shell.cut),
    },
    // Locked level tile: dashed, sunken, pushed in, no shadow; focus ring when tapped.
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

Rules the factory relies on: the factory body is `const styles = StyleSheet.create({...}); return styles;` (keeps type checks, the start/end lint and `no-unused-styles` working); the component writes `const styles = useStyles();`; styles are cached per `Theme` object, so a theme switch costs one build per theme. Component measurements come from the component constants (the `toybox-components` skill); the recipe above uses tokens only.

## Static hard shadows, die-cut rings, focus rings

React Native 0.86 (New Architecture) has CSS-like `boxShadow` and `outline*` style props. iOS draws `boxShadow` with a shadow path whose radius is half the blur, so blur 0 is crisp. Toybox uses them only for parts that never move:

- `hardShadow(offset, color)`: `box-shadow: 0 <offset>px 0 <color>` (the dialog's 8 pt shadow).
- `dieCutRing(width, color)`: `box-shadow: 0 0 0 <width>px <color>` (sticker 3.5, flag 2.5, art tile 4, Premium art 5, cut logos 5 to 7). A box-shadow ring is not a border: Chrome does not floor it, so rings keep their token values.
- `focusRing(color)`: `outline: 3px solid; outline-offset: 2px`, following the border radius.

Never use iOS `shadowRadius` / `shadowOpacity` / `shadowOffset` or Android `elevation`: they blur (`no-blur-shadow`).

## RaisedSurface

The only press implementation. The key is an animated wrapper holding two children: the **shadow** (same box, `shadow` colour) and the **face**. Pressing moves the wrapper down by the elevation and squashes it, while the shadow slides up inside it by the same amount, so at full press the shadow is exactly under the face, as in CSS where the shadow belongs to the element and scales with it. (A sibling shadow View outside the wrapper would leave a 1.6 pt band of shadow above and below a squashed 54 pt key.)

- Props: `label` (translated, also the accessibility label), `onPress`, `testID`, `elevation`, `radius`, `fill`, `isReducedMotion`, and optional `squash`, `edgeColor`, `edgeWidth`, `isPushedIn`, `isDisabled`, `isBusy`, `accessibilityRole`, `isSelected`, `isChecked`, `hint`, `faceStyle` (padding, direction, min height of the face), `layoutStyle` (flex, width, alignSelf of the whole key; never paint), `onPressIn` / `onPressOut` (extra work such as a hold timer; the sink always runs) and `accessibilityActions` / `onAccessibilityAction` (VoiceOver's `activate` for hold buttons).
- The shadow is drawn inside the key's box and slides `elevation` pt below it, outside the layout box, as a CSS `box-shadow` does: the design's gaps already leave room for it, so never add margin for the shadow, and never clip a key's parent with `overflow: 'hidden'`.
- Press in: `withTiming(1, 70 ms ease-out)`; release: `withSpring(0, RELEASE_SPRING)`.
- Reduce motion: the screen model passes `isReducedMotion` from `useReduceMotion()`, which removes the squash; the root `ReducedMotionConfig` makes the timing and spring instant.
- Pushed-in (`isPushedIn`, `isDisabled`, `isBusy`): the key sits at the pressed offset with no shadow, moved there by layout (`top: elevation` on the Pressable), never by a transform: VoiceOver and Maestro report the layout frame, and the references measure the sunk position (a transform-sunk segment measured 3 pt high in parity). The `translateY` transform is only the transient press. Disabled also turns the face `sunken` with a dashed `textMuted` edge; disabled and busy ignore presses and report `accessibilityState`.
- Buttons, row buttons, keys, icon buttons, option cards, segments, pause keys and level tiles compose `RaisedSurface` with their own content.
- Sound: `RaisedSurface` reads `const onPressFeedback = usePressFeedback();` from `@e07/shell/app/press-feedback-context.tsx` and runs it before `onPress`, unless `accessibilityRole` is `switch` (a switch's handler plays the toggle feedback with the selection pulse). That file is the one audio seam `ui/` may import (ESLint's ui boundary rejects `services/`): it holds the Shell's only press-feedback context and imports nothing but React (the game-audio-and-haptics skill ships the same file byte for byte), and ShellApp provides it once with `playUiFeedback(services, 'tap')`. Without a provider the hook is a no-op, so component tests need no audio fake; `raised-surface.test.tsx` wraps a render in `PressFeedbackProvider` to prove the order (tap, then the action; nothing for a switch).

## Outlines, dashed states and the group tab

Outline = `borderWidth` from `STROKE` (as rendered) + `borderColor: theme.colors.border`; danger = `theme.colors.danger`; printed parts = `shell.toyInk`. Dashed states add `borderStyle: 'dashed'` with `textMuted`. The group tab's open bottom is `borderBottomWidth: 0` with `borderTopStartRadius` / `borderTopEndRadius` 9; as rendered it is flush with the list's start edge and sits on the list's top edge (the component specs override the token file's start margin 14 and overlap 3 with 0).

## RTL rules specific to Toybox

1. Layout mirrors, shadows do not: rows use `flexDirection: 'row'` and start/end keys, so the screen mirrors in fa/ckb; hard shadows point straight down in both directions and squash is symmetric.
2. Only `back`, `chevron`, `forward` and `undo` icons mirror. Play, pause, clocks, stars, logos, pictures and the lock never do.
3. Things that fill from the start edge run right to left in RTL: slider and progress fills, the hold-to-confirm fill, the toggle knob's "on" position, the week strip and the bar chart (Monday on the right).
4. Start/end placements follow the direction: the hero-key cap (start), the level-tile flag (top-end), the group tab (flush at the start), the ad chip (top-start), the "New best" sticker (end of the score row), dialog buttons (safe choice at the start).
5. Sticker tilt does not mirror (**Chosen**): a -4 deg sticker is -4 deg in both directions. Sticker padding is physical, as in the mockup (9 left / 11 right in both directions): the component swaps its logical start and end pads in RTL.
6. Status bar and system chrome are not mirrored by the app.

## Verified and not verified

Verified in a copy of the monorepo lab (TypeScript 6.0.3, ESLint 9.39.5 with the project config and `--max-warnings 0`, Prettier, Jest 29.7 + jest-expo 57 + RNTL 14): every template in this skill compiles, lints and passes its tests; `write-palette.mjs` output for all three painted games passes `checkToyboxPalette`. Not verified on a device: `boxShadow` and `outline*` rendering and cost on the iOS simulator with many tiles, `outline` around rotated or dashed views, and the spring feel. Check them in the first simulator build; the fallback for a static shadow is a `RaisedSurface`-style shadow View.
