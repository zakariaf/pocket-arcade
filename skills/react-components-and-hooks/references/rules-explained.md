# The React rules, explained

Every rule for components, hooks, styles, text, layout, buttons, lists, icons, motion and errors in the Shell and the game apps, with the reason and what enforces it. "lint" = the project's ESLint config (`--max-warnings 0`); "checker" = `scripts/check-react-rules.mjs`; "test" = a Jest test the rule asks for.

## Contents

- Components (1-7)
- Hooks and effects (8-12)
- React Compiler (13-17)
- Zustand in components (18-21)
- Theme and styles (22-25)
- Text (26-29)
- Right-to-left layout (30-34)
- Buttons and Pressable (35-40)
- Lists (41-43)
- Icons and canvases (44-46)
- Layout, dark mode, motion, errors (47-53)

## Components (1-7)

1. **Function components only.** The one class is `ShellErrorBoundary` (`app/shell-error-boundary.tsx`). React Compiler optimises only functions, and React 19 has no hook for error boundaries. Enforced: checker `class-component`.
2. **One component per file**, kebab-case file, named PascalCase export of the same name (`labelled-value.tsx` → `LabelledValue`), explicit `: ReactNode` return type, no default export. The agent finds a component from its name alone. Enforced: lint (`react/no-multi-comp`, `check-file`, `import/no-default-export`, `explicit-module-boundary-types`).
3. **Props as `type <Component>Props = { readonly … }`**, `readonly T[]` for arrays, callbacks `onX`, local handlers `handleX`, and a required `testID` on every interactive component (`<screen>.<element>`, e.g. `levels.level-tile.12`). A read-only type makes prop mutation a compile error; the compiler lint does not catch `props.items.push()`. Enforced: checker `props-readonly`, `testid-required`; lint `testIdFormat`.
4. **Components display strings but never build them.** A prop that ends up on screen is a translated string made by `t()` in the screen or its model hook. Every sentence is one translatable message (spec N12). Enforced: lint (`formatjs/no-literal-string-in-jsx`, `react/jsx-no-literals`).
5. **No business logic in components.** Rules and derived values go in pure functions (reducers, selectors, `*-layout.ts`); side effects in services behind ports; a screen wires them in `use-<screen>-model.ts`. `ui/**` never imports `stores/`, `screens/` or `services/` (a `*-port.ts` type file is the one exception). Enforced: lint zone, checker `ui-boundary`.
6. **Compose with `children` or slot props, not variant flags.** At most one boolean prop that changes layout: every flag doubles the states to test.
7. **Render is pure.** No `Date.now()`, `new Date()`, `Math.random()`, `performance.now()` during render; never read a ref, declare a component or set state during render. The compiler assumes pure renders. Enforced: lint (`react-hooks/purity`, `refs`, `static-components`, `set-state-in-render`), checker `render-impure`.

## Hooks and effects (8-12)

8. **Each hook in `use-<name>.ts`, exported as `useName`**, returning one value or an object with named fields, at most 3 parameters (options object beyond), never JSX. Naming makes hooks visible to the hooks and compiler lint. Exceptions: a store file exports its `useXStore`, a context file its `useX`, and `navigation/route-guards.ts` the static-config `if` hooks. Enforced: checker `hook-file`, lint `max-params`.
9. **An effect only synchronises with a system outside React:** (a) subscribe to OS or native events and return the unsubscribe; (b) push React state into a native API (`Appearance.setColorScheme`); (c) start and stop work tied to a focused screen (`useIsFocused()` feeding the game lifecycle); (d) record a measurement. Compute everything else during render or in the event handler that caused it.
10. **Never call a state setter synchronously in an effect body** (from a subscription callback or a promise continuation is fine). Enforced: lint `react-hooks/set-state-in-effect`.
11. **Every subscribing effect returns its cleanup and lists every dependency.** A leaked listener keeps firing after unmount. Enforced: lint `exhaustive-deps` (error), checker `effect-cleanup`.
12. **Mirror OS state in a store, not `useState` + effect.** `systemA11yStore` (vanilla Zustand) is filled once by `watchSystemA11y()`; hooks read it with `useStore`. One subscription serves the app and no effect sets state.

## React Compiler (13-17)

13. **No `useMemo`, `useCallback` or `memo`.** The compiler memoizes JSX, handlers and derived values (`experiments.reactCompiler: true` via the Shell's config; `babel-preset-expo` 57 compiles workspace packages too). A measured need gets a file-scoped ESLint exemption citing the measurement. Enforced: lint ban, checker `no-memo-apis`.
14. **`'use no memo'` is a temporary escape hatch:** first a failing test that shows the compiler-caused bug, then the directive with `// use-no-memo-test: <test name>`, and an Open-issues entry; remove all three together. The directive switches optimisation off silently. Enforced: checker `use-no-memo`.
15. **Reanimated shared values use `.get()` and `.set()`, never `.value`** (React Compiler compatibility). Enforced: checker `shared-value-get-set`.
16. **Factory-built hooks are stable by construction.** The compiler compiles only top-level components and hooks, so the `useStyles` returned by `makeStyles` is not compiled; `makeStyles` therefore caches styles per `Theme` (4 themes per app) in a `WeakMap`.
17. **Every `react-hooks/*` rule at error, `--max-warnings 0`.** When code breaks a Rule of React the compiler skips that function without a word; the lint error is the only signal.

## Zustand in components (18-21)

18. **Always pass a selector.** `useSettingsStore()` or `useStore(sessionStore)` without one re-renders on every change. Enforced: lint `storeWithoutSelector`, checker `store-selector`.
19. **A selector returns a primitive or an existing reference;** one that builds an object or array is wrapped in `useShallow` from `zustand/shallow`. In Zustand 5 a new object per call causes "Maximum update depth exceeded". Enforced: checker `object-selector`.
20. **Computing selectors live next to their reducer as pure functions** (`selectPackStars(state, levels)`) and are unit-tested. Components call store actions only from event handlers, never during render.
21. **Pin hot components' re-render boundary with a `<Profiler>` test** that fails when the component subscribes to an unrelated store (`hide-for-premium.test.tsx`).

## Theme and styles (22-25)

22. **Every colour from `theme.colors.<token>`** (and the Shell constants `SHELL_COLORS[scheme]`). Palettes are data from the game, light and dark, standard and colour-blind. Enforced: lint `react-native/no-color-literals`.
23. **Themed styles: `const useStyles = makeStyles((theme) => { const styles = StyleSheet.create({...}); return styles; });`**, and `const styles = useStyles();` in the component; module-level `StyleSheet.create` for theme-free styles. This exact shape keeps `tsc` rejecting mistyped style keys, the left/right lint matching `StyleSheet.create`, and `react-native/no-unused-styles` matching the `styles` name.
24. **The 4 themes are built once at startup** (`createThemeSet(palette)`, 2 schemes × 2 colour modes) and passed to `ThemeProvider`; never create a `Theme` during render. Fonts are not in the theme; they follow the text's language.
25. **Spacing, radii, strokes, elevations, touch size, content width and type sizes from `theme/tokens.ts`**; every component's measurements come from the Toybox design system.

## Text (26-29)

26. **Text only through `AppText`** (or `<T id=… />`), string as the `text` prop. `Text` from react-native is a lint error outside `app-text.tsx`. Enforced: lint, checker `banned-import`.
27. **`AppText` takes direction, alignment, font and line height from `useLocalizedTextStyle`**, which always sets `textAlign` (`start` → `'left'`, swapped under RTL) and `writingDirection`. Never `'auto'`: Latin text stays left-aligned in forced RTL on an English device.
28. **Type roles and component styles, never raw font sizes**; never `fontWeight` with a custom family (the family is the weight).
29. **Dynamic Type capped at 200 %** (`maxFontSizeMultiplier={2}` inside `AppText`); layouts reflow instead of truncating. Headings pass `isHeader` (`accessibilityRole="header"`); text in another language (the language list) passes `language` (also `accessibilityLanguage`). At the largest accessibility size iOS reports `fontScale` 3.571; the cap holds text at 2×.

## Right-to-left layout (30-34)

30. **Only logical style keys:** `marginStart/End`, `paddingStart/End`, `paddingInline`, `start/end`, `borderStart*`, `borderTopStartRadius`. Physical left/right keys are lint errors in styles (spec N11).
31. **Rows are `flexDirection: 'row'` and mirror by themselves.** Never `row-reverse` to fake RTL; never read `I18nManager.isRTL`; use `useDirection()`. Enforced: lint, checker `no-isrtl`.
32. **Directional icons (back, chevron, forward, undo) flip through `DIRECTIONAL_ICONS` inside `Icon`.** Clocks, play/pause, stars and pictures never flip.
33. **Safe areas come from `ScreenFrame`** (`SafeAreaView` from react-native-safe-area-context with physical `edges`). Never turn raw insets into `marginStart/End`: the notch and home indicator do not mirror.
34. **Boards stay `direction: 'ltr'`** (the board host wrapper) unless the game opts in to mirroring; the board's accessibility element sits inside it.

## Buttons and Pressable (35-40)

35. **`Pressable` only inside `packages/shell/src/ui/**`.** Screens use the ui primitives, so accessibility and touch size are solved once. Toybox presses go through `RaisedSurface`. Enforced: lint, checker `banned-import`.
36. **Every `Pressable` has `accessibilityRole` and a name made by `t()`**; icon-only buttons take a required `label`. VoiceOver and RNTL `getByRole` need both. Enforced: lint `pressableA11y`, `a11yLiteral`.
37. **Each `Pressable`'s own box is at least 44 × 44 pt** (`minWidth`/`minHeight` = `MIN_TOUCH`); never `hitSlop` to reach 44: it is invisible in layout and overlaps neighbours. Enforced: checker `no-hitslop`.
38. **State via `accessibilityState`** (`disabled`, `busy`, `selected`, `checked`) and `disabled` on the `Pressable`; pressed feedback as `style={(state) => [styles.base, state.pressed && styles.pressed]}` (destructuring `({ pressed })` fails the boolean-name rule). Enforced: checker `pressed-destructure`.
39. **Never a `Pressable` inside the board's `GestureDetector`**; the canvas is the detector's only child and Shell controls are siblings.
40. **Every hold or long-press has a screen-reader alternative** (`accessibilityActions` or a confirmation dialog); functional timers (hold-to-confirm) pass `reduceMotion: ReduceMotion.Never`, or Reduce motion would finish a 2-second safety hold instantly.

## Lists (41-43)

41. **The levels grid is one `ScrollView`, packs as sections, every tile mounted** (`flexDirection: 'row'` + `flexWrap: 'wrap'`); limit 150 tiles per screen, otherwise one pack at a time (pack tabs). Measured: at 90 tiles virtualization mounted no fewer tiles and finished later.
42. **No `FlatList`, `SectionList` or FlashList in v1** (no list grows without bound). FlashList would be a dependency Expo pins behind npm. Enforced: checker `banned-import`.
43. **Keys are stable ids (the level number), never the index**; index keys remount the wrong tiles when a filter changes. A list of data (`items.map((item, index) => …)`) keys by the item's id, also inside templates (`` `pack-${index}` `` is still an index key). A positional series generated with `Array.from({ length }, (_, i) => …)` (pager dots, filler cells) has no identity but its place and may key by it. Enforced: checker `list-key-index`.

## Icons and canvases (44-46)

44. **Shell icons are single SVG paths on a 24 grid** rendered by `Icon`: rasterized once per pixel size with Skia on the CPU, cached as a PNG data URI, shown in a native `Image` tinted by `tintColor`. 90 tiles mount 4.8× faster and use 15 MB less than a canvas per tile.
45. **A Skia `<Canvas>` only for multi-colour or animated art** (logos, result stars, how-to-play pictures) and boards; at most 8 per screen outside the board, never one per list item (≈ 0.18 MB and ≈ 2.8 ms each). Enforced: checker `canvas-budget` (per file).
46. **No react-native-svg, emoji, icon fonts or image files for UI icons.** react-native-svg adds a native pod and `fetch()`-based remote loading. Enforced: checker `banned-import`.

## Layout, dark mode, motion, errors (47-53)

47. **Never `Dimensions`, never assume portrait or phone.** Size from `useWindowDimensions()` / `useWindowClass()` or `onLayout`; layout maths in pure functions tested at 320 × 568, 402 × 874, 874 × 402, 744 × 1133, 1376 × 1032 and at `fontScale` 2. iPad rotates, Split View and Stage Manager resize, iOS 27 makes iPhone apps resizable. Enforced: lint, checker `banned-import`.
48. **Every Shell screen inside `ScreenFrame`:** safe areas, the ground colour, a centred column at most 640 pt wide.
49. **When `isLargeText` (fontScale ≥ 1.35), stack horizontal rows vertically; tiles grow with `fontScale`.**
50. **`userInterfaceStyle: 'automatic'`;** `ThemeProvider` resolves System/Light/Dark and mirrors the choice into `Appearance.setColorScheme` (`'unspecified'` for System) so alerts and pickers match.
51. **Reduce motion only through `useReduceMotion()`**; `<MotionConfig/>` at the root makes every Reanimated animation follow the Shell setting. Reanimated's `useReducedMotion()` is a module-load constant. The same hook is true during a parity capture (`animations=off`), so a loop that reads it holds still for the screenshot; only the saved choice itself reads `useReduceMotionSetting()`: the Settings row, and the S12 success confetti's hide switch (`Confetti isHiddenBySetting`; under the capture freeze the confetti draws its first still frame, as the design does). The restart splash has no settings store, so it ORs the phone's switch with `TEST_ONLY?.isParityMotionFrozen()` itself. Enforced: checker `banned-import`.
52. **`ShellErrorBoundary` around the app root (inside `ThemeProvider`) and around the board host.** Its fallback offers exactly one way out and never retries by itself; errors go to `ErrorLogPort`. A crash that repeats on the same saved run ends at Home, never in a loop.
53. **Catch what boundaries cannot see** (event handlers, promises, worklets, frame callbacks) where it happens and log it through `ErrorLogPort`; async handlers start `task().catch(reportError)` (handlers stay synchronous).
