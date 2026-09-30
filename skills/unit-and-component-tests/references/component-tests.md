# Component and hook tests with React Native Testing Library 14

How every Pocket Arcade component, screen and hook is tested: through `renderWithShell`, by role and accessible name, with every call awaited. Read this before writing any `*.test.tsx`.

## Contents

- The async model of RNTL 14
- renderWithShell: what it builds and its options
- Queries: which one to use
- Matchers
- Pressing, typing and waiting
- Names built by t() (bidi isolates)
- Hooks
- Stores in tests
- Gestures, boards and direction
- Style assertions: only where the style is the contract
- Units that read nothing from the Shell
- What the helper imports
- What not to test
- Good and bad patterns side by side

## The async model of RNTL 14

RNTL 14 adopts React 19's async rendering: `render()`, `rerender()`, `unmount()`, `renderHook()`, every `fireEvent` helper and `act()` return promises. So:

- **Await every** `render`, `renderWithShell`, `renderHook`, `rerender`, `unmount`, `fireEvent*`, `act`, `waitFor`, `findBy*` and every `user.*` call, and make each test function `async`. An un-awaited call runs after the assertions and produces `act(...)` warnings or tests that pass for the wrong reason.
- Do not wrap `render` or presses in `act()` yourself; they handle it. Use `await act(() => { ... })` only to change state from outside React (a store dispatch, a port event).
- `@typescript-eslint/no-floating-promises` catches most forgotten awaits; `check-test-code.mjs` catches the RNTL-specific ones.
- `test-renderer` replaced React Test Renderer (types are `TestInstance`). Nothing in our tests imports either directly.
- The package ships its own agent guide, `node_modules/@testing-library/react-native/docs/guides/llm-guidelines.md`; this page holds its content for 14.0.1. After an RNTL upgrade, read the new copy and update this page.

## renderWithShell: what it builds and its options

`packages/shell/src/testing/render-with-shell.tsx` (template in `templates/packages/shell/src/testing/`) builds in memory what the app's composition root builds:

1. a first-launch save over the fake `SaveStore` (`planLoad` with empty slots, `createSaveService`, `applyLoadWrites`), with a fixed test clock (2026-09-26 12:00 UTC) and an error log that throws, so an invalid seed fails the test with the validation error itself;
2. the test's seed written through `SaveService.update` before any store exists;
3. the stores created from that save by `createShellStores(save)` (settings, progress, stats and Premium, the same factory as the composition root) behind `StoresProvider`;
4. the Shell `I18nProvider` with the real Shell catalogs (a missing message throws) and a `DirectionProvider`;
5. the Shell `ThemeProvider` over `TEST_PALETTE`, so `settings.theme` and `settings.colorBlind` pick the theme;
6. `ServicesProvider` with only the ports the test passes: any other port throws on first use and names itself (`renderWithShell: pass services.purchase (read .fetchProduct)`).

| Option | Default | Effect |
|---|---|---|
| `language` | `'en'` | the `I18nProvider` language |
| `direction` | the language's own (`fa`, `ckb`: `'rtl'`) | the `DirectionProvider` value |
| `palette` | `TEST_PALETTE` | the colours `ThemeProvider` picks from |
| `settings` | the default settings | a `Partial<SaveSettings>` written into the save before the stores exist |
| `isPremium` | `false` | the save's `premium` section says owned |
| `services` | none | the fakes; `save` defaults to the seeded in-memory save |

The result is RNTL's result plus `stores`. Every render gets fresh stores, so nothing leaks between tests. `createShellWrapper(options)` returns `{ wrapper, stores }` for `renderHook` and for tests that need the wrapper alone. `templates/packages/shell/src/testing/render-with-shell.test.tsx` is the helper's own test and the model of every pattern below.

When the progress and stats stores join `ShellStores`, add their factories to `createShellWrapper` in the same commit.

## Queries: which one to use

Query through `screen`, not through values destructured from `render()`.

1. `getByRole(role, { name })` first: it is what VoiceOver sees. A plain `View` with `role` needs `accessible` to be found; `Pressable` is accessible by default.
2. `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue` next.
3. `getByTestId` last, for elements without a role or text (a canvas host, a decorative card). The testIDs are the same `<screen>.<element>` names the end-to-end flows use.

- `findBy*` for anything that appears after a promise settles (a port load, a state change). It is the async `getBy*`; await it.
- `queryBy*` only to prove absence: `expect(screen.queryByRole('button')).not.toBeOnTheScreen()`. Never use `getBy*` for absence (it throws before the assertion), and never `queryBy*` plus `toBeOnTheScreen()` for presence (use `getBy*`).
- No `container.queryAll()` walks; `screen.container` is only for whole-tree helpers such as `findInaccessiblePressables(screen.container)`.

## Matchers

Prefer semantic matchers over props:

| Matcher | Checks |
|---|---|
| `toBeOnTheScreen()` | the element is in the tree |
| `toBeVisible()` | visible (style, `aria-hidden`, `accessibilityElementsHidden`, ancestors) |
| `toBeEnabled()` / `toBeDisabled()` | `aria-disabled` / `accessibilityState.disabled` (set by `Pressable`'s `disabled`), ancestors included |
| `toBeBusy()`, `toBeChecked()`, `toBeSelected()`, `toBeExpanded()` | the matching `aria-*` / `accessibilityState` field |
| `toHaveTextContent(text)` | text content (string or RegExp) |
| `toHaveAccessibleName(name)` | `aria-label`, `accessibilityLabel` or text content |
| `toHaveAccessibilityValue(value)` | `aria-value*` / `accessibilityValue` (sliders, progress) |
| `toHaveDisplayValue(value)` | a `TextInput`'s value |

`getBy*` already throws when nothing matches, so no extra null checks.

## Pressing, typing and waiting

```tsx
const user = userEvent.setup();
await user.press(screen.getByRole('button', { name: 'Play' }));
await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
```

- `userEvent.setup()` once per test, then `user.press`, `user.longPress(el, { duration })`, `user.type`, `user.clear`, `user.paste`, `user.scrollTo(el, { y })`. It fires the full sequence (pressIn, pressOut, press) a finger does.
- `fireEvent` only when user-event has no equivalent (a custom event name); await it too.
- `waitFor` only when there is no element to find: one assertion per callback, never an empty callback, never a press or other side effect inside it (do the action first, then wait). Prefer `findBy*`.
- Never wait with `setTimeout` or a sleep. For promises that settle outside React (a service over a fake port) use `await flushMicrotasks()` from `packages/shell/src/testing/flush-microtasks.ts`.
- `jest.useFakeTimers()` only for UI timers inside components (a toast that hides after 2 s); never for game logic or the clock, which take an injected `ClockPort` or a frame timestamp.

## Names built by t() (bidi isolates)

`t()` wraps the values of `…Name` and `…Text` arguments in FSI/PDI isolate characters, so the accessible name of a button built with `t('premium.buy-button', { priceText: '€1.99' })` is `Buy – ⁨€1.99⁩`. Build expected names with `isolate()` from `@e07/shell/i18n/bidi.ts`:

```tsx
const BUY_NAME = `Buy – ${isolate('€1.99')}`;
expect(await screen.findByRole('button', { name: BUY_NAME })).toBeEnabled();
```

Or strip them with `stripIsolates()` from the same module. Component tests assert the English source strings only; translations are checked by the catalog tooling, not by component tests.

## Hooks

```tsx
const { wrapper, stores } = createShellWrapper({ settings: { theme: 'dark' } });
const { result } = await renderHook(() => useDisplaySettings(), { wrapper });
```

A hook that reads a store, a port, the theme or i18n needs the wrapper; `templates/hook.test.tsx` is the pattern. `rerender(props)` and `unmount()` are async.

## Stores in tests

Components that read a store need nothing extra: seed the state with the `settings` or `isPremium` option and change it by dispatching on the returned `stores`:

```tsx
const { stores } = await renderWithShell(<PremiumEntry onOpen={jest.fn()} />);
await act(() => {
  stores.premium.getState().dispatch({ type: 'premium-granted' });
});
expect(screen.queryByRole('button')).not.toBeOnTheScreen();
```

Never `jest.mock` a store module and never build a module-level store: the store would outlive the test and leak state into the next one. A render-count check (React's `Profiler` with `onRender`) proves a component does not re-render on an unrelated store change.

## Gestures, boards and direction

- **Gestures** (React Native Gesture Handler 2.32): give the gesture `.withTestId('pan')`, import `fireGestureHandler` and `getByGestureTestId` from `react-native-gesture-handler/jest-utils`, then `await act(() => { fireGestureHandler(getByGestureTestId('pan'), [...]); })` (verified). The event list is `{ state: State.BEGAN }`, `{ state: State.ACTIVE, x, y }`, `{ state: State.END }` (`State` from `react-native-gesture-handler`); board gesture details belong to `board-gestures-and-input`.
- **Components that draw with Skia** (logo tile, empty-stats picture, hazard strip, debug screen, board canvas): render them like any other component. The central mock in `jest.setup.ts` turns every Skia element into an inert host element (`SkiaCanvas`, `SkiaPath`, ...) that keeps `testID` and accessibility props, so query by role and name (decorative art is hidden from VoiceOver: add `{ includeHiddenElements: true }` to find it by `testID`). Write no per-file Skia mock unless the test inspects Skia calls.
- **Screens that host a Skia board**: the board host is injected; in `unit` tests render the screen with a stub board component from the fake `GameModule`. The board itself is tested in the `golden` project and by draw-call tests.
- **No layout engine in Jest.** Jest has no Yoga, and `@react-native/jest-preset` mocks `I18nManager.isRTL = false`. Test direction logic as pure functions and `AppText` style props under an explicit `DirectionProvider`; judge mirroring only on simulator screenshots.

## Style assertions: only where the style is the contract

Assert visible English text, roles and accessible names, never class names. A style is asserted only when the style itself is what the spec promises:

- Toybox component measurements in `packages/shell/src/ui/` (sizes, radii and fonts from the design tokens, the 44 × 44 pt minimum touch box of icon buttons);
- the i18n contract test of `<T>` in `packages/shell/src/i18n/` (`t.test.tsx` checks `writingDirection`, start alignment and the script's font in Persian).

`check-test-code.mjs` accepts `toHaveStyle(` in those two folders. Anywhere else (screens, game host, game code) looks are proven by simulator screenshots; where a style really is the contract (an un-mirrored board keeping `direction: 'ltr'` in Persian, a slider's fill width), put `// allow-style-assertion: <why>` on the line above, or once in the file header. The reason must be at least 10 characters.

## Units that read nothing from the Shell

A props-only component (an error boundary, an ad slot whose banner is injected) or a hook whose dependencies are all injected (an audio lifecycle hook, a frame recorder) does not need the Shell tree. Keep plain `await render(...)` / `await renderHook(...)` and add one comment to the file:

```tsx
// no-shell-context: the boundary takes everything through props and reads no store, port or catalog.
```

A test that builds its own provider (a `wrapper` option, a `NavigationContainer`, a game-host provider) passes `{ wrapper }` or adds the same comment. If the unit later starts reading a store, the catalog or a port, the plain render fails loudly (no provider); switch to `renderWithShell` then.

## What the helper imports

`render-with-shell.tsx` builds on Shell modules other work creates. Copy it only when these exist (a `tsc` error naming one of them means that piece is missing; build it with its skill first):

| Import | Built by |
|---|---|
| `testing/test-palette.ts` (`TEST_PALETTE`), `theme/theme-provider.tsx`, `theme/theme-set.ts` | `toybox-design-system` |
| `services/save/fake-save-store.ts`, `load-plan.ts`, `save-service.ts`, `schema/save-doc.ts` | `save-persistence-and-migrations` |
| `stores/create-shell-stores.ts` (all four domain stores), `app/stores-context.tsx` | `state-stores` (the Premium store inside it: `premium-purchase`) |
| `services/purchase/fake-purchase.ts` | `premium-purchase` |
| `i18n/i18n-provider.tsx`, `direction-context.tsx`, `languages.ts`, `messages.ts`, `bidi.ts` | `i18n-strings-and-catalogs` |
| `app/services-context.tsx` (`Services`, the nine ports) | `architecture-and-boundaries` |

The helper's own test also needs `ui/app-text.tsx`, the Toybox `ui/button.tsx` (`toybox-components`; it takes `isReducedMotion`) and the catalog keys `premium.buy-button` (`Buy – {priceText}`) and `premium.active` (`Premium – active`, en dash as in the copy deck). A repo from before Toybox that still has `ui/primary-button.tsx` builds `toybox-components` first, which migrates its callers.

## What not to test

- Component trees as snapshots, style objects, class names, private helpers or hook internals. Snapshots exist only in `*.golden.test.ts` as readable data.
- Third-party internals: React Navigation transitions, Skia's rasteriser, Reanimated's animation engine, StoreKit dialogs, Google's consent form content. Test our use of them (adapter mapping, our timeline, our draw calls).
- Translation wording in component tests.
- Layout and mirroring (no Yoga): screenshots do it.
- Timing with real clocks, sleeps or `setTimeout` waits; network; the device's locale or time zone.
- Trivial type-only modules, re-exports and constants tables (covered by the tests that use them).
- The same behaviour at two levels without a reason: a rule proven by properties does not need a component test.

## Good and bad patterns side by side

```tsx
// Good
it('sends a press through the injected port', async () => {
  const user = userEvent.setup();
  const script = scriptWith(PRODUCT);
  await renderWithShell(<BuyProbe />, { services: { purchase: createFakePurchase(script) } });

  await user.press(await screen.findByRole('button', { name: BUY_NAME }));

  expect(script.calls).toStrictEqual(['fetchProduct', 'requestPurchase']);
});

// Bad, and what check-test-code.mjs reports
it('buys', () => {
  render(<BuyProbe />);                                   // rntl-await, render-with-shell
  const { getByText } = render(<BuyProbe />);             // destructured-queries
  fireEvent.press(getByText('Buy'));                      // rntl-await
  expect(screen.queryByText('Premium')).toBeOnTheScreen(); // query-for-presence
  expect(screen.getByText('Error')).not.toBeOnTheScreen(); // get-for-absence
});
```
