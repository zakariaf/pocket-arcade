# SDK 57 to 58: every change and its fix

The complete, verified list of what moves and what breaks when the repo goes from Expo SDK 57 to 58, with the exact fix for each. Most items were proven in a rehearsal on 2026-09-28: a copy of the bootstrapped skeleton (pilot app, the three packages, tooling gates) moved to `expo 58.0.0-preview.7`, with the 7-day age policy relaxed in that copy only. Read it at runbook step 3 and again for each failing gate during the move.

## Contents

- What was rehearsed, and what was not
- Package moves (the module map)
- Root dev tools: one install command
- One version of every native module: overrides
- Config plugins: expo now has an exports map
- Jest: the Reanimated resolver and the asset-registry mapping
- Gesture Handler 3: hooks replace the builder
- Reanimated 4.7 and Worklets 0.13 at runtime
- Skia 2.11.2
- React 19.3, test-renderer 1.3, @types/react 19.3
- React Native 0.88: removed and changed APIs
- Scene support, Android, expo-doctor
- Confirm at move time

## What was rehearsed, and what was not

Green on the rehearsal copy after the fixes below: `npx expo install --fix`, `npm run typecheck` (every program), `npm run lint`, `npm run format:check`, `npm run test:coverage` (43 tests, 100 %), `npm run knip`, `npx expo install --check` ("Dependencies are up to date"), `npx expo-doctor` (20/20), `npx expo config` for test and store variants, and `npx expo export --platform ios` (586 modules, React Compiler enabled). A Reanimated component rendered under RNTL 14 and a Gesture Handler 3 hook module type-checked.

Not rehearsed (do them on the branch, they are part of the trigger's third condition): `npx expo prebuild --clean`, Release simulator builds, E2E flows, the screenshot matrix, board pixel goldens, and real board, audio, ads and purchase code (the skeleton had none).

## Package moves (the module map)

`npx expo install --fix` wrote these for the packages the apps use (preview.7 values; `assets/expo-sdk-58-preview-module-map.json` holds the whole map):

| Package | SDK 57 | SDK 58 preview |
|---|---|---|
| `react-native` | 0.86.3 | 0.88.0-rc.1 (rc.2 in preview.8) |
| `react` | 19.2.3 | 19.3.0 |
| `react-native-reanimated` | 4.5.1 | 4.7.0 |
| `react-native-worklets` | 0.10.1 | 0.13.0 |
| `react-native-gesture-handler` | ~2.32.0 | ~3.2.1 |
| `@shopify/react-native-skia` | 2.6.2 | 2.11.2 |
| `react-native-screens` | ~4.26.0 | ~4.28.0 |
| `react-native-safe-area-context` | ~5.7.0 | ~5.9.1 |
| `expo-*` modules | ~57.0.x | ~58.0.x (for example `expo-system-ui` ~58.0.2, `expo-sqlite` ~58.0.6, `expo-haptics` ~58.0.1) |
| `jest-expo` / `eslint-config-expo` | ~57.0.5 / ~57.0.2 | ~58.0.3 / ~58.0.2 (preview.8: ~58.0.4 / ~58.0.3) |

`npx expo install expo@<version>` writes the specifier as given (`expo@~57.0.24` wrote `"~57.0.24"` even under `save-exact=true`), so move with `npx expo install expo@~58.0.N` to keep the tilde form, then `npx expo install --fix` in the same app. Packages outside Expo's map (React Navigation, AdMob, `expo-iap`, the audio library, Zustand, valibot, react-intl) do not move with the SDK; check each one's peer ranges against React 19.3 and React Native 0.88 with `npm view <pkg>@<version> peerDependencies` and keep them unless a peer range excludes the new versions.

## Root dev tools: one install command

`jest-expo@58` peers on `@react-native/jest-preset@^0.88.0-rc.1`. Installing it alone failed:

```text
npm error ERESOLVE unable to resolve dependency tree
npm error Found: @react-native/jest-preset@0.86.3
npm error Could not resolve dependency:
npm error peer @react-native/jest-preset@"^0.88.0-rc.1" from jest-expo@58.0.3
```

Install every SDK-tracking root tool in one command (versions from the new module map and React line):

```sh
npm install -D jest-expo@58.0.3 eslint-config-expo@58.0.2 @react-native/jest-preset@0.88.0-rc.1 \
  @react-native/eslint-plugin@0.88.0-rc.1 @types/react@19.3.0 test-renderer@1.3.0
```

Never `--force` or `--legacy-peer-deps`. `typescript` 6.0.3, `jest` 29.7.0 and `@types/jest` 29.5.14 stay.

## One version of every native module: overrides

After the apps moved, npm kept `react-native-reanimated` 4.5.1 and `react-native-worklets` 0.10.x at the root for the Shell's `"*"` peers (other packages still accepted them) and nested 4.7.0 and 0.13.0 under the app. `npm dedupe` did not fix it (it moved worklets to 0.10.4, the `legacy` tag). `npx expo-doctor` failed:

```text
✖ Check that no duplicate dependencies are installed
Found duplicates for react-native-reanimated:
  ├─ react-native-reanimated@4.7.0 (at: node_modules/react-native-reanimated)
  └─ react-native-reanimated@4.5.1 (at: ../../node_modules/react-native-reanimated)
```

Jest (which resolves from the root) would have tested with the old copies. The fix, verified (expo-doctor 20/20 afterwards):

```json
"overrides": {
  "react": "19.3.0",
  "react-native": "0.88.0-rc.1",
  "react-native-reanimated": "4.7.0",
  "react-native-worklets": "0.13.0"
}
```

then `npm install`. Keep these keys afterwards: `check-sdk-alignment.mjs` fails (`overrides`) when any override lies outside the apps' range, so the next move updates them in the same commit. The same holds for every other Shell `"*"` peer key the repo already has (`expo`, Skia, Gesture Handler, `react-native-screens`, `react-native-safe-area-context`, and every native module added since): set each to the version `--fix` installed. If expo-doctor names another duplicate, add that package the same way. `check-sdk-alignment.mjs` also reads `package-lock.json` and fails (`duplicate-native`) on any native module installed twice, and its fix line names the version the apps actually install (`npm ls`), not the floor of their range. The same duplicate can appear without any SDK move: on 2026-09-29 a Shell peer added without its override left `react-native-screens` 4.28.0 and `react-native-safe-area-context` 5.10.0 at the root beside the app's 4.26.2 and 5.7.0 on the very first install (the dependency-management skill now adds the override with the peer).

## Config plugins: expo now has an exports map

SDK 57's `expo` package has no `exports` map, so Node ESM needs `import … from 'expo/config-plugins.js'`. SDK 58's `expo` has one (`"./*": { "types": "./*.d.ts", "default": "./*.js" }`, plus `"./*.json"`), so the old import resolves to `config-plugins.js.js`:

```text
PluginError: Cannot find module '…/node_modules/expo/config-plugins.js.js'
packages/shell/plugins/with-app-variant-marker.ts(2,31): error TS2307: Cannot find module 'expo/config-plugins.js'
```

`npx expo config`, `expo-doctor` and `expo export` all failed until every local plugin imported `'expo/config-plugins'` (type imports too). Change it in the move commit, not before (on SDK 57 the bare specifier does not resolve in Node). `expo/metro-config` in `metro.config.js`, `require('expo/bundledNativeModules.json')` and `"extends": "expo/tsconfig.base"` kept working. During `npx expo install --fix` Expo CLI prints "Skipping config plugin check: Cannot find module …/expo/config-plugins.js.js" until the import is fixed; it is not fatal.

## Jest: the Reanimated resolver and the asset-registry mapping

With Reanimated 4.7 and Worklets 0.13, the unchanged `jest.setup.ts` (Gesture Handler's `jestSetup`, the Worklets mock, `require('react-native-reanimated').setUpTests()`) failed every suite:

```text
[Reanimated] `setCSSEventHandler` is not available in JSReanimated.
  at initializeReanimatedModule (node_modules/react-native-reanimated/src/initializers.native.ts:21:21)
```

Mocking Reanimated (`require('react-native-reanimated/mock')`) fails the same way, because the mock imports the real index. Reanimated's testing guide (4.7.0) prescribes its Jest resolver, which makes Jest pick the web implementations. With it alone, jest-expo 58's own mapping broke:

```text
Could not locate module react-native/asset-registry mapped as: react-native/src/asset-registry.
```

because React Native 0.88 has an exports map that exposes `./asset-registry` but not `./src/*`. Both changes together made every suite pass (plus an RNTL 14 render of an `Animated.View` using `useSharedValue`):

```js
// jest.config.js (SDK 58): two additions, jest.setup.ts unchanged
const WORKSPACE_MODULES = {
  // jest-expo 58 maps this to react-native/src/asset-registry, which React Native 0.88's exports map
  // hides from the Reanimated resolver; point it at the file itself.
  '^react-native/asset-registry$': '<rootDir>/node_modules/react-native/src/asset-registry.js',
  '^@e07/(game-kit|shell|tooling)/(.*)$': '<rootDir>/packages/$1/src/$2',
  '^@e07/([^/]+)/(.*)$': '<rootDir>/apps/$1/src/$2',
};

const SHARED = {
  rootDir: __dirname,
  preset: 'jest-expo/ios',
  // Reanimated 4.7 / Worklets 0.13: pick the non-native (web) implementations under Jest.
  resolver: 'react-native-reanimated/jest/resolver',
  // …the rest unchanged
};
```

`jest.config.js` is a gated path: the move commit carries a `Gate-Change:` trailer. `check-sdk-alignment.mjs` checks both lines (`jest-config`). Also rerun the `golden` project (Skia's `jestEnv.js` and `jestSetup.js` still exist in 2.11.2) and `test:sim`.

## Gesture Handler 3: hooks replace the builder

RNGH 3 still exports the builder (`Gesture.Tap()`, now typed `LegacyTapGesture` and friends) as deprecated, but hook gestures and builder gestures cannot be related to each other, so `use-board-gestures.ts` (the one file that creates board gestures) moves to hooks as a whole, in the move commit, and so does the Toybox `Slider` (`packages/shell/src/ui/slider.tsx`, the only other gesture in the Shell):

| RNGH 2.32 builder | RNGH 3 hook |
|---|---|
| `Gesture.Tap()`, `Gesture.Pan()`, `Gesture.LongPress()` … | `useTapGesture({...})`, `usePanGesture({...})`, `useLongPressGesture({...})` |
| `.onStart(cb)` | `onActivate` |
| `.onEnd((e, success) => …)` | `onDeactivate: (e) => { if (e.canceled) return; … }` |
| `.onChange(cb)` | merged into `onUpdate` |
| `Gesture.Exclusive(a, b)` / `Simultaneous` / `Race` | `useExclusiveGestures(a, b)` / `useSimultaneousGestures` / `useCompetingGestures` |
| types `TapGesture`, `ExclusiveGesture` | `LegacyTapGesture`, `LegacyExclusiveGesture` (builder) |

This module type-checked against RNGH 3.2.1 (and `e.cancelledX` was rejected, so the event shape is real):

```tsx
import { View } from 'react-native';
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

type GestureProbeProps = { readonly onTap: (x: number, y: number) => void };

export function GestureProbe({ onTap }: GestureProbeProps): React.JSX.Element {
  const tap = useTapGesture({
    onDeactivate: (event) => {
      if (event.canceled) {
        return;
      }
      onTap(event.x, event.y);
    },
  });
  const pan = usePanGesture({ onUpdate: () => undefined });
  const both = useExclusiveGestures(tap, pan);
  return (
    <GestureDetector gesture={both}>
      <View />
    </GestureDetector>
  );
}
```

Keep the board contract: at most one `InputIntent` per gesture, hit-testing through `BoardLayout`, `scheduleOnRN` to reach JS. Rerun the gesture tests (`fireGestureHandler`) and check their helpers against the 3.x testing guide. `react-native-gesture-handler/jestSetup` still exists in 3.2.1. `check-sdk-alignment.mjs` fails (`gesture-api`) on any `Gesture.<Kind>(` call once the apps are on RNGH 3, and on v3 hook imports while they are on RNGH 2.

## Reanimated 4.7 and Worklets 0.13 at runtime

- Peer ranges: Reanimated 4.7.0 needs `react-native-worklets` 0.13.x and React Native 0.86 to 0.88; Worklets 0.13.0 needs React Native 0.86 to 0.88.
- The project already uses the current APIs: `.get()`/`.set()` on shared values, `scheduleOnRN` instead of `runOnJS`, the file-level `'worklet';` directive. Recheck them in the versioned docs anyway.
- Re-read `FrameCallbackRegistryUI.ts` of 4.7.0: the board clock depends on how `timeSinceFirstFrame` behaves on re-activation (it reset to 0 in 4.5.1, which is why boards use `timestamp` and a `startAt` sentinel). Keep the sentinel unless the source shows otherwise, and rerun the frame-clock tests.

## Skia 2.11.2

- No install script any more (Skia 2.6.5 and later): delete `@shopify/react-native-skia@2.6.2` from `allowScripts`; `check-sdk-alignment.mjs` fails (`skia-approval`) while it is there. `npm approve-scripts --allow-scripts-pending` must still print "No packages with unreviewed install scripts."
- Board pixel goldens will shift with a new Skia: look at every diff, re-accept only intended changes with `jest -u` and a `Gate-Change:` trailer.
- The immutable path API (`Skia.PathBuilder`) stays the rule; the old `SkPath` mutators (`moveTo`, `addCircle`, `transform`) still exist in 2.11.2's types. `<Canvas onLayout>` still throws on the New Architecture: keep `onSize`.
- `jestEnv.js` and `jestSetup.js` still ship, so the golden Jest project needs no change.

## React 19.3, test-renderer 1.3, @types/react 19.3

- `react` 19.3.0 comes from the module map; the root override follows it.
- `test-renderer` 1.2.x is the React 19.2 line; install 1.3.0 for React 19.3. `jest-expo` 58.0.3 itself depends on `react-test-renderer` 19.3.0.
- Expo's related packages for SDK 58 list `@types/react ~19.3.0` (19.3.0, published 2026-09-09).
- RNTL stays 14.0.1 (its async API is unchanged); rerun the component tests.

## React Native 0.88: removed and changed APIs

| API | In 0.88 | Fix |
|---|---|---|
| `InteractionManager` | removed; in development it throws "InteractionManager has been removed from react-native core. Please refactor long tasks into smaller ones, and use 'requestIdleCallback' instead." (0.86 only warned) | split the task and use `requestIdleCallback` |
| `Modal` `animated` prop | removed | `animationType="none" \| "slide" \| "fade"` |
| `StatusBar` `backgroundColor`, `translucent`, `setBackgroundColor`, `setTranslucent` | removed | delete them; edge to edge, colour the view behind the bar and use safe-area insets |
| `useColorScheme()` | returns `'light' \| 'dark' \| null` (0.86: also `'unspecified'` and `undefined`) | handle `null`; `tsc` flags comparisons with `'unspecified'` |
| package `exports` map | `react-native/Libraries/*` and `react-native/asset-registry` are exported, `react-native/src/*` is not | no deep imports (the ESLint rule already bans them) |

`check-sdk-alignment.mjs --target-sdk 58` finds the first three in source before the move (`removed-rn-api`); fix them on SDK 57 already, where they still work. During `expo export` Metro printed "Attempted to import the module …/react-native/src/private/featureflags/ReactNativeFeatureFlags which is not listed in the exports": a warning from a dependency, not from our code; the bundle was correct.

## Scene support, Android, expo-doctor

- `ios.enableSceneSupport` is a no-op on SDK 58: remove the scene-support entry and its file in the move commit (`check-sdk-alignment.mjs` rule `scene-support`).
- Android (later): SDK 58 moves compileSdk to 37 with AGP 9. Nothing ships on Android yet; the monthly Android smoke build catches it.
- `npx expo-doctor` runs 20 checks on SDK 58 (21 on SDK 57).
- `fsevents@2.3.3` may appear in `npm approve-scripts --allow-scripts-pending` after an `npx expo install`: it is macOS file watching (optional); read its script and approve it.

## Confirm at move time

These values come from the preview. When the trigger is met, re-read them from the stable release and update `assets/sdk-lines.json` and the module map in the same commit:

```sh
node -p "require('expo/package.json').version"                   # after the apps moved
mkdir -p reports && node -p "JSON.stringify(require('expo/bundledNativeModules.json'), null, 2)" > reports/expo-58-module-map.json
npm view react-native-gesture-handler@<map version> version        # and every other map entry you use
```

Check the release notes of Expo SDK 58, React Native 0.88, Reanimated 4.7, Gesture Handler 3 and Skia 2.11 for anything this list does not cover, and add it here in the move commit.
