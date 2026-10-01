---
name: react-components-and-hooks
description: Writes React components and hooks - props, model hooks, effects, React Compiler (no useMemo), selectors, Pressable, lists, safe areas, window size, error boundaries. Use when writing a hook, an effect or a component's logic. Not for Toybox looks (toybox-components) or screens (toybox-screens).
---

# React components and hooks

Every component and hook in the Shell and the game apps follows one set of React rules (function components with read-only props, effects only for outside systems, compiler memoization, narrow store selectors, accessible 44 pt pressables, safe any-size layout, one error boundary), and a script proves the ones lint cannot see.

## Rules that must hold

1. **Function components, one per file, named export, explicit `: ReactNode`.** React Compiler optimises only functions; the one class is `ShellErrorBoundary`.
2. **Props are `type XProps = { readonly … }`, strings arrive translated, interactive components take a required `testID`**, and a reusable component derives its parts from that one testID (`${testID}.label`). Lint does not catch prop mutation; Maestro and the screen contract select by testID.
3. **No logic in components.** Pure functions hold rules and derived values, ports hold side effects, a `use-<screen>-model.ts` hook wires them; `ui/` never imports stores, screens or services.
4. **Effects only synchronise with systems outside React** (OS subscriptions with cleanup, pushing state into a native API, focused-screen work, measurements); everything else is computed during render or done in the handler. No state setter runs synchronously in an effect.
5. **No `useMemo`, `useCallback`, `memo`; `.get()`/`.set()` on shared values; `'use no memo'` only with its failing test.** The compiler memoizes, and silently skips any function that breaks a Rule of React.
6. **Store hooks always get a selector returning a primitive or an existing reference; objects go through `useShallow`.** A new object per call loops forever in Zustand 5; a missing selector re-renders on every change.
7. **Render is pure:** no clock, no random, no ref reads, no components declared inside components.
8. **Pressables live in `ui/`, carry a role, a translated name, their state, and a 44 × 44 pt box of their own** (never `hitSlop`); holds have a screen-reader alternative.
9. **Layout survives any window:** never `Dimensions`; size from `useWindowClass()` (or `onLayout`), pure layout maths tested at the listed sizes and at 200 % text, `ScreenFrame` for safe areas, logical style keys only, no `isRTL`.
10. **Reduce motion comes only from `useReduceMotion()`**; `<MotionConfig/>` applies it to every Reanimated animation, and a parity capture freezes every loop through the same hook. Only the saved choice itself reads `useReduceMotionSetting()`: the Settings row, and the S12 success confetti's hide switch (`isHiddenBySetting`: the pieces vanish for the player's setting, while a capture freeze only holds them at their first still frame).
11. **Lists render every item in a `ScrollView` with stable keys** (no FlatList, FlashList or index keys in v1); at most 8 Skia canvases per screen outside the board.
12. **`ShellErrorBoundary` wraps the app root and the board host;** its fallback has one way out and never retries; errors boundaries cannot see are caught where they happen and logged.

## Workflow

1. Read [references/rules-explained.md](references/rules-explained.md) once per session before writing React code; each rule has its reason and its enforcer.
2. Writing a `ui/` component: imitate [examples/labelled-value.tsx](examples/labelled-value.tsx) (+ its test); it is a shape to follow, never a file to copy into the app. For the press, compose the Toybox `RaisedSurface`; check the Pressable table in [references/patterns-and-recipes.md](references/patterns-and-recipes.md).
3. Writing a screen: the route file is only `const model = use<Screen>Model(); return <<Screen>View model={model} />`; the view is pure and the model hook is the only code that reads stores, services, the game host and navigation (toybox-screens ships every Shell screen's hook with its test). Keep every function at 40 lines or fewer by splitting a hook into `use-<screen>-actions.ts` and similar parts. Wrap Premium-only parts the way [examples/hide-for-premium.tsx](examples/hide-for-premium.tsx) reads one store value.
4. Writing a hook: follow [examples/use-step-pager.ts](examples/use-step-pager.ts) (state + derived values, no effect) or [templates/use-hold-to-confirm.ts](templates/use-hold-to-confirm.ts) (Reanimated timer); an effect only for the four allowed kinds.
5. Setting up the app root once: copy `system-a11y-store.ts`, `use-reduce-motion-setting.ts`, `use-reduce-motion.ts`, `motion-config.tsx`, `shell-error-boundary.tsx`, `shell-providers.tsx` to `packages/shell/src/app/` and `screen-frame.tsx`, `window-class.ts`, `use-window-class.ts` to `packages/shell/src/ui/`, each with its test (or its `// device-only:` marker). Every template's first line names its app path; files in `examples/` have none and are never copied.
6. Write the test first (RNTL through `renderWithShell`; recipes in [references/patterns-and-recipes.md](references/patterns-and-recipes.md)); give hot store-reading components a `<Profiler>` test like `hide-for-premium.test.tsx`.
7. Run `npx tsc --noEmit -p packages/shell`, `npx eslint <changed paths> --max-warnings 0`, the Jest tests, then `node ${CLAUDE_SKILL_DIR}/scripts/check-react-rules.mjs .` from the repo root (it scans `packages/shell/src` and `apps/`, skipping `skills/`, `.claude/` and generated native output). Fix every `FAIL` line and rerun until it prints `RESULT: PASS`.

## Definition of done

- [ ] Every new component has a named export, read-only props, a required `testID` if interactive, translated strings only, and a test that queries it by role and name.
- [ ] Every new hook sits in `use-<name>.ts`, has a test, and uses an effect only for an outside system (with cleanup).
- [ ] No `useMemo`, `useCallback`, `memo`, `.value`, `hitSlop`, `Dimensions`, index keys or unselected store reads were added.
- [ ] Layout functions are tested at the listed window sizes and at `fontScale` 2; screens sit in `ScreenFrame`.
- [ ] Hot store-reading components have a `<Profiler>` re-render test.
- [ ] `tsc`, ESLint `--max-warnings 0` and Jest pass for the touched workspaces.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-react-rules.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Copying a prop into state with an effect.** Compute it during render; the lint rule `set-state-in-effect` is right.
- **`useCallback` "to be safe".** The compiler already memoizes; the import is banned and the checker fails it.
- **`useSettingsStore((state) => ({ a, b }))`.** A fresh object each call: wrap in `useShallow` or select two primitives.
- **A `Pressable` in a screen or an `onPress` on a `View`.** Use the ui primitives so role, label, state and size are right once.
- **`hitSlop` to reach 44 pt.** Make the box itself 44 pt; slop is invisible and overlaps neighbours.
- **`FlatList` for the levels grid.** Measured slower at 90 tiles; a `ScrollView` with stable keys wins.
- **Reading `Dimensions` or `I18nManager.isRTL`.** Windows resize and direction has one source.
- **An error fallback that retries by itself.** It becomes a crash loop; offer one way out.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/rules-explained.md](references/rules-explained.md) | All 53 rules with reasons and enforcers | Workflow step 1 |
| [references/patterns-and-recipes.md](references/patterns-and-recipes.md) | File map, ui component, screen + model hook, hooks, effects, stores, styles, pressables, lists, window sizes, motion, errors, test recipes, versions | Workflow steps 2-6 |
| [examples/labelled-value.tsx](examples/labelled-value.tsx) | Example (shape only, not copied): presentational ui component with derived part testIDs | Workflow step 2 |
| [examples/labelled-value.test.tsx](examples/labelled-value.test.tsx) | Example: its test | Workflow step 2 |
| [examples/hide-for-premium.tsx](examples/hide-for-premium.tsx) | Example (shape only, not copied): store-reading component with a primitive selector | Workflow step 3 |
| [examples/hide-for-premium.test.tsx](examples/hide-for-premium.test.tsx) | Example: Profiler re-render guard and store-driven tests | Workflow steps 3 and 6 |
| [examples/use-step-pager.ts](examples/use-step-pager.ts) | Example (shape only, not copied): hook with state and derived values, no effect | Workflow step 4 |
| [examples/use-step-pager.test.ts](examples/use-step-pager.test.ts) | Example: renderHook tests | Workflow step 4 |
| [templates/use-hold-to-confirm.ts](templates/use-hold-to-confirm.ts) | Reanimated safety timer hook (the same file toybox-components ships in `ui/`; copy once) | Workflow step 4 |
| [templates/use-hold-to-confirm.test.ts](templates/use-hold-to-confirm.test.ts) | Fake-timer tests: the 2 s hold, an early release, the frozen fill for a parity capture, the clamp (the same file toybox-components ships; copy once) | Workflow step 4 |
| [templates/system-a11y-store.ts](templates/system-a11y-store.ts) | OS accessibility switches mirrored in a store (synced from the library; board-gestures-and-input and accessibility ship the same file; do not edit here) | Workflow step 5 |
| [templates/system-a11y-store.test.ts](templates/system-a11y-store.test.ts) | Its test (synced from the library) | Workflow step 5 |
| [templates/use-reduce-motion.ts](templates/use-reduce-motion.ts) | `useReduceMotion()`: every animation's answer (the setting, and true during a parity capture); the same file settings-and-preferences and accessibility ship, copy once | Workflow step 5 |
| [templates/use-reduce-motion.test.ts](templates/use-reduce-motion.test.ts) | Its test (a capture freezes motion, the row stays as saved) | Workflow step 5 |
| [templates/use-reduce-motion-setting.ts](templates/use-reduce-motion-setting.ts) | `useReduceMotionSetting()` and `resolveReduceMotion()`: the saved choice or the phone's switch, never frozen; it imports no test-only code, so the S15 debug model (reached from the test-only entry) reads it without an import loop | Workflow step 5 |
| [templates/use-reduce-motion-setting.test.ts](templates/use-reduce-motion-setting.test.ts) | Its test | Workflow step 5 |
| [templates/motion-config.tsx](templates/motion-config.tsx) | Reanimated global reduce-motion flag | Workflow step 5 |
| [templates/motion-config.test.tsx](templates/motion-config.test.tsx) | Its test: the flag follows the Shell setting | Workflow step 5 |
| [templates/shell-error-boundary.tsx](templates/shell-error-boundary.tsx) | The one class component | Workflow step 5 |
| [templates/shell-error-boundary.test.tsx](templates/shell-error-boundary.test.tsx) | Fallback, logging and reset tests | Workflow step 5 |
| [templates/shell-providers.tsx](templates/shell-providers.tsx) | Root provider stack | Workflow step 5 |
| [templates/shell-providers.test.tsx](templates/shell-providers.test.tsx) | Its test: children render, crash fallback, OS accessibility switches | Workflow step 5 |
| [templates/screen-frame.tsx](templates/screen-frame.tsx) | Safe areas, ground, centred column; `UNDER_HOME_INDICATOR_EDGES` for tall bodies without a banner | Workflow step 5 |
| [templates/screen-frame.test.tsx](templates/screen-frame.test.tsx) | Its test (with safe-area metrics, both edge sets) | Workflow step 5 |
| [templates/window-class.ts](templates/window-class.ts) | Pure window classification | Workflow step 5 |
| [templates/window-class.test.ts](templates/window-class.test.ts) | Tests at the listed sizes | Workflow step 5 |
| [templates/use-window-class.ts](templates/use-window-class.ts) | Hook over useWindowDimensions | Workflow step 5 |
| [templates/use-window-class.test.tsx](templates/use-window-class.test.tsx) | Its test: follows a window change | Workflow step 5 |
| `scripts/check-react-rules.mjs` | Checker for the rules lint does not fully cover | Workflow step 7, and at the end |
| `scripts/lib/object-literal.mjs` | Bracket-matching helper for the checker | Never by hand |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad source trees for the self-test | When adding a rule to the checker |

## Related skills

- `toybox-components` - the Toybox look of buttons, rows, toggles and every other component.
- `toybox-design-system` - tokens, `makeStyles`, `AppText`, `RaisedSurface`.
- `toybox-screens` - screen layouts and the exact testIDs.
- `state-stores` - store factories, reducers and selectors.
- `typescript-and-lint-rules` - the full ESLint and TypeScript configuration.
- `unit-and-component-tests` - Jest projects, `renderWithShell`, RNTL conventions.
- `accessibility` and `performance-budgets` - VoiceOver, contrast and the measured budgets.
