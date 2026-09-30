# Building a component

The recipe every template in this skill follows. Use it for a new part, a variant the design adds later, or when adapting a template.

## Contents

1. [Where a component lives](#where-a-component-lives)
2. [File anatomy](#file-anatomy)
3. [Measurements: COMPONENT_SPECS](#measurements-component_specs)
4. [Paint, text and shadows](#paint-text-and-shadows)
5. [Pressing: compose RaisedSurface](#pressing-compose-raisedsurface)
6. [Motion and reduce motion](#motion-and-reduce-motion)
7. [Writing the test](#writing-the-test)
8. [Lint limits that shape the code](#lint-limits-that-shape-the-code)
9. [Replacing pre-Toybox primitives](#replacing-pre-toybox-primitives)

## Where a component lives

- `packages/shell/src/ui/<kebab-name>.tsx`, one component per file, the named PascalCase export equals the file name (`week-bars.tsx` → `WeekBars`), with `export type WeekBarsProps`.
- `ui/` is presentational: props in, JSX out. It never imports `stores/`, `screens/` or services (a port type file `*-port.ts` is the one exception), never calls `t()`, and never computes product state. Strings arrive translated, numbers arrive formatted in the chosen digits. The press feedback is injected, not imported from services: the three press hosts read `usePressFeedback()` from `@e07/shell/app/press-feedback-context.tsx` (toybox-design-system ships that seam), and a new key composes `RaisedSurface`, so it sounds without doing anything.
- A decorative part (art, icon tile, mark, graphic) hides itself from VoiceOver, and a face that holds text grows with it (`minHeight`, never `height`); see testids-and-accessibility.md, "One policy for VoiceOver and visual parity".
- A screen (`screens/<screen>/`) wires a component: it reads stores in `use-<screen>-model.ts`, calls `t()`, and passes fixed ids. A thin screen wrapper for one screen (for example the Levels grid's tile adapter) lives in that screen's folder and composes the `ui/` component; it never re-implements the look.

## File anatomy

```tsx
// packages/shell/src/ui/chip.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const CHIP = COMPONENT_SPECS.chip;

export type ChipProps = {
  /** Translated ("Level 12", "Today", "Step 2 of 4", the version). */
  readonly text: string;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: CHIP.gap,
      paddingBlock: CHIP.paddingBlock,
      paddingInline: CHIP.paddingInline,
      borderRadius: CHIP.radius,
      borderWidth: CHIP.border,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  });
  return styles;
});

/**
 * A small flat label (level chip, "Today", version, step counter). Not interactive, never tilted.
 * The chip box is one accessible text element with the testID, so its bounds are the chip's.
 */
export function Chip({ text, testID }: ChipProps): ReactNode {
  const styles = useStyles();
  return (
    <View
      style={styles.chip}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <AppText text={text} variant="chip" />
    </View>
  );
}
```

Rules this shows: the path comment on line 1; imports grouped (react-native, aliases, relative, then types); `readonly` props with a doc comment where the value is not obvious; `makeStyles((theme) => { const styles = StyleSheet.create({...}); return styles; })` for themed styles and module-level `StyleSheet.create` for the rest; the component's explicit `ReactNode` return type; the testID on the element the design measures and Maestro can see (the chip box, made one accessible text element; a testID on the inner text would measure only the words and fails `testid-on-inner-text`); logical keys only (`paddingInline`, `start`, `end`, `marginStart`, `borderTopStartRadius`), never left/right.

## Measurements: COMPONENT_SPECS

- `component-specs.json` holds the as-rendered specs: the numeric projection of the Toybox token file's `components` block (43 entries: button, heroKey, rowButton, key, iconButton, toggle, segmentedControl, slider, progressBar, radio, optionCard, list, row, groupTab, iconTile, panel, levelTile, star, topBar, bannerSlot, dialog, toast, sticker, chip, art, premiumArt, logoTile, busy, splashLoader, toggleKey, calendarTile, weekStrip, barChart, statGrid, statList, pagerDots, offer, sheet, hazardStrip, confetti, emptyIllustration, howToStage, quietButton). `write-component-specs.mjs` writes it; nobody edits it. Two steps turn the token numbers into what the design references render: (1) every CSS border (`border`, `*Border`, `border*`, `fillEdge`) is floored as Chrome draws it, `asRenderedBorder(w) = w >= 1 ? floor(w) : w` (2.5 -> 2, 1.5 -> 1), while rings, icon and Skia strokes keep their values; (2) the commented override table (`MOCKUP_OVERRIDES` in `scripts/lib/component-source.mjs`) applies where the mockup CSS differs from the token file: `groupTab.marginStart` 0 and `groupTab.overlap` 0 (the tab is flush and sits on the list edge), `segmentedControl.faceGap` 1 and `segmentedControl.labelColumnGap` 3. The fourth difference, the strong row label (17 Bold, 1.32 / 1.5), is a text style: `TYPE_STYLES.rowLabelStrong` in the theme. A new mismatch between a component and its reference goes into that table with the mockup rule that proves it, never into the JSON by hand; the token file is never edited.
- `component-specs.ts` imports it (`with { type: 'json' }`) as `COMPONENT_SPECS`, so a typo in a key is a type error.
- Take every size, padding, gap, radius, border, elevation and rotation from `COMPONENT_SPECS.<component>` or the theme tokens (`LAYOUT`, `SPACING`, `RADII`, `STROKE`, `MIN_TOUCH`). A value the token file does not list (the top bar's 4 / 8 paddings, the week legend's 18 column gap) becomes a named constant at the top of the file with a comment; a bare number inside `StyleSheet.create` fails `measurement-literal`.
- Arrays in the specs are CSS shorthand (`calendarTile.monthPadding` = top, inline, bottom); read them with `?? 0` because of `noUncheckedIndexedAccess`.

## Paint, text and shadows

- Colours only from `theme.colors` (game paint) and `SHELL_COLORS[theme.scheme]` (gold, cut, toyInk, dangerFill, line, scrim, toast and ad colours). No literals.
- Text only through `AppText` with a type role or component style (`variant`) and a `tone` (`default`, `muted`, `onPrimary`, `onPop`, `danger`, `success`, `toyInk`, `onInk`, `toast`). No `fontSize`, no `fontWeight`.
- Raised = pressable. A static hard shadow (`hardShadow(offset, color)`) exists only on the dialog card (8), the toggle knob (2) and the slider thumb (3); everything that informs lies flat (`flat-part-shadow`).
- Printed parts (stickers, flags, art tiles, logo tiles, the calendar, result stars, confetti) may tilt and wear the white `dieCutRing`; keys, panels and rows stay square (`tilt-outside-printed`).
- Radii from the specs; never a pill or a circle (14 is the largest control radius).

## Pressing: compose RaisedSurface

`RaisedSurface` (shipped with the theme) is the only press implementation for raised keys: it draws the face, the hard shadow, the sink and squash, the spring back, the disabled and busy looks, and it sets role, name, hint and state. A new key passes:

```tsx
<RaisedSurface
  label={props.label}
  onPress={props.onPress}
  testID={props.testID}
  elevation={COMPONENT_SPECS.button.elevation}
  radius={COMPONENT_SPECS.button.radius}
  fill={paint.fill}
  edgeColor={paint.edge}
  isReducedMotion={props.isReducedMotion}
  faceStyle={styles.face}
  layoutStyle={styles.block}
>
  ...
</RaisedSurface>
```

Extra props: `isPushedIn` (selected segment, on key, option card), `isDisabled`, `isBusy`, `squash` (icon button, level tile), `accessibilityRole` (`switch`, `radio`), `isSelected` / `isChecked`, `hint`, `onPressIn` / `onPressOut` and `accessibilityActions` / `onAccessibilityAction` (the hold button). Flat pressables are only `QuietButton` and `ListRow` (a `sunken` tint while pressed); a `Pressable` anywhere else fails `press-outside-raised`, and an opacity press fails `pressed-opacity`.

## Motion and reduce motion

- Every animated component takes `isReducedMotion: boolean` from the screen (the screen model calls `useReduceMotion()` from `packages/shell/src/app/use-reduce-motion.ts`, which follows the S11 setting and the phone's switch; never Reanimated's `useReducedMotion`, which is a load-time constant). Components never call the hook themselves: it reads a store, and `ui/` is presentational.
- Durations, easings and keyframes come from the theme's `motion.ts` (`MOTION_MS`, `EASING`, `KEYFRAMES`, `RELEASE_SPRING`): sticker slap 420 ms, toast drop 380 ms after 500 ms, star pop 540 ms (delays 250 / 400 / 550), bob 1600 ms, hop 900 ms (stagger 120), knob slide 300 ms, fill change 120 ms.
- Under reduce motion: no squash, no loops, no slaps; fades take 120 ms; confetti renders nothing.
- Functional timers are not decoration: the hold-to-confirm `withTiming` passes `reduceMotion: ReduceMotion.Never` (`hold-reduce-motion`).
- Shared values use `.get()` / `.set()`, never `.value`. Effects only start and stop animation loops and return a cleanup.

## Writing the test

Render through the Shell test wrapper (`renderWithShell` from `packages/shell/src/testing/render-with-shell.tsx`), which provides the theme (`TEST_PALETTE`), language, direction and stores. Assert what a user and the parity harness rely on:

```tsx
it('names an icon-only key and reports presses', async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();
  await renderWithShell(
    <IconButton icon="gear" label="Settings" onPress={onPress} testID="home.settings-button" isReducedMotion />,
  );

  await user.press(screen.getByRole('button', { name: 'Settings' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
});
```

- Query by role and name first, testID for parts; decorative parts need `{ includeHiddenElements: true }`.
- Check one or two load-bearing measurements with `toHaveStyle` (`{ width: 38 }`, `{ borderStyle: 'dashed' }`) and paint against `TEST_PALETTE.standard.light` or `SHELL_COLORS.light`, not literals.
- `fireEvent` is async in RNTL 14: `await fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })`.
- Animations do not run in Jest; a component that waits for a drop-in is transparent at first (query with hidden elements).
- `check-components.mjs` fails `component-untested` when no test file imports the component.

## Lint limits that shape the code

Strict TypeScript (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) and the ESLint config set the shape: at most 250 lines per file, 80 lines per component function, complexity 10, 3 parameters, JSX depth 5, one component per file, no nested ternaries, no string duplicated 3 times, booleans named `is…` / `has…`, strict boolean expressions, no `useMemo` / `useCallback` / `memo`.

Patterns the templates use to stay inside them:
- Optional props are spread conditionally: `{...(props.hint === undefined ? {} : { hint: props.hint })}`.
- Branchy render logic moves into small lower-case helpers that return JSX (`startSlot`, `capSlot`, `dayColumn`): they are not components, so one-component-per-file holds; they take at most 3 parameters (bundle more into an object).
- A second component in a file becomes its own file (`toast.tsx` and `toast-stack.tsx`).

## Replacing pre-Toybox primitives

An app repo started before Toybox may hold `ui/primary-button.tsx` and `ui/tile-button.tsx` (opacity presses on a plain `Pressable`). `check-components.mjs` flags both (`press-outside-raised`, `pressed-opacity`). Replace their callers, then delete the two files and their tests:

| Old | New |
|---|---|
| `<PrimaryButton label onPress testID />` | `<Button kind="primary" label onPress testID isReducedMotion />` (the screen's one hero key: `size="hero"` with a `cap`) |
| `<TileButton ...>` in the Levels grid | `<LevelTile numberText state label hint onPress testID width isReducedMotion />` |
| an old `IconButton` without `isReducedMotion` | this skill's `icon-button.tsx` (same name, raised) |

Find every caller first: `grep -rln "primary-button\|tile-button" packages apps test`. In a repo set up from the other Pocket Arcade skills they are typically `screens/home/premium-entry.tsx` (the Premium key is `kind="pop"`), the Levels adapter `screens/levels/level-tile.tsx` (map `isLocked` / `stars` to `LevelTileState` and pass `width={size}`), and two tests, `testing/render-with-shell.test.tsx` and `testing/find-inaccessible-pressables.test.tsx` (swap in `Button` with `isReducedMotion`). Screens pass `isReducedMotion` from the Shell's reduce-motion hook. Then run tsc, ESLint, Jest and `check-components.mjs` (verified: this migration leaves all four green).

Deleting files is a visible change: say which callers moved in the report.
