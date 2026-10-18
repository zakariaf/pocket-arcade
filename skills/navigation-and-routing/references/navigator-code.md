# The navigator in code

What each template file does, how screens use navigation, how to test it, and the library facts behind the choices.

## Contents

- Files and where they go
- The static stack
- Typed routes and params
- The container
- Using navigation from a screen
- Partial Shell: building the navigator before every screen exists
- Back on the Game screen
- Android: the system back
- Testing navigation
- Verified facts and versions
- Pitfalls seen before

## Files and where they go

Every file lands at Shell step 7 with the composition root, each with its test, except `route-params.ts` (plain types, Shell step 6). A file lands at step 6 only if it and its test need nothing from step 7, and these tests render through `renderWithShell`, which needs the Toybox theme of step 7.

| Template | App path | Job |
|---|---|---|
| `root-stack.tsx` | `packages/shell/src/navigation/root-stack.tsx` | the one navigator: groups, screens, options |
| `route-guards.ts` (+ `route-guards.test.tsx`, Shell step 7) | `packages/shell/src/navigation/route-guards.ts` | the groups' `if` hooks (read the settings store) |
| `route-params.ts` (Shell step 6) | `packages/shell/src/navigation/route-params.ts` | `GameParams`, the only params type |
| `react-navigation.d.ts` | `packages/shell/src/navigation/react-navigation.d.ts` | registers the static param list globally |
| `navigation-root.tsx` (+ test) | `packages/shell/src/navigation/navigation-root.tsx` | the container: direction, theme, initial state, reduce-motion fade |
| `not-built-screen.tsx` (+ test) | `packages/shell/src/navigation/not-built-screen.tsx` | the stand-in for routes whose screen is outside `shell-slice.json` (partial Shell only) |
| `navigation-theme.ts` (+ test) | `packages/shell/src/navigation/navigation-theme.ts` | Shell theme → React Navigation theme |
| `debug-route.tsx` | `packages/shell/src/navigation/debug-route.tsx` | S15 behind `TEST_ONLY` |
| `font-test-route.tsx` (+ test) | `packages/shell/src/navigation/font-test-route.tsx` | S15's font test page behind `TEST_ONLY` (`TEST_ONLY.FontTestScreen`) |
| `game-screen.tsx` | `packages/shell/src/screens/game/game-screen.tsx` | S5, the assembled Game screen (a shared copy, byte-identical to toybox-screens' template): session, Back opens Pause, Pause and Result overlays, the screen model |
| `game-screen-back.test.tsx` | `packages/shell/src/screens/game/game-screen-back.test.tsx` | Back behaviour in a real static stack (shared copy, same bytes as toybox-screens') |
| `route-guards.test.tsx` | `packages/shell/src/navigation/route-guards.test.tsx` | first-run flow: language → tutorial → Home (lands with `route-guards.ts` at Shell step 7) |
| `game-screen-back.android.test.tsx` (Android step 4) | `packages/shell/src/screens/game/game-screen-back.android.test.tsx` | the system back on Game, in the `unit-android` project: Pause, resume, only Pause Home leaves, a finished run leaves, Home backgrounds the app |
| `use-hardware-back.ts` (+ `use-hardware-back.android.test.tsx`, Android step 4) | `packages/shell/src/navigation/use-hardware-back.ts` | `useHardwareBack(onBack \| null)`: what sits above the navigator (an S14 dialog) takes the system back |

Imports use the package name with the file extension (`@e07/shell/navigation/root-stack.tsx`); same-folder imports are `./file.ts`; `../` is banned.

## The static stack

- `createNativeStackNavigator({ screenOptions, groups })` from `@react-navigation/native-stack`: the static API. No Expo Router, no tabs, no drawers, no JS stack (`@react-navigation/stack`), no nested navigators, no second stack. About 15 screens at most 2 levels deep fit one stack, and the Shell must own navigation.
- `screenOptions: { headerShown: false }`: the Shell draws its own top bar, whose Back button calls `navigation.goBack()` and whose arrow flips with the direction.
- The exported variable is `rootStack`, not React Navigation's documented `RootStack`: the naming rule rejects a PascalCase value that is not a component.
- A screen entry is either the component (`Home: HomeScreen`) or `{ screen, options, if }`.
- Screen components come from `packages/shell/src/screens/<area>/<name>-screen.tsx` and are named exports.
- Adding a route is a product change: it must be in the route table first (`references/routes-and-flows.md`), and `scripts/check-navigation.mjs` rejects any route that is not.

## Typed routes and params

- A screen declares its params by its props type: `export type GameScreenProps = StaticScreenProps<GameParams>;`. Screens without params take no props (or `StaticScreenProps<undefined>` if they need `route`).
- `react-navigation.d.ts` sets `interface RootParamList extends StaticParamList<typeof rootStack> {}` inside `declare global { namespace ReactNavigation { … } }`. With it, `useNavigation()` needs no generic, and `navigation.navigate('Nope')` or `navigate('Game', { start: 'bogus' })` fail `tsc` (verified). `interface` is required for declaration merging; the lint config allows it only in `*.d.ts`.
- Params stay small and serialisable: ids, a `RunRef`, a start mode. Never functions (they break state restore and trigger React Navigation's "non-serializable values" warning), never whole objects that live in a store.

## The container

- `createStaticNavigation(tree)` returns the container component; render it once from the app root (`NavigationRoot`).
- `direction={readLayoutDirection()}`: the same `I18nManager` source as the layout (`i18n/direction.ts`), never the language setting.
- `theme={toNavigationTheme(shellTheme)}`: built once per Shell theme. React Navigation paints the screen container with `colors.background`; using the game's ground stops a white flash in dark mode during pushes.
- `initialState`: `undefined` normally; `{ index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] }` when hydration found a run with `resumeOnLaunch: true`. With `exactOptionalPropertyTypes` omit the prop instead of passing `undefined`.
- No `linking` prop: the store app has no deep links.
- Test builds only: `navigationRef` (the debug link handler's `createNavigationContainerRef()`, passed on as the container's `ref`) and `onReady` (starts the debug link handler once the navigator can navigate). Both are optional; `shell-navigator.tsx` (game-host-integration) passes e2e-maestro's debug parts, which are inert in store builds. The template test proves the ref is ready and `onReady` ran once.
- Reduce motion: `rootStack.with(function MotionAwareStack({ Navigator }) { … return <Navigator screenOptions={{ animation: isReduced ? 'fade' : 'default' }} />; })`. `.with()` (core 7.22) wraps the static navigator in a component, so its options can use hooks; its `screenOptions` merge over the static ones. Pass the wrapped tree to `createStaticNavigation`. Name the wrapper function (a PascalCase function passes the naming and display-name rules).

## Using navigation from a screen

```ts
import { StackActions, useNavigation } from '@react-navigation/native';

const navigation = useNavigation();          // typed from RootParamList, no generic
navigation.navigate('Settings');             // push a route
navigation.navigate('Game', { start: 'new', ref: { kind: 'level', level: 12 } });
navigation.goBack();                         // top-bar Back
navigation.dispatch(StackActions.popTo('Home'));   // back to an existing screen
```

- In React Navigation 7 `navigate` never goes back: it pushes (StackRouter `NAVIGATE` pushes unless `pop: true`). Go back to a screen with `popTo`, never `navigate('Home')`. `popTo(name)` goes back to the nearest route with that name; if none exists it removes the current route and adds the new one.
- Navigation belongs to screens and `use-<screen>-model.ts` hooks. `ui/` components never import `@react-navigation/*`; they get `onPress` props.
- Handlers are synchronous (`handleOpenSettings`); start async work with `task().catch(reportError)`.
- Never read the route stack to decide layout; never store navigation state in a store (it is rebuilt at launch; a run in progress is reopened from the save).

## Partial Shell: building the navigator before every screen exists

A repo that builds only some Shell screens (a parity slice such as Home + Settings, or a game-first repo) says so in `shell-slice.json` at the repo root:

```json
{ "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }
```

Valid ids are S1-S15 and S11a-S11d; `"screens": []` means a game-first repo with no Shell app. No file means the full Shell, and every check is strict.

- **Keep the whole route table.** `root-stack.tsx` keeps every group, route and option, so `RootParamList` stays complete and every `navigate()` call in the model hooks type-checks. Only the screen component changes: a route whose screen is outside the slice points at `NotBuiltScreen` (`templates/not-built-screen.tsx`, copied to `packages/shell/src/navigation/not-built-screen.tsx` with its test). Drop the unused screen imports.

```tsx
Levels: NotBuiltScreen,
Game: { screen: NotBuiltScreen<GameParams>, options: { gestureEnabled: false, fullScreenGestureEnabled: false } },
Debug: { if: useIsTestBuild, screens: { Debug: NotBuiltScreen, FontTest: NotBuiltScreen } },   // S15 outside the slice
```

- **Keep the params types.** The static API reads each route's params from its screen's props, so a bare `NotBuiltScreen` on `Game` would turn its params into `undefined` and every `navigate('Game', { start, ref })` stops compiling. `NotBuiltScreen` is generic over the params: `NotBuiltScreen<GameParams>` (an instantiation expression; `GameParams` from `route-params.ts`) for Game, plain `NotBuiltScreen` for the routes without params.
- **Model hooks navigate normally.** Home's Levels key still calls `navigate('Levels')` and lands on the stand-in, which shows the route name (from existing `common.*` keys only; no new copy) and a Back button. Never write no-op handlers for unbuilt routes: they hide the route from tests and have to be found and replaced later.
- **The first launch still reaches Home.** When S2 is outside the slice, `LanguageChoice` points at `NotBuiltScreen`: on a FirstRun route it has no Back, and its Next button dispatches the same action the real screen does (`set-language` with `null` = System), so the groups' `if` hooks move on. **`Tutorial` always points at `TutorialScreen`**, slice or not: the tutorial route is part of the Shell core (game-host-integration ships `screens/first-run/tutorial-screen.tsx` with its model hook), the composition root's first-launch test waits for `tutorial.screen`, and a first launch reaches Home through its last step (`finish-tutorial`). check-navigation fails `route-not-built` for a Tutorial stand-in whatever the slice says.
- **When the files land in a Shell built step by step.** `route-params.ts` at Shell step 6; `route-guards.ts` with its test and the rest of the navigator at step 7, together with the composition root (`check-navigation` rule `route-guards-files` prints `SKIP packages/shell/src/navigation/route-guards.ts [route-guards-files] due at Shell step 7: packages/shell/src/app/start-shell.ts not yet created` until then, and from step 7 fails while either file is missing).
- **The Debug group follows S15.** While S15 is outside the slice, `Debug` and `FontTest` point at `NotBuiltScreen` and the test-only pair leaves out `DebugScreen` and `FontTestScreen`; when S15 joins, they render `DebugRoute` and `FontTestRoute` (each through `TEST_ONLY`).
- **Only the slice's screens are copied**, each with its model hook, view and tests (toybox-screens). Screens outside the slice have no route or view files; the Shell core (the S14 dialogs, S5's top bar and layout, S7's result model, the debug kit, the parity harness, the perf layer and the Tutorial route) is copied whatever the slice, because the composition root and the startup import it.
- **Checking.** `node ${CLAUDE_SKILL_DIR}/scripts/check-navigation.mjs .` reads `shell-slice.json`: rules tied to a screen outside the slice print `SKIP <file> [<rule>] <S-id> not in shell-slice.json` (not a problem); everything inside the slice is strict, and a slice screen still routed to `NotBuiltScreen` fails `route-not-built`. Without the file, any `NotBuiltScreen` route fails.
- **A slice never ships.** `check-navigation.mjs . --complete` fails while `shell-slice.json` exists or any route uses `NotBuiltScreen`. When the last screen is built: point every route at its real screen, delete `not-built-screen.tsx` and its test and `shell-slice.json`, then run `--complete`.

## Back on the Game screen

`templates/game-screen.tsx` is the assembled S5 route (the same bytes as toybox-screens' template, synced from the library): it renders toybox-screens' `GameLayout` (the `game.screen` frame with the game top bar and the `game.board` area, and the Pause or Result overlay beside the frame), the board host and the E2E moves probe, and takes its top bar and Result from `useGameScreenModel(controls, nav)` (toybox-screens' `screens/game/use-game-screen-model.ts`). `useGameSessionControls(route.params)` (game host) exposes `status`, `view`, `BoardHost`, `send`, `pause`, `resume`, `leaveToHome` and `startRun`; the Pause overlay gets the controls as its `session` (`<PauseOverlay session={controls} onResume={controls.resume} onHome={handleHome} />`), so its model hook can name the run and restart it. `usePauseOnBackground(status, controls.pause)` pauses when the app leaves the foreground. `usePreventRemove(isRunLive, callback)` blocks removal while `status` is `playing` or `paused`; the callback pauses, resumes, or re-dispatches `data.action` once the Home button has set `isLeavingRef`. The screen offers the same leave (`isLeavingRef`, then `leaveToHome`) to the test build's live-run exit while its run is live (`useLiveRunExit` from game-host's `use-live-run-exit.ts`, reading its `LiveRunExitContext`, which `ShellNavigator` provides from `DebugParts.liveRunExit`; a store build provides none and registers nowhere); a test build's debug link calls it before it resets the stack (e2e-maestro's `resetToFirstRoute`), so a link sent while a run is on screen lands on its fixed stack. Every other reset is guarded like Back (`game-screen-back.test.tsx` pins both). Verified 2026-10-12: without the leave, admob-ads' ads smoke flow 4 (`screen=home` right after flow 3 left level 4 on screen) opened Pause instead of Home; letting every `RESET` through instead would let any reset drop a live run in a store build. This is the pattern React Navigation documents for "confirm before leaving" (`usePreventRemove` re-dispatches through `VISITED_ROUTE_KEYS`). The model's result keys leave with `popTo('Levels')` / `popTo('Home')` after recording the run; a `missing` run (nothing to open) pops to Home at once.

`game-screen-back.test.tsx` renders the route in a real static native stack and stubs everything it is not about: the session controls (`view: null`, `BoardHost: null`, `status` in a vanilla store), the Pause overlay (only its Home button), the screen model (`{ topBar: null, result: null }`) and `GameLayout` (a View that draws its board and overlay slots). A copy that mocks only the session controls crashes once the screen is wired (the layout needs the theme providers and the model reads the host).

## Android: the system back

The Android port brings these files at Android step 4, each with its test in the `unit-android` Jest project (`jest-expo/android`, only `*.android.test.ts(x)`), and changes no iOS file.

- **Routes need no code.** React Navigation 7.4's container registers one `BackHandler` listener (`useBackButton`): while `canGoBack()` it calls `goBack()` and consumes the press, otherwise it returns `false`. On Game that `goBack()` meets `usePreventRemove` exactly as the Back control does (Pause, then resume); on any other route it is the Back control's own call; on Home the press is not handled, React Native calls `BackHandler.exitApp()`, the activity's default back runs, and Android (12 and later) moves the app's task to the background; Android 7-11 finish the root activity instead, which the save after every move already covers. There is no `BackHandler` in screen code.
- **Dialogs take it with `useHardwareBack`.** S14 dialogs are drawn above the navigator (the dialog host), not as routes, so without help the press would go to the container and leave the screen behind the open dialog. `navigation/use-hardware-back.ts` adds a listener while it has a handler and consumes the press; `BackHandler` asks the newest listener first, so the open dialog answers before the container. Every S14 cancel (Cancel, Later, OK) closes the dialog, so the dialog host (toybox-screens' `screens/dialogs/dialog-host.tsx`, whose template carries the line; `use-hardware-back.ts` lands with it at Shell step 7, where it does nothing on iOS) wires it once, before its early return:

  ```tsx
  // Android's system back is the open dialog's cancel; every S14 cancel (Cancel, Later, OK) closes.
  useHardwareBack(request === null ? null : onClose);
  if (request === null) return null;
  ```

  `check-navigation` rule `dialog-back` fails a dialog host without it. On iOS `BackHandler` never fires, so the hook does nothing there.
- **S3 takes it and does nothing.** The S3 consent cover (admob-ads' `app/consent-moment.tsx`) is no route either and has no Back control, so "the system back does what Back does" leaves nothing to do; the press must still never reach the navigator under the cover. It draws the cover in toybox-screens' `ModalLayer` (`app/modal-layer.tsx`) with an `onBack` that does nothing: the layer calls `useHardwareBack(onBack)` while it is up. `GameLayout` passes no `onBack`, so with Pause or Result up the press goes on to Game's own Back (above).
- **The top layer answers, not the newest subscription.** `BackHandler` order is subscription time, and that is not layer order: a dialog whose handler changes re-subscribes and becomes newest, and a dialog that opens while S3 is up subscribes after the cover, so either would answer from under the S3 cover and close a dialog the player cannot see. So `use-hardware-back.ts` exports `HardwareBackCoverContext` (false by default): while a `ModalLayer` is up it provides `true` around its `behind` (the provider always renders and only its value changes, so nothing remounts), and `useHardwareBack` listens only while that context is false. The S3 cover's layer covers the DialogProvider (it lies in the cover's `behind`), so an open dialog stops listening until the cover goes, then subscribes again and is the newest. `use-hardware-back.android.test.tsx` pins the cover, and toybox-screens' `dialog-context.android.test.tsx` the S3-over-dialog cases (a dialog opened before the cover and re-rendered under it, a dialog opened under it, the back returning to the dialog once the cover goes).
- **The tests press the real Android path.** React Native 0.86 ships no `BackHandler` mock (`mockPressBack` is gone); in `jest-expo/android` `BackHandler` is the Android module, which listens to the `hardwareBackPress` device event. Press the system back exactly as the back button and the back gesture deliver it: `await act(() => { DeviceEventEmitter.emit('hardwareBackPress', {}); })`. Watch the unhandled case with `jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined)` (called once = Android backgrounds the app). Remove any listener a test adds by hand in `afterEach`: a listener left behind consumes the next test's press.
- **Proof that the test is about Android:** the same `game-screen-back.android.test.tsx` run by the iOS preset fails all six cases on assertions (`Expected: "paused"`, `Received: "playing"`), because the iOS `BackHandler` never delivers the press.
- **Predictive back.** `targetSdkVersion` 36 enforces predictive back, which disables `onBackPressed()`; React Native 0.86's `ReactActivity` registers an always-enabled `OnBackPressedCallback` that calls it (read in its source), so the press still reaches JavaScript and the rules above hold. The emulator run (e2e-maestro's Android flows, `pressKey: back`) is the device proof.

## Testing navigation

- Jest runs the real native stack: jest-expo 57's preset mocks react-native-screens, so a static stack renders in the `unit` project with RNTL 14 (`await render(...)`).
- Drive Back with a container ref: `const ref = createNavigationContainerRef<ParamListBase>(); await render(<Navigation ref={ref} initialState={…} />); await act(() => { ref.goBack(); });`. Type the ref with `ParamListBase` (the global `RootParamList` does not fit a test stack's ref under `exactOptionalPropertyTypes`).
- Read the result with `ref.getCurrentRoute()?.name` and query the screen by testID.
- Fake what the test is not about with `jest.mock` factories (the session controls, the Pause overlay). Inside a factory, `require()` what you need and name shared objects `mock…`; read them back with `jest.requireMock`.
- `navigation-root.test.tsx` swaps `root-stack.tsx` for a probe stack with the real route guards (`jest.mock` factory), fakes `readLayoutDirection()` to `'rtl'` and reads what each screen gets: the direction through React Navigation's `LocaleDirContext`, the ground colour through `useTheme()`, and the push animation from the `stackAnimation` prop of react-native-screens' `RNSScreen` host elements (`'fade'` with Reduce motion on).
- `route-guards.ts`, `root-stack.tsx` and `navigation-root.tsx` import `TEST_ONLY`, which in a test build loads the whole debug screen (with Skia's `HazardStrip`). Skia's native module does not load in the `unit` project, so the repo's `jest.setup.ts` mocks Skia once for every test (inert `SkiaCanvas`, `SkiaPath`, ... host elements); navigation tests write no Skia mock of their own. If a test fails with "Native Skia Module failed to correctly install JSI Bindings", that central mock is missing: add it from the `unit-and-component-tests` setup. A test that does not need the debug screen stubs it out, `jest.mock('@e07/shell/app/test-only.ts', () => ({ TEST_ONLY: null }))`, as `route-guards.test.tsx` does, so it also runs before the debug screen exists.
- Flows driven by store state: render a probe stack with the real `route-guards.ts` hooks inside `renderWithShell`, then `act(() => stores.settings.getState().dispatch(...))`.
- Run the tests with the paths first: `npx jest packages/shell/src/navigation --selectProjects unit` (`--selectProjects unit <path>` treats the path as a second project name and runs everything).
- Test titles start with a verb in the third person (`opens Pause when …`), as the lint config requires. Do not name a helper `render…` unless it returns the render result (`testing-library/render-result-naming-convention`).
- The end-to-end check (Maestro) presses the real back gesture on a device; this skill's Jest tests cover the logic.

## Verified facts and versions

Stack: Expo SDK 57, React Native 0.86.3, React 19.2.3, `@react-navigation/native` 7.4.1, `@react-navigation/native-stack` 7.19.2 (core 7.22.1, routers 7.6.4, elements 2.9.43), react-native-screens 4.26.2, react-native-safe-area-context 5.7.0, TypeScript 6.0.3, Jest 29.7 + jest-expo 57 + RNTL 14.0.1.

Verified on 2026-10-12 in a test workspace with a temporary `unit-android` project (`jest-expo/android`, only `*.android.test.ts(x)`): `game-screen-back.android.test.tsx` (6 tests) and `use-hardware-back.android.test.tsx` (4 tests) pass and pass `tsc`, ESLint `--max-warnings 0` and Prettier; the Android back test fails all six cases when the iOS preset runs it, and the hook test fails on its assertions against a stub that registers nothing; the dialog host with the `useHardwareBack(request === null ? null : onClose)` line answered the system back with its cancel while an earlier listener (standing for the container) was never called. Verified on 2026-09-30 in a test workspace with the full route table (every screen built, no slice): the template `root-stack.tsx` (with `FontTest`) passes `tsc`, ESLint `--max-warnings 0` and Prettier, the navigation and composition-root tests pass (15), `check-navigation.mjs . --complete` prints `RESULT: PASS`, and `font-test-route.test.tsx` draws `font-test.screen` through `TEST_ONLY`; the shared `game-screen.tsx` with `game-screen-back.test.tsx` (4 tests) passes against the assembled S5 set. Verified on 2026-09-28 in a workspace with the project's strict tsconfig, ESLint config and Jest projects, together with the real Toybox components and screens: every template passes `tsc`, ESLint `--max-warnings 0` and Prettier; `game-screen-back.test.tsx` (4 tests) and `route-guards.test.tsx` (3 tests) pass, and three of the Back tests fail when `usePreventRemove` is disabled; `NavigationRoot` with `.with()` rendered the first-run group, then Home after `finish-tutorial`, with Reduce motion on (the `.with()` wrapper's `screenOptions` are merged over the static ones, read in core 7.22.1); `check-navigation.mjs` flags a `linking` prop added to the container. Earlier verification (2026-09-26): a wrong route name and a wrong `Game` param were rejected by `tsc`; the debug screen was absent from a store export and present in a test export; a Release build on the iOS simulator ran the direction flip from the mounted splash.

## Pitfalls seen before

- Calling `reloadAppAsync` while the bundle is still evaluating crashed a Release build ("startSurface failed. Global was not installed"); the direction reload runs from the mounted startup splash's effect instead.
- Transition direction with `headerShown: false` was confirmed only by reading react-native-screens source; the owner's play-test looks at one push in Persian (an owner step, not blocking).
- `usePreventRemove` cannot see app kills; the save after every move is the guarantee.
- A test stack typed through the global `RootParamList` fails `tsc` under `exactOptionalPropertyTypes`: type test refs with `ParamListBase`.
