# 05 · Components, hooks and styling

> **What this doc decides.** How every React component, custom hook and style in the Shell and in each game app is written. Components are function components with read-only props and no business logic. Effects exist only to talk to systems outside React. React Compiler does the memoization, Zustand is read through narrow selectors, and every colour comes from a typed theme (`makeStyles`). All text goes through `AppText`, layout uses start/end only, and buttons are accessible `Pressable`s of at least 44 pt.
> Decided here, with measurements: the ~90-tile levels grid is a plain `ScrollView` (neither FlatList nor FlashList). Icons are Skia paths rasterized once and shown as tinted native images (not one Skia canvas per icon, not react-native-svg). The doc also sets the safe-area, window-size, dark-mode, reduce-motion and error-boundary rules.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) A.2, A.5, A.7, B.12, B.15, B.18, B.19, D.34–D.36, D.46. This doc does not change them. Problems are listed under [Open issues](#open-issues).
> **Related docs:** [18-design-system-toybox.md](18-design-system-toybox.md) (the Toybox design system: every token value, component, screen layout and the React Native recipes for it), [04-code-style-and-limits.md](04-code-style-and-limits.md) (lint and limits), [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (stores and selectors), [07-testing-and-tdd.md](07-testing-and-tdd.md) (renderWithShell and RNTL), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (t(), direction, fonts), [15-performance-and-accessibility.md](15-performance-and-accessibility.md) (accessibility and performance budgets), [03-naming.md](03-naming.md) (component and testID names). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

This doc covers the React layer of `packages/shell` and of every `apps/<game>`: screens, the UI primitives in `packages/shell/src/ui/`, hooks, the theme, and how components read state. Neighbouring topics have their own owners:

| Topic | Owner |
|---|---|
| `useT()`/`t()`, `<T>`, `DirectionContext`, script fonts, `useLocalizedTextStyle`, the RTL restart | doc 10 (i18n and RTL) |
| Store reducers, `SaveStore`, the save document | doc 06 (navigation, state and persistence) |
| Port signatures, ads, purchase | doc 02 (all ports), docs 11 and 12 |
| Board host, frame callbacks, gestures, `buildTimeline` | doc 08 (game engine) |
| Jest projects, RNTL conventions, Maestro | doc 07 (testing) |
| The full `eslint.config.mjs` and tsconfigs, size limits | doc 04 (code style) |
| Names of files, components, stores, testIDs | doc 03 (naming) |
| `quality-gates.json`, npm scripts, hooks | doc 16 |
| Budgets, measurement, accessibility testing | doc 15 (performance and accessibility) |

**Conventions used in every example.**

- Paths follow the canonical layout (FINAL A.8). Shell files live in `packages/shell/src/<folder>/<file>`, and the first line of every code block is the file's path.
- Imports that cross folders inside the Shell use the package's own name with an explicit extension: `@e07/shell/theme/use-theme.ts`. Imports from the same folder are written `./file.ts`, and parent-relative `../` imports are banned (FINAL D.34). This was verified on 2026-09-26 in a copy of the monorepo probe with `exports: { "./*": "./src/*" }`: `tsc` and Metro (`expo export`) both resolve `@e07/shell/theme/tokens.ts`, and **both fail** on `@e07/shell/theme/tokens` without the extension. It is the same form doc 04 prescribes (rule 19), and the Metro check settles doc 04's open issue 5 (Metro and explicit extensions).
- Every TypeScript block below is a copy of a file that passed, on 2026-09-26, in a monorepo-shaped lab: doc 04's `eslint.config.mjs` copied verbatim plus the additions in [3.12](#312-eslint-additions-owned-by-this-doc), doc 04's per-project tsconfigs (`tsc` 6.0.3), Prettier, and Jest (42 tests). The i18n modules they import (`useT`, `useDirection`, `useLocalizedTextStyle`, `fonts.ts`, `I18nProvider`) are doc 10's files, copied unchanged. Doc 10 types `t()` keys as `keyof` the English catalog, so every key used below must exist in `packages/shell/src/i18n/catalogs/en.json` and the other three catalogs. The English entries are listed next to the code. The stores were stubs shaped like doc 06's; since 2026-09-26 the component tests here run on doc 06's real stores through doc 07's `renderWithShell`. In the integration pass on 2026-09-26, `theme-provider.tsx`, `use-reduce-motion.ts` and `premium-entry.tsx` were re-checked (`tsc`, doc 04's ESLint, Prettier) against doc 06's real `settings-store.ts` and `settings-selectors.ts` and doc 12's `premium-state.ts`.

---

## 2. Rules

Every rule is imperative and testable. **Why** gives the reason in one line. **Source** links external facts; "verified" means it was run on 2026-09-26 (see [Verified](#verified)).

### Components

1. **Write function components only.** The one exception is `ShellErrorBoundary` (`packages/shell/src/app/shell-error-boundary.tsx`), the only class in the codebase.
   *Why:* React Compiler optimises only function components and hooks, and "there is currently no way to write an Error Boundary as a function component". **Source:** [react.dev Component](https://react.dev/reference/react/Component).
2. **Put one component in each file.** The file name is kebab-case and the component is a named PascalCase export with the same name (`primary-button.tsx` → `PrimaryButton`). Give it an explicit `: ReactNode` return type. No default export.
   *Why:* the agent finds a component from its name alone. Enforced by `react/no-multi-comp`, `check-file`, `import/no-default-export` and `explicit-module-boundary-types` (doc 04).
3. **Type props as `type <Component>Props = { readonly … }`.** Use `readonly T[]` for arrays, name callback props `onX` and local handlers `handleX` (doc 03), and give every interactive component a required `testID` of the form `<screen>.<element>` (`levels.level-tile.12`).
   *Why:* a read-only type makes prop mutation a compile error, and the compiler lint does **not** catch `props.items.push()` (verified). Maestro selects by testID (FINAL D.36, D.40, doc 03 rule 12).
4. **Components display strings but never build them.** A prop that ends up on screen is a translated `string` (`label`, `title`, `summary`), made by `t()` in the screen or its model hook.
   *Why:* spec N12. A component that only receives strings is language-agnostic and easy to test.
5. **Keep business logic out of components.** Rules and derived values go in pure functions (reducers, selectors, `*-layout.ts`). Side effects go in services behind ports. A screen wires them together in `use-<screen>-model.ts`. Files in `packages/shell/src/ui/**` must not import `stores/`, `screens/` or anything in `services/` except a port type file (`*-port.ts`, received as a prop, as doc 11's `AdBannerSlot` does) (lint zone, verified).
   *Why:* pure functions can be test-driven without rendering (FINAL D.41), and `ui/` stays reusable.
6. **Compose with `children` or slot props instead of variant flags.** A component may have at most one boolean prop that changes its layout.
   *Why:* every flag doubles the states to test, and slots do not (see `TileButton`).
7. **Keep render pure.** Never call `Date.now()`, `new Date()`, `Math.random()` or `performance.now()` during render. Never read a ref, declare a component, or call a state setter during render.
   *Why:* the compiler assumes pure renders. `react-hooks/purity`, `refs`, `static-components` and `set-state-in-render` are errors (verified).

### Hooks and effects

8. **Put each hook in `use-<name>.ts` and export it as `useName`.** It returns one value or an object with named fields, takes at most 3 parameters (use an options object beyond that), and never returns JSX.
   *Why:* naming makes hooks visible to the rules-of-hooks and compiler lint. `max-params` is 3 (doc 04).
9. **Use an effect only to synchronise with a system outside React.** That means: (a) subscribing to OS or native events and returning the unsubscribe; (b) pushing React state into a native API (for example `Appearance.setColorScheme`); (c) starting and stopping work tied to a focused screen (React Navigation's `useIsFocused()` feeding doc 08's `useGameLifecycle`, which stops frame callbacks and suspends audio); (d) recording a measurement (doc 15). Compute everything else during render, or do it in the event handler that caused it.
   *Why:* **Source:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
10. **Never call a state setter synchronously in an effect body.** Calling it from a subscription callback or a promise continuation inside the effect is fine.
    *Why:* `react-hooks/set-state-in-effect` is an error in our config (verified: "Calling setState synchronously within an effect can trigger cascading renders").
11. **Return a cleanup from every subscribing effect, and list every dependency.** `react-hooks/exhaustive-deps` is escalated to error.
    *Why:* a leaked listener keeps firing after unmount. Escalation: FINAL D.34.
12. **Mirror OS state in a store, not in `useState` plus an effect.** `systemA11yStore` (a vanilla Zustand store) is filled once by `watchSystemA11y()`, and hooks read it with `useStore`.
    *Why:* one subscription serves the whole app, reads are synchronous, and no effect has to set state.

### React Compiler

13. **Do not import `useMemo`, `useCallback` or `memo`** (lint ban, verified). If a measured problem needs one, add a file-scoped exemption block to `eslint.config.mjs` whose comment cites the measurement from doc 15.
    *Why:* FINAL A.2. The compiler already memoizes JSX, handlers and derived values (compiled output in [3.4](#34-react-compiler-what-it-does-here)). The ban is part of the additions in [3.12](#312-eslint-additions-owned-by-this-doc).
14. **Use `'use no memo'` only as a temporary escape hatch.** First write a failing test that shows the compiler-caused bug. Then add the directive, with the test name in a comment, and an entry under Open issues. Remove all three together.
    *Why:* the directive switches optimisation off silently. **Source:** [use no memo](https://react.dev/reference/react-compiler/directives/use-no-memo).
15. **Read and write Reanimated shared values only with `.get()` and `.set()`, never `.value`.**
    *Why:* FINAL A.2. **Source:** [useSharedValue](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/).
16. **Make hooks built by a factory stable by construction.** The compiler compiles only top-level components and hooks, so the `useStyles` returned by `makeStyles` is not compiled (verified). That is why `makeStyles` caches its styles per `Theme`.
    *Why:* an uncompiled hook that returned a fresh object every render would defeat memoization in every component that uses it.
17. **Keep every `react-hooks/*` rule at error and lint with `--max-warnings 0`.**
    *Why:* when code breaks a Rule of React, the compiler skips that function without a word. The lint error is the only signal. **Source:** [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks).

### Zustand in components

18. **Always pass a selector.** Calling `useSettingsStore()` with no selector, or `useStore(sessionStore)` without a second argument, is a lint error (verified).
    *Why:* without a selector the component re-renders on every change to any field.
19. **Make a selector return a primitive or an existing reference.** If it builds an object or an array, wrap it in `useShallow` from `zustand/shallow`.
    *Why:* in Zustand 5, a selector that returns a new object on every call causes "Maximum update depth exceeded". **Source:** [Zustand v5 migration](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md).
20. **Put selectors that compute something next to their reducer, as pure functions** (for example `selectPackStars(state, levels)`), and unit-test them. Components call store actions only from event handlers, never during render.
    *Why:* logic stays testable without React (rule 5).
21. **Pin the re-render boundary of any hot component with a `<Profiler>` test** ([3.5](#35-zustand-in-components)). The test must fail when the component subscribes to an unrelated store (verified).
    *Why:* re-render bugs are otherwise invisible until a device stutters.

### Theme and styles

22. **Take every colour from `theme.colors.<token>`.** Palettes are data from the game module, in light and dark for both the standard and the colour-blind mode. Colour literals in styles are a lint error (`react-native/no-color-literals`).
    *Why:* spec 8.12, where each app takes its game's palette, and one checked palette gives one contrast test (doc 15).
23. **Write themed styles as `makeStyles((theme) => { const styles = StyleSheet.create({…}); return styles; })`, and name the result `styles` in the component too.** Use module-level `StyleSheet.create` for styles that do not depend on the theme.
    *Why:* this exact shape keeps three checks working (all verified): `tsc` rejects mistyped style keys, the N11 left/right selector matches `StyleSheet.create`, and `react-native/no-unused-styles` matches the `styles` name.
24. **Build the 4 themes once at startup** with `createThemeSet(palette)` (2 schemes × 2 colour modes) and pass the set to `ThemeProvider`. Never create a `Theme` during render. Fonts are not part of the theme: they follow the language of the text (doc 10).
    *Why:* stable `Theme` identities are what make the `makeStyles` cache and compiler memoization work.
25. **Take spacing, radii, strokes, elevations, touch size, content width and type sizes from `packages/shell/src/theme/tokens.ts`.** Their values, and every component's measurements, come from the Toybox design system ([doc 18](18-design-system-toybox.md)).
    *Why:* spec 8.12 asks for one type scale and spacing system for all games.

### Text

26. **Render text only through `AppText` (or doc 10's `<T id=… />`, which renders `AppText`).** Pass the string as the `text` prop. Importing `Text` from `react-native` is a lint error everywhere except `app-text.tsx` (doc 04 `TEXT_IMPORT`, verified).
    *Why:* alignment, writing direction, fonts and scaling must be right in one place.
27. **Let `AppText` take direction, alignment, font and line height from doc 10's `useLocalizedTextStyle`.** That hook always sets `textAlign` (`start` → `'left'`, which React Native swaps under RTL) and `writingDirection`. Never rely on `'auto'`, and never set these by hand elsewhere.
    *Why:* with `'auto'`, Latin text stays left-aligned in forced RTL on an English device (verified in the services spike). **Source:** [Expo localization guide](https://docs.expo.dev/guides/localization/).
28. **Use type roles (`display`, `title`, `heading`, `body`, `label`, `caption`), never raw font sizes.** Doc 10's `scriptFontFor` then picks Vazirmatn-Regular/Bold with 1.5 × line height for fa/ckb, and the platform font with 1.3 × for en/de. Never set `fontWeight` together with a custom family.
    *Why:* FINAL C.32. One type scale for all games (spec 8.12), with the Arabic script's extra line height.
29. **Cap Dynamic Type at 200% with `maxFontSizeMultiplier={2}` (inside `AppText`).** Layouts reflow instead of truncating. Headings pass `isHeader`, which sets `accessibilityRole="header"`. Text in another language than the UI (the language list) passes `language`, which also sets `accessibilityLanguage`.
    *Why:* spec 8.11. Verified: at the largest accessibility size iOS reports `fontScale` 3.571 and the cap holds text at 2×.

### Right-to-left layout

30. **Use only logical style keys:** `marginStart/End`, `paddingStart/End`, `paddingInline`, `start/end`, `borderStart*`, `borderTopStartRadius`. Physical `left`/`right` keys are lint errors inside `StyleSheet.create`, style props and `*Style` variables (verified).
    *Why:* spec N11. **Source:** [layout props](https://reactnative.dev/docs/layout-props).
31. **Build rows with `flexDirection: 'row'` and let React Native mirror them.** Never use `row-reverse` to fake RTL. Never read `I18nManager.isRTL` (lint ban); use `useDirection()`.
    *Why:* one direction source (FINAL C.31). The mirrored level grid was verified on the simulator.
32. **Flip directional icons (back, next) through `DIRECTIONAL_ICONS`.** Clocks, play/pause and pictures of objects never flip.
    *Why:* spec 7.5.
33. **Take safe areas from `ScreenFrame` (`SafeAreaView` with physical `edges`).** Never convert raw insets into `marginStart`/`End` by hand.
    *Why:* the notch and the home indicator are physical and do not mirror in RTL.
34. **Keep boards at `direction: 'ltr'` (doc 10's board-host wrapper) unless the game opts in to mirroring.** The board's accessibility element (doc 08's `BoardCanvas`, doc 15 rule 29) sits inside it.
    *Why:* FINAL B.18.

### Buttons and Pressable

35. **Import `Pressable` only in `packages/shell/src/ui/**`** (lint ban elsewhere, verified). Screens use `PrimaryButton`, `IconButton`, `TileButton` and the other ui primitives.
    *Why:* accessibility and touch size are then solved once.
36. **Give every `Pressable` an `accessibilityRole` (lint, verified; doc 04's selector also accepts `role`, but write `accessibilityRole` to match `accessibilityState`/`accessibilityLabel`) and an accessible name made by `t()`.** Icon-only buttons take a required `label`.
    *Why:* FINAL D.46. VoiceOver and RNTL `getByRole` need both a role and a name.
37. **Make each `Pressable`'s own box at least 44 × 44 pt** (`minWidth`/`minHeight` or `width`/`height` = `MIN_TOUCH`). Do not use `hitSlop` to reach 44.
    *Why:* spec S5 and Apple's 44 × 44 pt control size. `hitSlop` is invisible in layout and can overlap neighbours. **Source:** [HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
38. **Expose state with `accessibilityState`** (`disabled`, `busy`, `selected`, `checked`), and also set `disabled` on the `Pressable`. Write pressed feedback as `style={(state) => [styles.base, state.pressed && styles.pressed]}`.
    *Why:* VoiceOver reads the state, and RNTL's `toBeDisabled` and `toBeBusy` assert it (verified). Destructuring `({ pressed })` fails doc 04's rule that boolean parameters start with `is`/`has`/… (verified).
39. **Never render a `Pressable` inside the board's `GestureDetector`.** The board canvas is the detector's only child, and Shell controls are its siblings.
    *Why:* keeps React Native's touch system and Gesture Handler apart (doc 08).
40. **Give every hold or long-press action a screen-reader alternative** (`accessibilityActions` or a confirmation dialog). Functional timers such as hold-to-confirm pass `reduceMotion: ReduceMotion.Never`.
    *Why:* a global "reduce motion" setting would otherwise make a 2-second safety hold finish instantly.

### Lists

41. **Render the levels grid as one `ScrollView` with packs as sections and every tile mounted** (`flexDirection: 'row'` plus `flexWrap: 'wrap'`). The limit is 150 tiles per screen. A game with more levels shows one pack at a time (pack tabs).
    *Why:* measured in [3.9](#39-lists-the-levels-grid): at 90 tiles, virtualization mounts no fewer tiles and finishes later.
42. **Use core `FlatList` only for lists that can grow without bound** (none in v1). FlashList is not installed, and importing it is a lint error.
    *Why:* no v1 list needs recycling, and FlashList would be a dependency Expo pins at 2.0.2 (2025-08) while npm has 2.3.2.
43. **Key list items by a stable id (the level number), never by array index.**
    *Why:* index keys remount the wrong tiles when a pack filter changes.

### Icons

44. **Store each Shell icon as one SVG path on a 24-unit grid** in `packages/shell/src/ui/icons/icon-paths.ts`, and render it with `Icon`. `Icon` rasterizes the path once per pixel size with Skia on the CPU, caches it as a PNG data URI, and shows it in a native `Image` tinted by `tintColor`.
    *Why:* spec N9 (drawn in code). 90 tiles of rasterized icons mount 4.8× faster and use 15 MB less than one Skia canvas per tile (measured in [3.10](#310-icons)). `Icon` also flips the directional icons in RTL, so no separate `DirectionalIcon` wrapper exists (doc 10 section 3.11 points here).
45. **Use a Skia `<Canvas>` only for multi-colour or animated art** (logo, result stars, how-to-play pictures) and for boards. Keep at most 8 canvases per screen outside the board, and never one per list item.
    *Why:* each canvas costs about 0.18 MB and about 2.8 ms to mount (measured).
46. **Never draw UI icons with react-native-svg, emoji, icon fonts or image files.**
    *Why:* react-native-svg adds a native pod and `fetch()`-based remote SVG loading, which the N3 audit would have to allowlist. Spec 8.12 bans emoji. Image files break N9.

### Layout, dark mode, motion, errors

47. **Never import `Dimensions` and never assume portrait or phone.** Size from `useWindowDimensions()` / `useWindowClass()` or from the container's `onLayout`/`onSize`. Do layout maths in pure functions tested at the sizes in [3.11](#311-safe-areas-and-window-size).
    *Why:* iPad rotates, Split View and Stage Manager resize windows, and iOS 27 makes iPhone apps resizable (FINAL B.18).
48. **Put every Shell screen inside `ScreenFrame`:** safe areas, background, and a centred column at most 640 pt wide.
    *Why:* spec S5 and 14 (tablets get a centred layout, nothing more in v1), with one implementation.
49. **When `isLargeText` is true, stack horizontal rows vertically. Tile sizes grow with `fontScale`.**
    *Why:* spec 8.11 says to reflow, not cut off.
50. **Keep `userInterfaceStyle: 'automatic'`.** `ThemeProvider` resolves System/Light/Dark and mirrors the preference into `Appearance.setColorScheme` so that native UI matches.
    *Why:* FINAL A.7. `setColorScheme` "applies to the application and all native elements within it (Alerts, Pickers, etc.)". Without it, those follow the system scheme instead of the in-app choice. React Native 0.86 accepts `'unspecified'` to remove the override. **Source:** [Appearance](https://reactnative.dev/docs/appearance).
51. **Read reduce motion only through `useReduceMotion()`.** Never use Reanimated's `useReducedMotion()`: it is a module-load constant (verified in the 4.5.1 source). `<MotionConfig/>` at the root makes every Reanimated animation follow the Shell setting.
    *Why:* spec S11 says Reduce motion defaults to the phone's setting and can be changed live.
52. **Wrap the app root (inside `ThemeProvider`) and the game board host in `ShellErrorBoundary`.** Its fallback is `CrashScreen`, which offers exactly one way out and never retries on its own. Errors are logged through `ErrorLogPort`.
    *Why:* spec 8.14 ("never a crash loop").
53. **Catch errors that boundaries cannot see** (event handlers, promises, worklets, frame callbacks) where they happen, and log them through `ErrorLogPort`.
    *Why:* boundaries catch only render and lifecycle errors. Frame callbacks: FINAL B.15.

---

## 3. Details

### 3.1 Where things live

```
packages/shell/src/
  app/        shell-providers.tsx  shell-error-boundary.tsx  crash-screen.tsx
              system-a11y-store.ts  use-reduce-motion.ts  motion-config.tsx  use-announce.ts
              perf/   (doc 15)
  theme/      theme-types.ts  tokens.ts  theme-set.ts  theme-context.ts  use-theme.ts
              theme-provider.tsx  make-styles.ts  contrast.ts  cvd.ts   (the last two: doc 15)
              shell-colors.ts   (doc 18)
  ui/         app-text.tsx  primary-button.tsx  icon-button.tsx  tile-button.tsx
              screen-frame.tsx  window-class.ts  use-window-class.ts  use-hold-to-confirm.ts
              raised-surface.tsx  toybox-styles.ts   (doc 18)
              icons/icon-paths.ts  icons/icon-raster.ts  icons/icon.tsx
  screens/    levels/level-grid.tsx  levels/level-tile.tsx  levels/level-grid-layout.ts
              levels/use-pack-stars.ts  home/premium-entry.tsx
  testing/    render-with-shell.tsx (doc 07)  test-palette.ts
              find-inaccessible-pressables.ts  palette-checks.ts   (the last two: doc 15)
  i18n/       t-context.ts  direction-context.tsx  use-localized-text-style.ts  fonts.ts   (doc 10)
```

The layers are `ui/` (presentational, props only), then `screens/<screen>/` (screen components plus `use-<screen>-model.ts` hooks that read stores and call `t()`), then `app/` (providers, root concerns). Component tests render through doc 07's `renderWithShell` (`testing/render-with-shell.tsx`, doc 07 section 3.8.7). It uses the real English catalog (a missing message throws) and wraps doc 10's `I18nProvider` (which supplies `useT`) and `DirectionProvider`, doc 06's stores built from a seeded in-memory save, and this doc's `ThemeProvider` over `TEST_PALETTE` (section 3.6). Options set the language, direction, palette, saved settings, Premium and the fake ports.

### 3.2 Anatomy of a component

`PrimaryButton` shows most rules at once: named export, read-only props, a translated `label`, a themed `makeStyles`, the 44 pt box, role and state, and a required `testID`.

```tsx
// packages/shell/src/ui/primary-button.tsx
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { MIN_TOUCH, RADII, SPACING } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

export type PrimaryButtonProps = {
  /** Already translated. Also the accessibility label. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  /** Translated hint, only when the result of the tap is not obvious from the label. */
  readonly hint?: string;
  readonly isDisabled?: boolean;
  readonly isBusy?: boolean;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    base: {
      minHeight: MIN_TOUCH,
      minWidth: MIN_TOUCH,
      paddingInline: SPACING.xl,
      paddingBlock: SPACING.md,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.8 },
    inactive: { opacity: 0.5 },
  });
  return styles;
});

export function PrimaryButton(props: PrimaryButtonProps): ReactNode {
  const { label, onPress, testID, isDisabled = false, isBusy = false } = props;
  const styles = useStyles();
  const theme = useTheme();
  const isInactive = isDisabled || isBusy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      accessibilityState={{ disabled: isInactive, busy: isBusy }}
      disabled={isInactive}
      onPress={onPress}
      style={(state) => [
        styles.base,
        state.pressed && styles.pressed,
        isInactive && styles.inactive,
      ]}
      testID={testID}
    >
      {isBusy ? (
        <ActivityIndicator color={theme.colors.onPrimary} />
      ) : (
        <AppText text={label} variant="label" tone="onPrimary" align="center" />
      )}
    </Pressable>
  );
}
```

Its test queries by role and name, the way VoiceOver finds it (doc 07 owns the RNTL conventions):

```tsx
// packages/shell/src/ui/primary-button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PrimaryButton } from './primary-button.tsx';

describe('PrimaryButton', () => {
  it('exposes a named button and reports presses', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <PrimaryButton label="Play" onPress={onPress} testID="home.play-button" />,
    );

    await user.press(screen.getByRole('button', { name: 'Play' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('marks itself busy and ignores presses while busy', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <PrimaryButton label="Buy" onPress={onPress} testID="premium.buy-button" isBusy />,
    );

    const button = screen.getByRole('button', { name: 'Buy' });
    await user.press(button);

    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

Composition instead of flags: `TileButton` owns the touch box and the accessibility, and the caller supplies the content.

```tsx
// packages/shell/src/ui/tile-button.tsx
import { Pressable, StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { RADII } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';

export type TileButtonProps = {
  readonly label: string;
  readonly size: number;
  readonly onPress: () => void;
  readonly testID: string;
  readonly hint?: string;
  readonly children: ReactNode;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    tile: {
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
  });
  return styles;
});

/** A square button whose visual content comes from the caller (composition). */
export function TileButton(props: TileButtonProps): ReactNode {
  const { label, size, onPress, testID, children } = props;
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      onPress={onPress}
      style={(state) => [
        styles.tile,
        { width: size, height: size },
        state.pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}
```

### 3.3 Hooks and effects

Allowed effects, with the example that uses each:

| Kind | Example in this doc | Returns cleanup |
|---|---|---|
| Subscribe to an OS source | `ShellProviders` → `watchSystemA11y()` | yes |
| Push React state into a native API | `ThemeProvider` → `Appearance.setColorScheme` | no (idempotent) |
| Work tied to a focused screen | board frame callbacks and audio (`useIsFocused()` → `useGameLifecycle`, doc 08) | yes |
| Measurement | `useColdStartMark` (doc 15) | yes (cancels the frame request) |

Everything else is derived during render or done in the handler. Three patterns the lint rejects (all verified with `react-hooks` 7.1.1):

- copying a prop into state inside an effect (`set-state-in-effect`). Compute the value during render instead;
- reading `ref.current` during render (`refs`). Read refs in handlers and effects;
- declaring a component inside another component (`static-components`). Move it to its own file.

A custom hook with no effect at all is `useHoldToConfirm` (spec S11: "Reset all progress" by holding for 2 seconds). The timer is a Reanimated animation that calls back to JS when it finishes:

```ts
// packages/shell/src/ui/use-hold-to-confirm.ts
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SharedValue } from 'react-native-reanimated';

/** Spec S11 DATA: "Reset all progress" = hold the button for 2 seconds. */
export const HOLD_TO_CONFIRM_MS = 2000;

export type HoldToConfirm = {
  /** 0..1 fill for the button background; read it in an animated style. */
  readonly progress: SharedValue<number>;
  readonly handlePressIn: () => void;
  readonly handlePressOut: () => void;
};

export function useHoldToConfirm(onConfirm: () => void): HoldToConfirm {
  const progress = useSharedValue(0);
  const handlePressIn = (): void => {
    // A safety timer, not decoration: it must never be skipped by Reduce motion.
    const config = {
      duration: HOLD_TO_CONFIRM_MS,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    };
    progress.set(
      withTiming(1, config, (isFinished) => {
        if (isFinished === true) scheduleOnRN(onConfirm);
      }),
    );
  };
  const handlePressOut = (): void => {
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: 150 }));
  };
  return { progress, handlePressIn, handlePressOut };
}
```

OS state lives in a store that is subscribed once:

```ts
// packages/shell/src/app/system-a11y-store.ts
import { AccessibilityInfo } from 'react-native';
import { createStore } from 'zustand/vanilla';

export type SystemA11yState = {
  readonly isReduceMotionOn: boolean;
  readonly isScreenReaderOn: boolean;
};

/** Mirror of the OS accessibility switches. Not persisted; filled by watchSystemA11y(). */
export const systemA11yStore = createStore<SystemA11yState>()(() => ({
  isReduceMotionOn: false,
  isScreenReaderOn: false,
}));

function setMotion(isOn: boolean): void {
  systemA11yStore.setState({ isReduceMotionOn: isOn });
}

function setReader(isOn: boolean): void {
  systemA11yStore.setState({ isScreenReaderOn: isOn });
}

/** Starts listening; returns the unsubscribe function. Call once from ShellProviders. */
export function watchSystemA11y(onError: (error: unknown) => void): () => void {
  const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setMotion);
  const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
  AccessibilityInfo.isReduceMotionEnabled().then(setMotion).catch(onError);
  AccessibilityInfo.isScreenReaderEnabled().then(setReader).catch(onError);
  return () => {
    motion.remove();
    reader.remove();
  };
}
```

### 3.4 React Compiler: what it does here

`experiments.reactCompiler: true` is set by `withShell` (FINAL A.2). `babel-preset-expo` 57 compiles workspace packages as well: `react.memo_cache_sentinel` appears in the exported bundle (verified by the app-stack researcher). Running `babel-plugin-react-compiler` 1.0.0 on the files in this doc produced:

- `IconButton`: compiled to an 8-slot cache (`const $ = _c(8)`). The `<Icon>` element is rebuilt only when `icon` or `theme.colors.icon` changes. The `Pressable` is rebuilt only when `label`, `onPress`, the icon element or `testID` changes. The pressed-style function is hoisted out of the component.
- `useHoldToConfirm`: compiled, so `handlePressIn`/`handlePressOut` keep their identity until `onConfirm` changes.
- `makeStyles`: the returned `useStyles` was **not** compiled, because it is not a top-level function. Hence rule 16 and the explicit per-theme `WeakMap` cache.

To inspect a file yourself, run `@babel/core` with the plugin `babel-plugin-react-compiler` (`panicThreshold: 'none'` plus a `logger` that prints `CompileSuccess` and skip events). `babel-plugin-react-compiler` comes in through `babel-preset-expo`: do not add it to `package.json` (doc 01).

### 3.5 Zustand in components

The four domain stores (`useSettingsStore`, `useProgressStore`, `useStatsStore`, `usePremiumStore`) and their reducers belong to doc 06 (the Premium store's files are in `stores/premium/`, doc 12). Each hook takes a selector and reads a store that `createShellApp` built from the save and provided through `StoresProvider` (doc 06 section 4.2). Components read them like this.

A primitive selector (no `useShallow` needed):

```tsx
// packages/shell/src/screens/home/premium-entry.tsx

import { useT } from '@e07/shell/i18n/t-context.ts';
import { usePremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';

import type { ReactNode } from 'react';

export type PremiumEntryProps = { readonly onOpen: () => void };

export function PremiumEntry({ onOpen }: PremiumEntryProps): ReactNode {
  const t = useT();
  // Primitive selector: re-renders only when isPremium flips.
  const isPremium = usePremiumStore((state) => state.isPremium);
  if (isPremium) return null;
  return (
    <PrimaryButton
      label={t('home.premium-button.label')}
      onPress={onOpen}
      testID="home.premium-button"
    />
  );
}
```

Catalog entry (`en.json`): `"home.premium-button.label": "Premium"`.

A selector that builds an object is wrapped in `useShallow`:

```ts
// packages/shell/src/screens/levels/use-pack-stars.ts
import { useShallow } from 'zustand/shallow';

import { selectPackStars } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import type { PackStars } from '@e07/shell/stores/progress-selectors.ts';

/** The selector builds a new object each call, so useShallow is mandatory here. */
export function usePackStars(levels: readonly number[]): PackStars {
  return useProgressStore(useShallow((state) => selectPackStars(state, levels)));
}
```

The re-render guard. Doc 07's `renderWithShell` builds doc 06's real stores from an in-memory save and returns them, so the test changes state the way the app does: `dispatch` on the store, outside React. Verified in both directions: it passes, and it fails with "Expected number of calls: 1, Received: 2" once the component also subscribes to `useSettingsStore((state) => state.settings)`.

```tsx
// packages/shell/src/screens/home/premium-entry.test.tsx
import { act, screen } from '@testing-library/react-native';
import { Profiler } from 'react';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PremiumEntry } from './premium-entry.tsx';

describe('PremiumEntry', () => {
  it('does not re-render when an unrelated store changes', async () => {
    const onRender = jest.fn();
    const { stores } = await renderWithShell(
      <Profiler id="premium-entry" onRender={onRender}>
        <PremiumEntry onOpen={jest.fn()} />
      </Profiler>,
    );
    const rendersAfterMount = onRender.mock.calls.length;

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-sound', enabled: false, volume: 0 });
    });

    expect(onRender).toHaveBeenCalledTimes(rendersAfterMount);
  });

  it('disappears when Premium becomes owned', async () => {
    const { stores } = await renderWithShell(<PremiumEntry onOpen={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Premium' })).toBeOnTheScreen();

    await act(() => {
      stores.premium.getState().dispatch({ type: 'premium-granted' });
    });

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('stays hidden when the save already holds Premium', async () => {
    await renderWithShell(<PremiumEntry onOpen={jest.fn()} />, { isPremium: true });

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
```

The per-level game session is a vanilla store created by the game host and handed down through context. Read it with `useStore(sessionStore, selector)`, under the same selector rules (doc 08).

### 3.6 Theme and makeStyles

The types. A game palette fills every `ColorTokens` field for 2 modes × 2 schemes. Fonts are not in the theme: doc 10 picks them from the language of each text.

The design step chose **Toybox** ([doc 18](18-design-system-toybox.md)). Its shape language needs five fields beyond the original eleven: `sunken`, `pop`, `onPop`, `shadow` and `focus` (doc 18 section 3.1 maps every field to a Toybox paint). Each game's values are in `design/toybox/tokens.json` and its `apps/<game>/src/theme/palette.ts` (doc 18 section 9.1); colours no game repaints (gold, the sticker cut, success, toast, scrim, separators, ad neutrals) are the Shell constants in `shell-colors.ts` (doc 18 section 3.3).

```ts
// packages/shell/src/theme/theme-types.ts
export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;
export type ColorMode = 'standard' | 'colorBlind';

/** Semantic colour tokens. Each game's palette fills every token for every mode and scheme. */
export type ColorTokens = {
  readonly background: string;
  readonly surface: string;
  /** Pushed-in, disabled and empty fills: tracks, locked tiles, the pressed quiet button (doc 18). */
  readonly sunken: string;
  readonly text: string;
  readonly textMuted: string;
  readonly primary: string;
  readonly onPrimary: string;
  /** Second game paint: icon tiles, group tabs, the Premium key (doc 18). */
  readonly pop: string;
  readonly onPop: string;
  readonly border: string;
  /** Hard offset shadow under raised controls; never blurred (doc 18). */
  readonly shadow: string;
  readonly danger: string;
  /** Focus ring: 3 pt wide, 2 pt away from the control (doc 18). */
  readonly focus: string;
  readonly icon: string;
  readonly starOn: string;
  readonly starOff: string;
};

export type Palette = Readonly<Record<ColorMode, Readonly<Record<ColorScheme, ColorTokens>>>>;

/** Fonts are not in the theme: doc 10's useLocalizedTextStyle picks them from the language. */
export type Theme = {
  readonly key: string;
  readonly scheme: ColorScheme;
  readonly mode: ColorMode;
  readonly colors: ColorTokens;
};
```

```ts
// packages/shell/src/theme/tokens.ts
import type { FontWeightToken } from '@e07/shell/i18n/fonts.ts';

/** 4-point spacing scale shared by every game (spec 8.12). */
export const SPACING = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Toybox layout steps off the 4-point scale: screen gutter and the gap between blocks (doc 18). */
export const LAYOUT = { screenGutter: 20, blockGap: 14 } as const;
/** Toybox radii (doc 18): blocky, never pills; 14 is the largest control radius. */
export const RADII = { xs: 6, sm: 10, md: 14, lg: 22 } as const;
/** Outline widths (doc 18): separators, tiles and stickers, controls and panels. */
export const STROKE = { hair: 2, tile: 2.5, bold: 3 } as const;
/** Hard-shadow offsets in pt; a pressed control sinks by the same amount (doc 18). */
export const ELEVATION = {
  knob: 2,
  tile: 3,
  iconButton: 4,
  control: 5,
  hero: 6,
  dialog: 8,
} as const;
/** Apple HIG default control size: 44 x 44 pt. */
export const MIN_TOUCH = 44;
/** Menus never grow wider than this; wider windows centre the column. */
export const CONTENT_MAX_WIDTH = 640;

export type TypeRole = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TypeStyle = { readonly fontSize: number; readonly weight: FontWeightToken };

/** Sizes in points before Dynamic Type. Line height comes from the script (doc 10). */
export const TYPE_SCALE: Readonly<Record<TypeRole, TypeStyle>> = {
  display: { fontSize: 34, weight: 'bold' },
  title: { fontSize: 28, weight: 'bold' },
  heading: { fontSize: 20, weight: 'bold' },
  body: { fontSize: 17, weight: 'regular' },
  label: { fontSize: 17, weight: 'bold' },
  caption: { fontSize: 13, weight: 'regular' },
};
```

Toybox's type scale (display 38, title 30, heading 21, a new `number` role at 30, with Lilita One as the display face and Rubik as the text face) replaces `TYPE_SCALE` together with doc 10's font selection: [doc 18](18-design-system-toybox.md) section 9.2 and its open issue 2.

Four themes, built once:

```ts
// packages/shell/src/theme/theme-set.ts
import type { ColorMode, ColorScheme, Palette, Theme, ThemePreference } from './theme-types.ts';
import type { ColorSchemeName } from 'react-native';

export type ThemeSelector = { readonly scheme: ColorScheme; readonly mode: ColorMode };
export type ThemeSet = ReadonlyMap<string, Theme>;

const SCHEMES: readonly ColorScheme[] = ['light', 'dark'];
const MODES: readonly ColorMode[] = ['standard', 'colorBlind'];

function themeKey({ scheme, mode }: ThemeSelector): string {
  return `${mode}.${scheme}`;
}

/** Builds the 4 themes once at startup, so every Theme object has a stable identity. */
export function createThemeSet(palette: Palette): ThemeSet {
  const themes = new Map<string, Theme>();
  for (const scheme of SCHEMES) {
    for (const mode of MODES) {
      const key = themeKey({ scheme, mode });
      themes.set(key, { key, scheme, mode, colors: palette[mode][scheme] });
    }
  }
  return themes;
}

export function selectTheme(themes: ThemeSet, selector: ThemeSelector): Theme {
  const theme = themes.get(themeKey(selector));
  if (theme === undefined) throw new Error(`Missing theme ${themeKey(selector)}`);
  return theme;
}

export function resolveColorScheme(
  preference: ThemePreference,
  system: ColorSchemeName | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
```

Tests (doc 07's `renderWithShell`, doc 10's `t.test.tsx`, doc 15's palette checks) share one fixture palette. It passes doc 15's contrast checks:

```ts
// packages/shell/src/testing/test-palette.ts
import type { ColorTokens, Palette } from '@e07/shell/theme/theme-types.ts';

const LIGHT: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  sunken: '#E5E5EA',
  text: '#1C1C1E',
  textMuted: '#5A5A60',
  primary: '#1F5FBF',
  onPrimary: '#FFFFFF',
  pop: '#FFCC00',
  onPop: '#1C1C1E',
  border: '#8E8E93',
  shadow: '#1C1C1E',
  danger: '#B3261E',
  focus: '#C8157A',
  icon: '#1C1C1E',
  starOn: '#8A5A00',
  starOff: '#6E6E73',
};
const DARK: ColorTokens = {
  background: '#000000',
  surface: '#1C1C1E',
  sunken: '#2C2C2E',
  text: '#F2F2F7',
  textMuted: '#AEAEB2',
  primary: '#6FA8FF',
  onPrimary: '#000000',
  pop: '#FFD60A',
  onPop: '#000000',
  border: '#8E8E93',
  shadow: '#000000',
  danger: '#FF8A80',
  focus: '#FF8AD8',
  icon: '#F2F2F7',
  starOn: '#FFC94D',
  starOff: '#8E8E93',
};

/** Fixture palette for tests; real palettes come from each game module. */
export const TEST_PALETTE: Palette = {
  standard: { light: LIGHT, dark: DARK },
  colorBlind: { light: LIGHT, dark: DARK },
};
```

```ts
// packages/shell/src/theme/theme-context.ts
import { createContext } from 'react';

import type { Theme } from './theme-types.ts';

export const ThemeContext = createContext<Theme | null>(null);
```

```ts
// packages/shell/src/theme/use-theme.ts
import { use } from 'react';

import { ThemeContext } from './theme-context.ts';

import type { Theme } from './theme-types.ts';

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (theme === null) throw new Error('useTheme() outside ThemeProvider');
  return theme;
}
```

The provider. The effect is the "push into a native API" kind. `useColorScheme()` is typed `'light' | 'dark' | 'unspecified'` in React Native 0.86, and `resolveColorScheme` treats anything other than `'dark'` as light:

```tsx
// packages/shell/src/theme/theme-provider.tsx
import { useEffect } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { selectThemePreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { ThemeContext } from './theme-context.ts';
import { resolveColorScheme, selectTheme } from './theme-set.ts';

import type { ThemeSet } from './theme-set.ts';
import type { ReactNode } from 'react';

export type ThemeProviderProps = { readonly themes: ThemeSet; readonly children: ReactNode };

export function ThemeProvider({ themes, children }: ThemeProviderProps): ReactNode {
  const preference = useSettingsStore(selectThemePreference);
  const isColorBlind = useSettingsStore((state) => state.settings.colorBlind);
  const systemScheme = useColorScheme();

  // Allowed effect: keeps a NATIVE system (alerts, pickers, consent form) in sync.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  const theme = selectTheme(themes, {
    scheme: resolveColorScheme(preference, systemScheme),
    mode: isColorBlind ? 'colorBlind' : 'standard',
  });
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}
```

`makeStyles`. The factory calls `StyleSheet.create` itself and uses the block-body shape from rule 23. Both were chosen after testing the alternatives (details in [Verified](#verified)):

```ts
// packages/shell/src/theme/make-styles.ts
import { useTheme } from './use-theme.ts';

import type { Theme } from './theme-types.ts';

/**
 * const useStyles = makeStyles((theme) => StyleSheet.create({ ... }));
 * The factory calls StyleSheet.create itself: that keeps RN's excess-property check
 * (typos fail tsc) and the N11 / colour-literal lint selectors, which match StyleSheet.create.
 * Styles are built once per Theme object (4 per app), so their identity is stable.
 */
export function makeStyles<TStyles extends object>(
  factory: (theme: Theme) => TStyles,
): () => TStyles {
  const cache = new WeakMap<Theme, TStyles>();
  return function useStyles(): TStyles {
    const theme = useTheme();
    const cached = cache.get(theme);
    if (cached !== undefined) return cached;
    const created = factory(theme);
    cache.set(theme, created);
    return created;
  };
}
```

Usage: see `screen-frame.tsx` in [3.11](#311-safe-areas-and-window-size) and `primary-button.tsx` in [3.2](#32-anatomy-of-a-component). The component always writes `const styles = useStyles();`.

### 3.7 AppText and typography

Doc 10 owns the i18n core (`useLocalizedTextStyle`: direction, alignment, script font, line height). This doc owns the rest of `AppText`: type roles, tones, the header role, the 200% cap and `accessibilityLanguage`. Doc 10's `<T>` takes `AppTextProps` without `text` and `language`, so it is written `<T id="levels.pack.title" values={{ pack: 2 }} variant="heading" isHeader />`.

```tsx
// packages/shell/src/ui/app-text.tsx
import { Text } from 'react-native';

import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { TYPE_SCALE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { TextAlignToken } from '@e07/shell/i18n/use-localized-text-style.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { TypeRole } from '@e07/shell/theme/tokens.ts';
import type { ReactNode } from 'react';

export type TextTone = 'default' | 'muted' | 'onPrimary' | 'danger';

export type AppTextProps = {
  /** Always the output of t(), a formatter, or an autonym. Never a literal. */
  readonly text: string;
  readonly variant?: TypeRole;
  readonly tone?: TextTone;
  readonly align?: TextAlignToken;
  /** Only for text in another language than the UI (the language list, doc 10). */
  readonly language?: Language;
  readonly numberOfLines?: number;
  readonly isHeader?: boolean;
  readonly testID?: string;
};

function toneColor(theme: Theme, tone: TextTone): string {
  switch (tone) {
    case 'default':
      return theme.colors.text;
    case 'muted':
      return theme.colors.textMuted;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'danger':
      return theme.colors.danger;
  }
}

/** The only component that renders text. Direction, alignment, font and line height: doc 10. */
export function AppText(props: AppTextProps): ReactNode {
  const { text, variant = 'body', tone = 'default', align = 'start', language } = props;
  const theme = useTheme();
  const { fontSize, weight } = TYPE_SCALE[variant];
  const localized = useLocalizedTextStyle({
    fontSize,
    weight,
    align,
    ...(language === undefined ? {} : { language }),
  });
  return (
    <Text
      style={[localized, { color: toneColor(theme, tone) }]}
      maxFontSizeMultiplier={2}
      {...(language === undefined ? {} : { accessibilityLanguage: language })}
      {...(props.numberOfLines === undefined ? {} : { numberOfLines: props.numberOfLines })}
      {...(props.isHeader === true ? { accessibilityRole: 'header' as const } : {})}
      {...(props.testID === undefined ? {} : { testID: props.testID })}
    >
      {text}
    </Text>
  );
}
```

Type scale (points before Dynamic Type; line height = size × 1.3 for Latin and × 1.5 for Arabic script, from doc 10's `fonts.ts`):

| Role | Size | Weight | Typical use |
|---|---|---|---|
| display | 34 | bold | result screen title |
| title | 28 | bold | screen titles |
| heading | 20 | bold | section and pack headers, tile numbers |
| body | 17 | regular | running text (iOS body size) |
| label | 17 | bold | button labels |
| caption | 13 | regular | small print (S12) |

Toybox ([doc 18](18-design-system-toybox.md) section 3.6) sets display 38, title 30 and heading 21 in Lilita One, adds `number` (30), and uses Rubik for body, label and caption; the switch waits for doc 10's font selection (doc 18 open issue 2).

Rich text (a bold number inside a sentence) goes through doc 10's message formatting, not through nested `AppText`.

### 3.8 Buttons and Pressable

```tsx
// packages/shell/src/ui/icon-button.tsx
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

export type IconButtonProps = {
  readonly icon: IconName;
  /** Required: an icon-only button has no visible text for VoiceOver to read. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
};

const styles = StyleSheet.create({
  // The touch box itself is 44 x 44 pt; the 24 pt glyph sits in the middle. No hitSlop.
  box: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});

export function IconButton({ icon, label, onPress, testID }: IconButtonProps): ReactNode {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => [styles.box, state.pressed && styles.pressed]}
      testID={testID}
    >
      <Icon name={icon} color={theme.colors.icon} />
    </Pressable>
  );
}
```

```tsx
// packages/shell/src/ui/icon-button.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { MIN_TOUCH } from '@e07/shell/theme/tokens.ts';

import { IconButton } from './icon-button.tsx';

describe('IconButton', () => {
  it('gives an icon-only button a name and a 44 x 44 pt touch box', async () => {
    await renderWithShell(
      <IconButton icon="gear" label="Settings" onPress={jest.fn()} testID="home.settings-button" />,
    );

    expect(screen.getByRole('button', { name: 'Settings' })).toHaveStyle({
      width: MIN_TOUCH,
      height: MIN_TOUCH,
    });
  });
});
```

Button checklist, per `Pressable`:

| Prop | Value |
|---|---|
| `accessibilityRole` | `button` (or `switch`, `tab`, `link` where true) |
| `accessibilityLabel` | the translated visible text, or the required `label` for icon-only buttons |
| `accessibilityHint` | only when the result is not obvious from the label, and translated |
| `accessibilityState` | `{ disabled, busy }`, plus `selected`/`checked` for toggles and tabs |
| size | own box ≥ 44 × 44 pt (`MIN_TOUCH`) |
| `testID` | `<screen>.<element>` in kebab-case |
| feedback | `style={(state) => [styles.base, state.pressed && styles.pressed]}` (not `({ pressed })`, rule 38) |

### 3.9 Lists: the levels grid

**The decision.** One `ScrollView`, packs as sections, every tile mounted. Not FlatList, not FlashList.

**The evidence** was measured on 2026-09-26 with a Release build on the iOS 26.5 simulator (iPhone 17 Pro, Apple silicon Mac, New Architecture, Hermes). There were 90 tiles of 72 pt, each a `Pressable` with a number and three stars plus a lock. Each variant was cold-launched 6 times with the first run dropped, and the table shows medians. `phys_footprint` comes from `footprint <pid>`.

| Variant (icons as) | Render → first frame | Render → last tile laid out | Tiles laid out after 1.5 s | Footprint |
|---|---|---|---|---|
| no grid (baseline) | 17 ms | — | 0 | 42 MB |
| **ScrollView (Views)** | **16–26 ms** | **26 ms** | 90 | **49–50 MB** |
| FlatList `numColumns` (Views) | 30 ms | 40 ms | 90 | 50 MB |
| FlashList 2.0.2 `numColumns` (Views) | 22 ms | 40 ms | 85 | 51 MB |
| **ScrollView (rasterized icon images)** | 21 ms | 58 ms | 90 | 51 MB |
| FlashList (rasterized icon images) | 27 ms | 67 ms | 85 | 51 MB |
| ScrollView (one Skia canvas per tile) | 61 ms | 264–280 ms | 90 | 66 MB |
| FlatList (one Skia canvas per tile) | 95 ms | 189 ms | 90 | 65 MB |
| FlashList (one Skia canvas per tile) | 53 ms | 204 ms | 85 | 63 MB |

What the numbers say:

- At 90 items, virtualization saves nothing. FlatList still mounted all 90 tiles (its default `windowSize` of 21 viewports covers the whole grid), FlashList mounted 85, and both finished laying out later than the plain `ScrollView`. **Source:** [Optimizing FlatList](https://reactnative.dev/docs/optimizing-flatlist-configuration).
- A virtualized list also costs more code and more risk: section headers need row-chunking (`SectionList` has no `numColumns`), scrolling to a level needs `getItemLayout`, and a recycled cell can keep stale state.
- All three layouts mirror correctly under forced RTL, with level 1 at the top right (screenshots checked).
- The simulator is not a device. On a phone the absolute numbers are larger, but the ordering holds. Doc 15's budgets keep an eye on the real screen.

Tile testIDs are `levels.level-tile.<n>` (doc 03). When a game has more than 150 levels (`levelGridTilesMax` in `quality-gates.json`, doc 15), the Levels screen switches to pack tabs, so one pack of about 30 tiles is mounted at a time. That keeps the `ScrollView` decision valid without a virtualized list.

```ts
// packages/shell/src/screens/levels/level-grid-layout.ts
import { MIN_TOUCH, SPACING } from '@e07/shell/theme/tokens.ts';

export const TILE_GAP = SPACING.sm;
const MIN_TILE = 64;
const MIN_COLUMNS = 3;
const MAX_COLUMNS = 8;

/** Pure: tile edge length for the grid width. Large text gets bigger tiles, never < 44 pt. */
export function levelTileSize(gridWidth: number, fontScale: number): number {
  const minTile = Math.max(MIN_TOUCH, Math.round(MIN_TILE * Math.max(1, fontScale)));
  const fits = Math.floor((gridWidth + TILE_GAP) / (minTile + TILE_GAP));
  const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, fits));
  return Math.floor((gridWidth - TILE_GAP * (columns - 1)) / columns);
}
```

```tsx
// packages/shell/src/screens/levels/level-tile.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { TileButton } from '@e07/shell/ui/tile-button.tsx';

import type { ReactNode } from 'react';

export type TileView = {
  readonly level: number;
  /** The level number in the chosen digits, from doc 10's createNumberFormatter (screen hook). */
  readonly numberText: string;
  readonly stars: 0 | 1 | 2 | 3;
  readonly isLocked: boolean;
};
export type LevelTileProps = {
  readonly tile: TileView;
  readonly size: number;
  readonly onSelect: (level: number) => void;
};

const STAR_SLOTS = [1, 2, 3] as const;
const styles = StyleSheet.create({ stars: { flexDirection: 'row' } });

export function LevelTile({ tile, size, onSelect }: LevelTileProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  const label = tile.isLocked
    ? t('levels.level-tile.locked.a11y-label', { level: tile.level })
    : t('levels.level-tile.a11y-label', { level: tile.level, starsCount: tile.stars });
  const handlePress = (): void => {
    onSelect(tile.level);
  };
  return (
    <TileButton
      label={label}
      size={size}
      onPress={handlePress}
      testID={`levels.level-tile.${String(tile.level)}`}
      {...(tile.isLocked ? { hint: t('levels.level-tile.locked.a11y-hint') } : {})}
    >
      <AppText text={tile.numberText} variant="heading" align="center" />
      {tile.isLocked ? (
        <Icon name="lock" color={theme.colors.icon} size={16} />
      ) : (
        <View style={styles.stars}>
          {STAR_SLOTS.map((slot) => (
            <Icon
              key={slot}
              name={slot <= tile.stars ? 'star-filled' : 'star-outline'}
              color={slot <= tile.stars ? theme.colors.starOn : theme.colors.starOff}
              size={16}
            />
          ))}
        </View>
      )}
    </TileButton>
  );
}
```

Catalog entries (`en.json`). There are no literal digits, and counts are plurals (doc 10's catalog linter):

```json
{
  "levels.level-tile.a11y-label": "Level {level, number}: {starsCount, plural, =0 {no stars yet} one {# star} other {# stars}}",
  "levels.level-tile.locked.a11y-hint": "Shows how to unlock this level.",
  "levels.level-tile.locked.a11y-label": "Level {level, number}, locked"
}
```

```tsx
// packages/shell/src/screens/levels/level-grid.tsx
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CONTENT_MAX_WIDTH, SPACING } from '@e07/shell/theme/tokens.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { TILE_GAP, levelTileSize } from './level-grid-layout.ts';
import { LevelTile } from './level-tile.tsx';

import type { TileView } from './level-tile.tsx';
import type { ReactNode } from 'react';

/** Built by the screen hook from the progress store; strings already translated or formatted. */
export type PackView = {
  readonly id: string;
  readonly title: string;
  readonly progressLabel: string;
  readonly tiles: readonly TileView[];
};
export type LevelGridProps = {
  readonly packs: readonly PackView[];
  readonly onSelectLevel: (level: number) => void;
};

const styles = StyleSheet.create({
  content: { paddingBlock: SPACING.lg, gap: SPACING.xl },
  pack: { gap: SPACING.sm },
  // Row + wrap follows the layout direction: level 1 is top-left in LTR, top-right in RTL.
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },
});

/** All tiles mounted (no virtualization): about 90 tiles, measured in 05-components. */
export function LevelGrid({ packs, onSelectLevel }: LevelGridProps): ReactNode {
  const { width, fontScale } = useWindowDimensions();
  const gridWidth = Math.min(width, CONTENT_MAX_WIDTH) - SPACING.lg * 2;
  const tileSize = levelTileSize(gridWidth, fontScale);
  return (
    <ScrollView contentContainerStyle={styles.content} testID="levels.grid">
      {packs.map((pack) => (
        <View key={pack.id} style={styles.pack}>
          <AppText text={pack.title} variant="heading" isHeader />
          <AppText text={pack.progressLabel} tone="muted" />
          <View style={styles.tiles}>
            {pack.tiles.map((tile) => (
              <LevelTile key={tile.level} tile={tile} size={tileSize} onSelect={onSelectLevel} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
```

```ts
// packages/shell/src/screens/levels/level-grid-layout.test.ts
import { levelTileSize } from './level-grid-layout.ts';

describe('levelTileSize', () => {
  it('fits five 64 pt tiles on a 370 pt phone column', () => {
    expect(levelTileSize(370, 1)).toBe(67);
  });

  it('keeps tiles at least 44 pt at 200% text on the narrowest window', () => {
    expect(levelTileSize(288, 2)).toBeGreaterThanOrEqual(44);
  });

  it('caps a wide iPad column at eight tiles per row', () => {
    const size = levelTileSize(608, 1);
    expect(size * 8).toBeLessThanOrEqual(608);
  });
});
```

### 3.10 Icons

**The decision.** Icon geometry is data: one SVG path per icon on a 24-unit grid, drawn with the nonzero fill rule. `Icon` rasterizes the path with Skia on the CPU (`Skia.Surface.Make`) into a white PNG at the exact pixel size (`size × PixelRatio.get()`), caches it as a `data:image/png;base64,…` URI, and shows it in a native `Image` tinted with `tintColor`. Colour comes from the theme at display time, so a theme change never re-rasterizes. React Native decodes `data:` URIs locally (`RCTDataRequestHandler` reads them with `NSData dataWithContentsOfURL`), so no network is involved.

| Option | Verdict | Evidence |
|---|---|---|
| Skia `<Canvas>` per icon | Rejected for repeated icons, allowed for ≤ 8 art pieces per screen | 90 tiles: 264–280 ms to lay out and +16 MB (≈ 0.18 MB and ≈ 2.8 ms per canvas) |
| **Skia path → rasterized `Image` + `tintColor`** | **Chosen** | 90 tiles: 58 ms, +1–2 MB. Rasterizing 2 icons took 0.4 ms |
| react-native-svg 15.15.4 | Rejected | New native pod (`RNSVG.podspec`). `src/utils/fetchData.ts` calls `fetch(uri)` for `SvgUri`, which is new network code for the N3 audit. It also duplicates Skia |
| Plain `View`s | Only for trivial shapes (dots, bars, progress fills) | Cannot draw a gear, crown or speaker |
| Emoji, icon fonts, image files | Rejected | Spec 8.12 bans emoji. Fonts and files are not "drawn in code" (N9) |

Icons at 24 pt on a 3× screen become 72 px PNGs of about 0.3–1.4 KB (measured). The same path data feeds headless Skia for store art (FINAL B.22).

```ts
// packages/shell/src/ui/icons/icon-paths.ts
/**
 * Every Shell icon: one SVG path on a 24 x 24 grid, filled with the nonzero rule
 * (draw holes counter-clockwise). Single colour: the colour comes from tintColor.
 * Pure data: the same paths feed headless Skia for store art (FINAL-DECISIONS 22).
 */
export const ICON_PATHS = {
  back: 'M15.4 4.6 17 6.2 11.2 12l5.8 5.8-1.6 1.6L8 12z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z',
  'star-filled': 'M12 2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.1 6 20.4l1.3-6.7-5-4.7 6.8-.8z',
  'star-outline':
    'M12 2l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.1 6 20.4l1.3-6.7-5-4.7 6.8-.8zm0 4.7-1.6 3.4-3.7.4 2.7 2.6-.7 3.7 3.3-1.8 3.3 1.8-.7-3.7 2.7-2.6-3.7-.4z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Icons that point along the reading direction flip in RTL (spec 7.5). */
export const DIRECTIONAL_ICONS: ReadonlySet<IconName> = new Set<IconName>(['back']);
```

```ts
// packages/shell/src/ui/icons/icon-raster.ts
import { Skia } from '@shopify/react-native-skia';

import { ICON_PATHS } from './icon-paths.ts';

import type { IconName } from './icon-paths.ts';

const GRID = 24;
const cache = new Map<string, string>();
const fill = Skia.Paint();
fill.setColor(Skia.Color('#FFFFFF'));
fill.setAntiAlias(true);

function rasterize(svgPath: string, px: number): string {
  const surface = Skia.Surface.Make(px, px);
  const path = Skia.Path.MakeFromSVGString(svgPath);
  if (surface === null || path === null) throw new Error('Icon rasterization failed');
  const canvas = surface.getCanvas();
  canvas.scale(px / GRID, px / GRID);
  canvas.drawPath(path, fill);
  surface.flush();
  return `data:image/png;base64,${surface.makeImageSnapshot().encodeToBase64()}`;
}

/** A white PNG (tinted later by <Image tintColor>) per icon and pixel size, cached forever. */
export function getIconUri(name: IconName, sizePt: number, pixelRatio: number): string {
  const px = Math.ceil(sizePt * pixelRatio);
  const key = `${name}@${String(px)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const uri = rasterize(ICON_PATHS[name], px);
  cache.set(key, uri);
  return uri;
}
```

```tsx
// packages/shell/src/ui/icons/icon.tsx
import { Image, PixelRatio, StyleSheet } from 'react-native';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';

import { DIRECTIONAL_ICONS } from './icon-paths.ts';
import { getIconUri } from './icon-raster.ts';

import type { IconName } from './icon-paths.ts';
import type { ReactNode } from 'react';

export type IconProps = {
  readonly name: IconName;
  readonly color: string;
  readonly size?: number;
};

const styles = StyleSheet.create({ flipped: { transform: [{ scaleX: -1 }] } });

/** Decorative: the button or row around an icon carries the accessibility label. */
export function Icon({ name, color, size = 24 }: IconProps): ReactNode {
  const direction = useDirection();
  const isFlipped = direction === 'rtl' && DIRECTIONAL_ICONS.has(name);
  return (
    <Image
      source={{ uri: getIconUri(name, size, PixelRatio.get()), width: size, height: size }}
      tintColor={color}
      style={[{ width: size, height: size }, isFlipped && styles.flipped]}
    />
  );
}
```

Testing. Skia's JSI module does not load in the `unit` Jest project ("Native Skia Module failed to correctly install JSI Bindings!", verified). So the unit setup mocks the rasterizer, and a `golden` test (the CanvasKit environment, doc 07) checks the real one:

```ts
// jest.setup.ts (unit project): the lines this doc adds
jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: () => 'data:image/png;base64,',
}));
```

```ts
// packages/shell/src/ui/icons/icon-raster.golden.test.ts
import { ICON_PATHS } from './icon-paths.ts';
import { getIconUri } from './icon-raster.ts';

import type { IconName } from './icon-paths.ts';

const names = Object.keys(ICON_PATHS) as IconName[];

describe('getIconUri', () => {
  it.each(names)('rasterizes %s to a PNG data URI and caches it', (name) => {
    const uri = getIconUri(name, 24, 3);
    expect(uri).toMatch(/^data:image\/png;base64,iVBORw0KGgo/);
    expect(getIconUri(name, 24, 3)).toBe(uri);
  });
});
```

A new icon means adding a path to `ICON_PATHS`, rendering a contact sheet with the golden project (headless Skia, black on white), and looking at the PNG with the Read tool before committing.

### 3.11 Safe areas and window size

```tsx
// packages/shell/src/ui/screen-frame.tsx
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { CONTENT_MAX_WIDTH, SPACING } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';
import type { Edge } from 'react-native-safe-area-context';

export type ScreenFrameProps = {
  readonly children: ReactNode;
  readonly testID: string;
  /** Physical edges on purpose: the notch and home indicator do not mirror in RTL. */
  readonly edges?: readonly Edge[];
};

const ALL_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center' },
    column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH, paddingInline: SPACING.lg },
  });
  return styles;
});

/** Every Shell screen's outermost view: safe areas, background, centred max-width column. */
export function ScreenFrame({ children, testID, edges = ALL_EDGES }: ScreenFrameProps): ReactNode {
  const styles = useStyles();
  return (
    <SafeAreaView edges={edges} style={styles.root} testID={testID}>
      <View style={styles.column}>{children}</View>
    </SafeAreaView>
  );
}
```

```ts
// packages/shell/src/ui/window-class.ts
export type WindowClass = {
  readonly width: 'compact' | 'regular';
  readonly isLandscape: boolean;
  /** Dynamic Type at "Extra Extra Extra Large" (1.353) or above: stack, don't squeeze. */
  readonly isLargeText: boolean;
};

export const REGULAR_WIDTH_MIN = 600;
export const LARGE_TEXT_SCALE = 1.35;

/** Pure: test it at 320, 402, 744, 874, 1032 and 1376 pt wide (see the size table). */
export function classifyWindow(width: number, height: number, fontScale: number): WindowClass {
  return {
    width: width >= REGULAR_WIDTH_MIN ? 'regular' : 'compact',
    isLandscape: width > height,
    isLargeText: fontScale >= LARGE_TEXT_SCALE,
  };
}
```

```ts
// packages/shell/src/ui/use-window-class.ts
import { useWindowDimensions } from 'react-native';

import { classifyWindow } from './window-class.ts';

import type { WindowClass } from './window-class.ts';

/** Re-renders on rotation, iPad split view / Stage Manager and iOS 27 resizable windows. */
export function useWindowClass(): WindowClass {
  const { width, height, fontScale } = useWindowDimensions();
  return classifyWindow(width, height, fontScale);
}
```

```ts
// packages/shell/src/ui/window-class.test.ts
import { classifyWindow } from './window-class.ts';

describe('classifyWindow', () => {
  it.each([
    { width: 320, height: 568, widthClass: 'compact', isLandscape: false },
    { width: 402, height: 874, widthClass: 'compact', isLandscape: false },
    { width: 874, height: 402, widthClass: 'regular', isLandscape: true },
    { width: 744, height: 1133, widthClass: 'regular', isLandscape: false },
    { width: 1376, height: 1032, widthClass: 'regular', isLandscape: true },
  ] as const)('classifies $width x $height pt', ({ width, height, widthClass, isLandscape }) => {
    expect(classifyWindow(width, height, 1)).toMatchObject({ width: widthClass, isLandscape });
  });

  it('flags large text from Dynamic Type xxxLarge (1.353) upwards', () => {
    expect(classifyWindow(402, 874, 1.353).isLargeText).toBe(true);
    expect(classifyWindow(402, 874, 1.235).isLargeText).toBe(false);
  });
});
```

Sizes that pure layout functions and screenshot runs must cover (points):

| Window | Size | Why |
|---|---|---|
| Narrow iPad Split View or Slide Over pane, small phone | 320 × 568 | the narrowest window the app can get |
| iPhone 17 Pro portrait | 402 × 874 | the baseline device (screenshot 1206 × 2622 px at 3×) |
| iPhone 17 Pro landscape | 874 × 402 | rotation, iOS 27 resizable windows |
| iPad mini portrait | 744 × 1133 | the smallest regular width |
| iPad Pro 13-inch landscape | 1376 × 1032 | the widest window; the column caps at 640 pt |
| any of the above at `fontScale` 2 | — | the 200% text pass (doc 15) |

Boards size themselves from the canvas (`onSize`), never from the window (FINAL B.18). The Game screen puts side panels next to the board when `isLandscape && width === 'regular'` (spec S5).

### 3.12 ESLint additions owned by this doc

These rules live in doc 04's one `eslint.config.mjs`: see [doc 04 section 3](04-code-style-and-limits.md#3-eslint-the-complete-eslintconfigmjs) (merged 2026-09-26). They are the UI-primitive bans (`UI_PATHS`: `Pressable`, `Image`, `Dimensions`, `Animated`, `useMemo`/`useCallback`/`memo`, `react-native-svg`, `@shopify/flash-list`), the `storeWithoutSelector` selector, raw `Pressable` only in `ui/` and raw `Image` only in `ui/icons/icon.tsx`, the presentational `ui/` boundary (`UI_BOUNDARY`: port types yes, stores, screens and adapters no) and docs/15's `PERF_CLOCK_FILES`. Re-run against the merged file on 2026-09-26: a bad screen (`useMemo`, `Pressable`, bare `useSettingsStore()`) and a bad `ui/` file (`Image`, a store import) fail, a port type in `ui/` passes. The Shell rules this doc relies on beyond them (`Text` and `SafeAreaView` bans, the style-scoped left/right selector, `textAlignLiteral`, `rowReverse`, `a11yLiteral`, `pressableA11y`, `testIdFormat`, `asyncHandler`, colour-literal and unused-style rules, the `react-hooks` escalations) were already there.

### 3.13 Reduce motion

```ts
// packages/shell/src/app/use-reduce-motion.ts
import { useStore } from 'zustand';

import { selectReduceMotionPreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { systemA11yStore } from './system-a11y-store.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** Settings row "Reduce motion" defaults to the phone's switch (spec S11). */
export function resolveReduceMotion(
  preference: SaveSettings['reduceMotion'],
  isSystemOn: boolean,
): boolean {
  if (preference === 'system') return isSystemOn;
  return preference === 'on';
}

export function useReduceMotion(): boolean {
  const preference = useSettingsStore(selectReduceMotionPreference);
  const isSystemOn = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
  return resolveReduceMotion(preference, isSystemOn);
}
```

```tsx
// packages/shell/src/app/motion-config.tsx
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

import { useReduceMotion } from './use-reduce-motion.ts';

import type { ReactNode } from 'react';

/** Makes every Reanimated animation follow the Shell setting, not only the OS switch. */
export function MotionConfig(): ReactNode {
  const isReduced = useReduceMotion();
  return <ReducedMotionConfig mode={isReduced ? ReduceMotion.Always : ReduceMotion.Never} />;
}
```

`ReducedMotionConfig` sets Reanimated's global flag, so every `withTiming`/`withSpring`/layout animation that keeps the default `reduceMotion: ReduceMotion.System` follows the Shell setting. In development builds it logs one warning, "Reduced motion setting is overwritten with mode …", which is expected. Board animations do not go through it. They use `buildTimeline(events, isReduced ? 'reduced' : 'full')` (FINAL B.12, doc 08). **Source:** [ReducedMotionConfig](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/), [useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/).

### 3.14 Error boundaries and the provider stack

```tsx
// packages/shell/src/app/shell-error-boundary.tsx
// The ONLY class component in the codebase: React 19 has no hook for error boundaries.
import { Component } from 'react';

import type { ErrorInfo, ReactNode } from 'react';

export type ShellErrorBoundaryProps = {
  readonly children: ReactNode;
  /** Writes to ErrorLogPort (local only, spec 8.14). Must not throw. */
  readonly onError: (error: unknown, componentStack: string) => void;
  readonly renderFallback: (reset: () => void) => ReactNode;
};

type BoundaryState = { readonly hasError: boolean };

export class ShellErrorBoundary extends Component<ShellErrorBoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError(error, info.componentStack ?? '');
  }

  private readonly reset = (): void => {
    this.setState({ hasError: false });
  };

  override render(): ReactNode {
    return this.state.hasError ? this.props.renderFallback(this.reset) : this.props.children;
  }
}
```

```tsx
// packages/shell/src/app/crash-screen.tsx

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { PrimaryButton } from '@e07/shell/ui/primary-button.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import type { ReactNode } from 'react';

export type CrashScreenProps = { readonly onGoHome: () => void };

/** Fallback UI: a gentle message and one way out. Never retries on its own (no crash loop). */
export function CrashScreen({ onGoHome }: CrashScreenProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="crash.screen">
      <AppText text={t('dialog.crash.title')} variant="title" isHeader />
      <AppText text={t('dialog.crash.body')} />
      <PrimaryButton
        label={t('dialog.crash.home-button.label')}
        onPress={onGoHome}
        testID="crash.home-button"
      />
    </ScreenFrame>
  );
}
```

Catalog keys (doc 03 allows `dialog` as a Shell first segment; the fallback is not a route): `dialog.crash.title`, `dialog.crash.body`, `dialog.crash.home-button.label`.

```tsx
// packages/shell/src/app/shell-providers.tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@e07/shell/theme/theme-provider.tsx';

import { CrashScreen } from './crash-screen.tsx';
import { MotionConfig } from './motion-config.tsx';
import { ShellErrorBoundary } from './shell-error-boundary.tsx';
import { watchSystemA11y } from './system-a11y-store.ts';

import type { ThemeSet } from '@e07/shell/theme/theme-set.ts';
import type { ReactNode } from 'react';

export type ShellProvidersProps = {
  readonly themes: ThemeSet;
  readonly onError: (error: unknown, componentStack: string) => void;
  readonly children: ReactNode;
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export function ShellProviders({ themes, onError, children }: ShellProvidersProps): ReactNode {
  // Allowed effect: subscribe to an external system, return the unsubscribe.
  useEffect(
    () =>
      watchSystemA11y((error) => {
        onError(error, 'watchSystemA11y');
      }),
    [onError],
  );
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider themes={themes}>
          <MotionConfig />
          <ShellErrorBoundary
            onError={onError}
            renderFallback={(reset) => <CrashScreen onGoHome={reset} />}
          >
            {children}
          </ShellErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

The game host places a second `ShellErrorBoundary` around the board. Its `onError` logs the error and tells the `GameSession` to show Home, so a broken board never takes down navigation (doc 08 owns that wiring). Neither boundary retries by itself. A crash that repeats on the same saved run must end at Home with the run intact, never in a loop (spec 8.14).

---

## 4. Checklist

Before calling component work done:

- [ ] `npm run check:fast` is green. That covers every rule in this doc marked "lint", including the additions in 3.12.
- [ ] No new file under `packages/shell/src/ui/` imports `stores/`, `screens/` or `services/` (port types `*-port.ts` excepted).
- [ ] Every new interactive element has a role, a translated name, a `testID`, and a box of at least 44 pt. Its screen test ends with `expect(findInaccessiblePressables(screen.container)).toStrictEqual([])` (doc 15).
- [ ] Every user-visible string comes from `t()`. `npm run i18n:verify` is green.
- [ ] No `useMemo`, `useCallback`, `memo`, `.value` or `'use no memo'` was added, unless an Open-issues entry and a measurement justify it.
- [ ] Store reads use selectors. Any object-building selector uses `useShallow`. Hot components have a `<Profiler>` test.
- [ ] No effect calls a state setter synchronously, and every subscribing effect returns a cleanup.
- [ ] Styles use theme tokens and logical keys only. `makeStyles` uses the `const styles = StyleSheet.create(…); return styles;` shape.
- [ ] Layout functions have tests at the sizes in 3.11 and at `fontScale` 2.
- [ ] Icons are paths in `ICON_PATHS`, a contact sheet was inspected, and no screen has more than 8 Skia canvases outside the board.
- [ ] Screens were checked in the screenshot matrix: LTR/RTL, light/dark, phone/tablet, 200% text (doc 07, doc 15).

---

## 5. Sources

- React: [Component (error boundaries)](https://react.dev/reference/react/Component) · [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · [React Compiler](https://react.dev/learn/react-compiler) · ['use no memo'](https://react.dev/reference/react-compiler/directives/use-no-memo) · [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) · [Rules of React](https://react.dev/reference/rules) · [Profiler](https://react.dev/reference/react/Profiler) · [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- Expo: [React Compiler guide](https://docs.expo.dev/guides/react-compiler/) · [Localization (RTL, textAlign)](https://docs.expo.dev/guides/localization/) · [Monorepos](https://docs.expo.dev/guides/monorepos/) · [SDK 57 bundledNativeModules.json](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json)
- React Native: [Layout props](https://reactnative.dev/docs/layout-props) · [useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions) · [Appearance](https://reactnative.dev/docs/appearance) · [AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo) · [Accessibility](https://reactnative.dev/docs/accessibility) · [Text](https://reactnative.dev/docs/text) · [Image](https://reactnative.dev/docs/image) · [Pressable](https://reactnative.dev/docs/pressable) · [Optimizing FlatList](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- Libraries: [Zustand v5 migration (useShallow)](https://github.com/pmndrs/zustand/blob/main/docs/reference/migrations/migrating-to-v5.md) · [Reanimated useSharedValue](https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue/) · [ReducedMotionConfig](https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/) · [useReducedMotion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/) · [Skia Canvas](https://shopify.github.io/react-native-skia/docs/canvas/overview) · [react-native-safe-area-context](https://appandflow.github.io/react-native-safe-area-context/) · [FlashList](https://shopify.github.io/flash-list/) · [react-native-svg](https://github.com/software-mansion/react-native-svg) · [React Navigation useFocusEffect](https://reactnavigation.org/docs/use-focus-effect)
- Apple: [HIG Accessibility (44 × 44 pt)](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Local source read on 2026-09-26: `react-native@0.86.3` `Libraries/Utilities/Appearance.js`, `useColorScheme.js`, `Libraries/Components/SafeAreaView/SafeAreaView.d.ts` (`@deprecated`), `React/CoreModules/RCTAccessibilityManager.mm` (content-size multipliers), `Libraries/Network/RCTDataRequestHandler.mm`; `react-native-reanimated@4.5.1` `src/hook/useReducedMotion.ts`, `src/component/ReducedMotionConfig.tsx`; `react-native-svg@15.15.4` `src/utils/fetchData.ts`; `eslint-plugin-react-native@5.0.0` `lib/rules/no-unused-styles.js`.

---

## Verified

On **2026-09-26** with Expo SDK 57.0.25, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, ESLint 9.39.5 with eslint-config-expo 57.0.2, eslint-plugin-react-hooks 7.1.1, typescript-eslint 8.70.1, eslint-plugin-react-native 5.0.0, eslint-plugin-formatjs 8.1.0, Prettier 3.9.9, Jest 29.7.0 with jest-expo 57.0.5, RNTL 14.0.1 with test-renderer 1.2.0, Zustand 5.0.15, Reanimated 4.5.1, Worklets 0.10.1, Skia 2.6.2, react-native-safe-area-context 5.7.0, FlashList 2.0.2 (benchmark only), babel-plugin-react-compiler 1.0.0, Node 26.4.0, Xcode 26.6, and the iOS 26.5 simulator (iPhone 17 Pro).

- **Code.** Every TypeScript file in this doc passed in `scratchpad/rn/writer-comp-perf/lab2`, an npm-workspaces copy shaped like FINAL A.8 (`packages/shell`, `packages/game-kit`, `apps/line-siege`, root `test/`). The checks were doc 04's `eslint.config.mjs` (copied verbatim) plus [3.12](#312-eslint-additions-owned-by-this-doc) with `--max-warnings 0`, `tsc --noEmit -p` for each of doc 04's tsconfig projects, `prettier --check`, and 42 Jest tests in the `unit` and `golden` projects. Doc 10's i18n modules were imported unchanged. After review, everything was re-run in `scratchpad/rn/verify-ui-perf-a11y`: the then-current doc 04 config plus 3.12, doc 10's typed `t()` (a mistyped key fails `tsc`) with the catalog entries shown here, which pass doc 10's catalog linter, and the `renderWithShell` described in open issue 7. Doc 11's `ad-banner-slot.tsx` lints clean under the `ui/` rules.
- **Imports.** `@e07/shell/<folder>/<file>.ts` resolves in `tsc` and in Metro (`npx expo export --platform ios` in a copy of the monorepo probe with `exports: { "./*": "./src/*" }`). Without the extension, both fail.
- **makeStyles design.** Three variants were tested. (1) A factory returning a plain object: typos such as `colr` were not caught, even with a generic intersection or explicit type arguments. (2) A factory returning `StyleSheet.create(...)` directly: typos, N11 and colour literals were caught, but `no-unused-styles` reported every key as unused ("undefined.base"). (3) The block body `const styles = StyleSheet.create(...); return styles;`: all checks work, and an unused key is reported as `styles.forgotten`.
- **Compiler.** `babel-plugin-react-compiler` 1.0.0 compiled `IconButton` and `useHoldToConfirm` and skipped the factory-returned `useStyles`.
- **Lint behaviour.** `set-state-in-effect`, `refs`, `set-state-in-render` and `static-components` fire as errors. `props.items.push()` is **not** flagged, hence readonly prop types. Under doc 04's config, `({ pressed })` in a style callback fails the boolean-parameter naming rule, and `void promise.then(...)` fails `no-floating-promises` (`ignoreVoid: false`). The code here avoids both.
- **Lists and icons.** The simulator benchmark in 3.9/3.10 (harness `scratchpad/rn/writer-comp-perf/sim-lab/App.tsx`, runner `run-bench.sh`, raw results `bench-results*.jsonl`). RTL grid order was checked from screenshots for ScrollView, FlatList and FlashList, and the icon contact sheet was inspected.
- **Text scaling.** `xcrun simctl ui <udid> content_size accessibility-medium` gives `fontScale` 1.786, and `accessibility-extra-extra-extra-large` gives 3.571. The React Native table in `RCTAccessibilityManager.mm` matches. `maxFontSizeMultiplier={2}` held text at 2× in a screenshot.
- **Reduce motion.** Reanimated's `useReducedMotion` returns a constant captured at module load (source), and `ReducedMotionConfig` exists and sets the global flag (source).
- **Store tests on real stores (2026-09-26, `scratchpad/fix-final/repo`).** `premium-entry.test.tsx` (3 tests), `primary-button.test.tsx`, `icon-button.test.tsx`, doc 15's `level-grid.test.tsx` and `palette-checks.test.ts` pass with doc 07's new `renderWithShell` (jest-expo 57.0.5, RNTL 14.0.1); `tsc` for all programs, doc 04's merged ESLint and Prettier pass. The re-render guard failed as expected with an extra `useSettingsStore((state) => state.settings)`.
- **Unit vs golden.** Importing Skia in the `unit` project fails with "Native Skia Module failed to correctly install JSI Bindings!". The rasterizer ran in the `golden` project.
- **Toybox additions (2026-09-28).** The five new `ColorTokens` fields, the filled `TEST_PALETTE` and the `LAYOUT`, `RADII`, `STROKE` and `ELEVATION` scales in `tokens.ts` were re-checked in a copy of the lab: `tsc`, doc 04's ESLint, Prettier and the full Jest run pass (details in [doc 18](18-design-system-toybox.md#verified)).

**Re-verify when versions move.** Run `npx expo install --check` in each app. Run `npm view zustand version`, `npm view @shopify/flash-list dist-tags`, `npm view react-native-svg version` and `npm view eslint-plugin-react-hooks version`. Then re-run the lint probe (a bad screen that must produce the errors listed in 3.12) and the compiler check in 3.4. If Expo's pins change (SDK 58: Reanimated 4.7, Skia 2.11.2, RNGH 3.x), repeat the 3.9 benchmark before changing the list or icon decisions.

---

## Open issues

1. **Resolved: settings field shape.** Doc 06 owns the names: `settings.theme` (`'system' | 'light' | 'dark'`), `settings.colorBlind` and `settings.reduceMotion` (`'system' | 'on' | 'off'`). This doc reads them through doc 06's `selectThemePreference` and `selectReduceMotionPreference` (named so they do not clash with `selectTheme(themes, selector)` in `theme-set.ts`); code that destructures the boolean renames it `isColorBlind` (doc 03 rule 6).
2. **Resolved: doc 10's `<T>` example** now uses `variant="heading"`, and doc 10 describes `AppText` by pointing to section 3.7.
3. **Resolved: directional icons.** RTL flipping lives in `Icon` through `DIRECTIONAL_ICONS`, so no call site can forget it; doc 10 section 3.11 points here instead of describing a separate `DirectionalIcon` wrapper.
4. **Resolved: illustrative examples elsewhere.** Doc 03's naming sample of `LevelTile` is marked as an illustration and uses `AppText`'s `text` prop; the real `LevelTile` is section 3.9. Doc 07's old `PremiumPanel` example was replaced by a probe that uses `PrimaryButton`.
5. **Doc 01's banned list.** Suggest adding `react-native-svg` (native pod plus `fetch`-based `SvgUri`) and `@shopify/flash-list` (not needed) to doc 01 section 3.6, so the package audit matches the import ban here.
6. **Resolved: other `no-restricted-imports` blocks in doc 04.** The i18n folder, the direction module and the adapters now start from `RUNTIME_PATHS` minus their own exemptions, so they carry `UI_PATHS` too (doc 04 section 3; no file in the handbook tripped it).
7. **Resolved: store-reading component tests.** Doc 07's `renderWithShell` now builds doc 06's settings store and doc 12's Premium store from a seeded in-memory save, provides them through `StoresProvider` and returns them; `premium-entry.test.tsx` uses it. The progress and stats stores join `ShellStores`, and the helper, when doc 06 writes them. The 44 × 44 pt touch-box assertion in `icon-button.test.tsx` is one of the two style assertions doc 07 rule 26 allows.
8. **Resolved: where the UI palette comes from.** The UI palette is the game's Toybox paint ([doc 18](18-design-system-toybox.md) section 3.2, `design/toybox/tokens.json`), written as `apps/<game>/src/theme/palette.ts` and pinned by doc 18's `toybox-tokens.test.ts`; it is not derived from the board palettes in doc 09's `board-palettes.json`, which stay board-only.
9. **Toybox follow-ups owned here** (from doc 18's open issues): switch `TYPE_SCALE` to the Toybox sizes and faces together with doc 10; add the `AppText` tones Toybox needs (`onPop`, sticker ink, white on ink, toast); drop `ScreenFrame`'s 16 pt column padding in favour of the Toybox top bar (16) and body (20) insets; rebuild `PrimaryButton`, `IconButton` and `TileButton` on doc 18's `RaisedSurface`.
