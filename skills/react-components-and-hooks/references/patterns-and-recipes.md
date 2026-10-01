# Patterns and recipes

Worked shapes for the common jobs: where files go, a ui component, a screen with its model hook, custom hooks, effects, store reads, styles, lists, window sizes, reduce motion, error boundaries, and the tests that go with each.

## Contents

- Where things live
- A ui/ component
- A screen and its model hook
- Custom hooks without effects
- The four allowed effects
- Reading stores from components
- Styles: makeStyles and tokens
- Pressables: the checklist
- Lists: the levels grid decision
- Window size, safe areas and large text
- Reduce motion
- Error boundaries and the provider stack
- Testing recipes
- Verified facts and versions

## Where things live

```
packages/shell/src/
  app/        shell-providers.tsx  shell-error-boundary.tsx  system-a11y-store.ts
              use-reduce-motion.ts  motion-config.tsx  use-announce.ts
  theme/      theme-types.ts  tokens.ts  theme-set.ts  theme-context.ts  use-theme.ts
              theme-provider.tsx  make-styles.ts  shell-colors.ts
  ui/         app-text.tsx  raised-surface.tsx  icon-button.tsx  screen-frame.tsx
              window-class.ts  use-window-class.ts  use-hold-to-confirm.ts  icons/…
  screens/    <area>/<name>-screen.tsx  <area>/use-<name>-model.ts  <area>/<part>.tsx
  testing/    render-with-shell.tsx  test-palette.ts  find-inaccessible-pressables.ts
  i18n/       t-context.ts  direction-context.tsx  use-localized-text-style.ts  fonts.ts
```

Layers: `ui/` (presentational, props only) → `screens/<area>/` (screen components plus `use-<screen>-model.ts` hooks that read stores and call `t()`) → `app/` (providers, root concerns). Imports that cross folders use the package name with the extension (`@e07/shell/theme/use-theme.ts`); same folder `./file.ts`; `../` is banned (both `tsc` and Metro need the extension).

## A ui/ component

`examples/labelled-value.tsx` is the model (an example: imitate it, never copy it into the app):

- props type `LabelledValueProps` with `readonly` fields, strings already translated or formatted;
- theme-free styles at module level (`StyleSheet.create`), themed ones through `makeStyles`;
- one `testID` prop; parts append a segment (`${testID}.label`, `${testID}.value`). This is the Toybox contract rule: "a reusable component takes one testID and derives its parts" (ListRow: `.icon .label .description .value .toggle .radio`; ToggleKey: `.icon .label .state`; RowButton: `.icon .label .description`; TopBar: `.back-button .title`; ListGroup: `.tab .list`; LevelTile: `.number .stars-<n> .flag`);
- a slot (`accessory`) instead of a boolean variant flag;
- no store, screen or service imports.

A pressable ui component adds, on its `Pressable` (or on `RaisedSurface`, the Toybox press): `accessibilityRole`, `accessibilityLabel` (the translated label; icon-only buttons take a required `label` prop), `accessibilityHint` only when the result is not obvious, `accessibilityState` (`disabled`, `busy`, `selected`, `checked`) plus `disabled`, a box of at least 44 × 44 pt, and a required `testID`.

## A screen and its model hook

```tsx
// packages/shell/src/screens/stats/stats-screen.tsx
export function StatsScreen(): ReactNode {
  const model = useStatsModel();            // stores, t(), formatters, navigation handlers
  return <StatsView model={model} />;       // layout + testIDs only
}
```

- Every route file is exactly these two lines. The view is pure; `use-<screen>-model.ts` is the only code that reads stores, services, the game host (`useGameHost()`) and navigation. toybox-screens ships the hook of every Shell screen with its `renderHook` test (through `createHostWrapper` from `testing/create-host-wrapper.tsx` when the hook reads the game host, else `createShellWrapper` from `testing/render-with-shell.tsx`); copy it, never rewrite it.
- `use-stats-model.ts` reads stores through selectors (primitives, or `useShallow` for objects), formats numbers with the chosen digits, calls `t()` for sentences that need data, and builds handlers (`handleResetStats`) that dispatch actions or navigate.
- Every function stays at 40 lines or fewer (`max-lines-per-function`): split a big hook into parts with one job each, `use-<screen>-actions.ts` for the navigation handlers, `use-<screen>-links.ts` for hand-offs to other apps, and a pure `<screen>-model-of.ts` for the builder that needs no React (test it without rendering).
- Handlers navigate normally even while their route's screen is not built yet: a partial Shell points that route at `NotBuiltScreen` (navigation-and-routing), so no hook ever needs a no-op handler.
- The view calls `t()` for fixed copy keys and receives data and callbacks; it has no logic beyond layout.
- Derived values (percentages, "is today done") come from pure selector functions next to their reducer, unit-tested without React.
- Store reads on hot paths get a `<Profiler>` re-render test.

## Custom hooks without effects

`examples/use-step-pager.ts` (an example to imitate): local state for what only this screen needs, everything else derived during render (`isFirst`, `isLast`, a clamped index), functional `setState` updates in the handlers (two taps before a re-render still move two steps). No effect: the change happens in the handler that causes it.

`templates/use-hold-to-confirm.ts`: a Reanimated `withTiming` whose finish callback schedules `onConfirm` on the JS thread (`scheduleOnRN` from react-native-worklets); `reduceMotion: ReduceMotion.Never` because the 2-second hold is a safety timer, not decoration; `cancelAnimation` + a 150 ms return on release. The fill reads `progress` in an animated style.

## The four allowed effects

| Kind | Example | Returns cleanup |
|---|---|---|
| Subscribe to an OS source | `ShellProviders` → `watchSystemA11y()` | yes |
| Push React state into a native API | `ThemeProvider` → `Appearance.setColorScheme` | no (idempotent) |
| Work tied to a focused screen | board frame callbacks and audio (`useIsFocused()` → the game lifecycle) | yes |
| Measurement | the cold-start mark | yes (cancels the frame request) |

One more, test builds only: a parity capture opens the state its frame draws (a dialog over a screen, one Buy press on S12) once on mount, through the handler a player's tap uses. toybox-screens' `app/use-parity-opener.ts` is the shape: the frame state is read once (`useState(() => TEST_ONLY?.parityFrameState() === state)`), the handler goes through `useEffectEvent`, and the effect depends only on that boolean, so it runs once and never loops. A state a first render can hold (the Levels focus ring, How to play's step 2) is the `useState` initializer instead, with no effect at all.

Three patterns the lint rejects: copying a prop into state inside an effect (compute during render instead), reading `ref.current` during render (read refs in handlers and effects), declaring a component inside another (own file).

For state that must follow a store outside React (audio volume, haptics), prefer a store subscription at the composition root (`store.subscribe((state, previous) => …)`, returning the unsubscribe) over an effect in some screen.

## Reading stores from components

```tsx
const isPremium = usePremiumStore((state) => state.isPremium);            // primitive: fine
const theme = useSettingsStore(selectThemePreference);                     // named selector
const { isColorBlind, reduceMotion } = useSettingsStore(
  useShallow((state) => ({ isColorBlind: state.settings.colorBlind, reduceMotion: state.settings.reduceMotion })),
);                                                                          // object: useShallow
```

- `useShallow` comes from `zustand/shallow` (v5 re-exports `zustand/react/shallow`).
- Destructured booleans get an `is…` name; data property names keep theirs.
- The per-run game session is a vanilla store handed down through context: `useStore(sessionStore, selector)` under the same rules.
- Stores are vanilla (`zustand/vanilla`) so services read them outside React with `getState()`.

## Styles: makeStyles and tokens

```tsx
const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    card: { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingInline: SPACING.lg },
  });
  return styles;
});

export function Card(props: CardProps): ReactNode {
  const styles = useStyles();
  …
}
```

Why this exact shape (three variants were tested): a factory returning a plain object loses typo checks; returning `StyleSheet.create(...)` directly breaks `no-unused-styles` ("undefined.base"); the block body keeps `tsc`, the left/right rule, the colour-literal rule and `no-unused-styles` all working. Values come from `theme/tokens.ts` (`SPACING`, `LAYOUT`, `RADII`, `STROKE`, `ELEVATION`, `MIN_TOUCH`, `CONTENT_MAX_WIDTH`) and the Toybox component measurements; colours from `theme.colors` and `SHELL_COLORS[theme.scheme]`.

## Pressables: the checklist

| Prop | Value |
|---|---|
| `accessibilityRole` | `button` (or `switch`, `radio`, `tab`, `link`, `adjustable` where true) |
| `accessibilityLabel` | the translated visible text, or the required `label` for icon-only buttons |
| `accessibilityHint` | only when the result is not obvious, translated |
| `accessibilityState` | `{ disabled, busy }`, plus `selected` / `checked` for segments, radios and switches |
| size | own box ≥ 44 × 44 pt (`MIN_TOUCH`), never `hitSlop` |
| `testID` | `<screen>.<element>` in kebab-case, required |
| feedback | `style={(state) => [styles.base, state.pressed && styles.pressed]}` or `RaisedSurface`'s sink |

A screen test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])`.

## Lists: the levels grid decision

Measured on 2026-09-26, Release build, iOS 26.5 simulator (iPhone 17 Pro), 90 tiles, medians of 5 cold launches:

| Variant | Render → first frame | Render → last tile laid out | Tiles after 1.5 s | Footprint |
|---|---|---|---|---|
| ScrollView (Views) | 16–26 ms | 26 ms | 90 | 49–50 MB |
| FlatList `numColumns` (Views) | 30 ms | 40 ms | 90 | 50 MB |
| FlashList 2.0.2 (Views) | 22 ms | 40 ms | 85 | 51 MB |
| ScrollView (rasterized icon images) | 21 ms | 58 ms | 90 | 51 MB |
| ScrollView (one Skia canvas per tile) | 61 ms | 264–280 ms | 90 | 66 MB |

At 90 items virtualization saves nothing (FlatList's default `windowSize` 21 covers the whole grid) and costs code: section headers need row-chunking, scrolling to a level needs `getItemLayout`, recycled cells can keep stale state. All layouts mirror correctly in RTL (level 1 top-right). Tile testIDs are `levels.level-tile.<n>`; above 150 levels the screen shows one pack at a time.

## Window size, safe areas and large text

`templates/window-class.ts` classifies `{ width: 'compact' | 'regular' (≥ 600), isLandscape, isLargeText (fontScale ≥ 1.35) }`; `use-window-class.ts` re-runs on rotation, Split View, Stage Manager and iOS 27 resizable windows.

| Window | Size (pt) | Why |
|---|---|---|
| narrow Split View pane, small phone | 320 × 568 | narrowest window |
| baseline phone portrait | 402 × 874 | screenshots at 3× (1206 × 2622 px) |
| baseline phone landscape | 874 × 402 | rotation, resizable windows |
| iPad mini portrait | 744 × 1133 | smallest regular width |
| iPad Pro 13-inch landscape | 1376 × 1032 | widest; the column caps at 640 |
| any of the above at `fontScale` 2 | | the 200 % text pass |

`ScreenFrame` (`templates/screen-frame.tsx`) owns safe areas (physical edges) and the ground colour, and centres a column of at most 640 pt. It has no padding: the Toybox top bar pads 16 and the body 20. By default it insets all four edges, so a screen with a banner keeps the home-indicator inset under the banner. A tall screen without a banner (S11, S11a-d, S15, and S10 while its banner is not allowed) passes `edges={UNDER_HOME_INDICATOR_EDGES}` (top, left, right) and gives its `ScreenBody` `isUnderHomeIndicator`: the body scrolls on under the home indicator and ends with `max(34, bottom inset)` of padding, as the Toybox references draw it. With the default edges those screens were clipped 34 pt above the bottom of the screen. Boards size themselves from their canvas, never from the window. With `isLargeText`, rows stack (home keys, two-button rows, streak panels, three-column stat grids), row values drop under their labels, tiles grow in height.

## Reduce motion

`useReduceMotion()` = `resolveReduceMotion(settings.reduceMotion, systemA11yStore.isReduceMotionOn)`: `'system'` follows the phone, `'on'`/`'off'` win. `<MotionConfig/>` sets Reanimated's global flag (`ReducedMotionConfig`), so every `withTiming`/`withSpring`/layout animation with the default `ReduceMotion.System` follows the Shell setting (dev builds log one "Reduced motion setting is overwritten" warning, expected). Board animations use `buildTimeline(events, isReduced ? 'reduced' : 'full')`. Functional timers opt out with `ReduceMotion.Never`.

The frozen-motion switch for parity captures lives in the same hook: `useReduceMotion()` also returns true while `TEST_ONLY?.isParityMotionFrozen?.()` does (a test build launched with `animations=off`). So every consumer that already honours reduce motion holds still at rest for the capture: `<MotionConfig/>` and every Reanimated entrance, the screen transitions, the current level tile's flag bob, the S1 and S12 busy blocks, sticker slaps, star pops and confetti. Nothing else checks for parity: a looping animation that ignores `useReduceMotion()` is a bug (the capture never settles). The Settings "Reduce motion" row and the save are untouched: the row reads `useReduceMotionSetting()` (`app/use-reduce-motion-setting.ts`: the saved choice or the phone's switch, never frozen). So does the one place where the setting hides something instead of stilling it: the S12 success confetti, whose `isHiddenBySetting` comes from the saved choice (a frozen capture keeps the pieces at their first still frame, as the design draws them). The restart splash (`app/create-startup-splash.tsx`) runs before any store exists: it ORs the phone's switch (`systemA11yStore`) with `TEST_ONLY?.isParityMotionFrozen()` itself. `useReduceMotion()` reads `TEST_ONLY` at call time through a local type in which `isParityMotionFrozen` is optional: the member joins the test-only pair with the parity harness, after this file exists, and store builds have no `TEST_ONLY` at all. Because it imports `app/test-only.ts`, code the test-only entry itself reaches (the S15 debug model) reads `useReduceMotionSetting()` instead: importing `use-reduce-motion.ts` there closes an import loop through the gate's `require()` (check-boundaries `import-cycle`), and while the entry is still loading, `TEST_ONLY` is undefined. Never read `TEST_ONLY` at module level for the same reason.

## Error boundaries and the provider stack

`ShellProviders` (template): `GestureHandlerRootView` → `SafeAreaProvider` → `ThemeProvider` → `<MotionConfig/>` → `ShellErrorBoundary` → children, and one effect that starts `watchSystemA11y` and returns its unsubscribe. The boundary's `renderFallback(reset)` is passed in by the composition root (the Toybox crash dialog: one Home button, never an automatic retry). The game host puts a second boundary around the board whose `onError` logs and sends the session Home, so a broken board never takes navigation down.

## Testing recipes

- Render through `renderWithShell(ui, options)` (real English catalog, stores from a seeded in-memory save, theme over the test palette, direction). `await render…` (RNTL 14 is async).
- Query by role and name first (`getByRole('button', { name: 'Play' })`), by testID for layout parts.
- State changes from outside React: `await act(() => { stores.settings.getState().dispatch(…); })`.
- Hooks: `const { result } = await renderHook(() => useX(), { wrapper })` with `createShellWrapper(options).wrapper` when the hook needs providers.
- Safe areas: wrap in `<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } }}>`; without metrics it renders nothing in Jest.
- Reanimated timers: `jest.useFakeTimers()`, `act(() => jest.advanceTimersByTime(ms))` (the project's Jest setup calls Reanimated's `setUpTests()`).
- Skia does not load in the `unit` project ("Native Skia Module failed to correctly install JSI Bindings!"); the unit setup mocks the icon rasterizer, the `golden` project runs the real one.
- Test titles start with a third-person verb (`derives …`, `removes …`); name render helpers `renderX` only when they return the render result.

## Verified facts and versions

Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, ESLint 9.39.5 with eslint-plugin-react-hooks 7.1.1, Jest 29.7 + jest-expo 57.0.5 + RNTL 14.0.1, Zustand 5.0.15, Reanimated 4.5.1, Worklets 0.10.1, Skia 2.6.2, react-native-safe-area-context 5.7.0, babel-plugin-react-compiler 1.0.0 (through `babel-preset-expo`; never add it to package.json).

On 2026-09-28 every template here passed `tsc`, the project ESLint config with `--max-warnings 0`, Prettier, and Jest, in a workspace with the project's configs and the real Toybox components; the hold-to-confirm tests fail when the finish callback is broken; `check-react-rules.mjs` passed over the whole Shell (Toybox components and screens included) and caught a `Pressable` imported into a screen and a `Date.now()` in a view. Earlier (2026-09-26): the compiler compiled `IconButton` (8-slot cache) and `useHoldToConfirm` and skipped the factory-returned `useStyles`; `set-state-in-effect`, `refs`, `set-state-in-render` and `static-components` fire as errors; `props.items.push()` is not flagged by lint (hence readonly props); the re-render guard failed as expected when a component also subscribed to `useSettingsStore((state) => state.settings)`.
