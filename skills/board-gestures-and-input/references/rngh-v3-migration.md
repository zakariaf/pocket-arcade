# Gesture Handler 2 now, 3 later

Expo SDK 57 pins `react-native-gesture-handler` ~2.32.0 (the builder API). SDK 58 moves to ~3.2.1 (the hook API). Read this when upgrading the SDK or when an example online uses the other API.

## Today: RNGH 2.32 builder API

- `Gesture.Tap()`, `Gesture.LongPress()`, `Gesture.Pan()`, composed with `Gesture.Exclusive(pan, longPress, tap)`, attached with `<GestureDetector gesture={gesture}>`.
- Callbacks: `onStart`, `onUpdate`, `onEnd((event, isSuccess) => …)`, `onFinalize`.
- Types: `TapGesture`, `LongPressGesture`, `PanGesture`, `ExclusiveGesture`.
- Install only with `npx expo install react-native-gesture-handler` (never bump past Expo's pin by hand) and re-check with `npx expo install --check`.

## Later: RNGH 3 hook API (SDK 58)

| RNGH 2.32 | RNGH 3 |
|---|---|
| `Gesture.Tap().onEnd((e, success) => …)` | `useTapGesture({ onDeactivate: (e) => { if (e.canceled) return; … } })` |
| `onStart` | `onActivate` |
| `onEnd` | `onDeactivate` |
| `onChange` + `onUpdate` | merged into `onUpdate` |
| `Gesture.Exclusive(a, b, c)` | `useExclusiveGestures(a, b, c)` |
| `TapGesture`, `ExclusiveGesture` … | the builders still exist as deprecated `LegacyTapGesture`, `LegacyExclusiveGesture` … |

Hook gestures and builder gestures cannot be related to each other, so a board cannot mix them.

## The migration plan

1. Upgrade the SDK with the SDK-upgrade runbook; `npx expo install react-native-gesture-handler` picks the new pin.
2. Rewrite `packages/shell/src/game-host/use-board-gestures.ts` as a whole, in one commit: the same exports (`useBoardGestures`, `makeStickGesture` becomes a hook), the same test ids (`board.tap`, `board.long-press`, `board.pan`, `board.stick`), the same single-intent rules. No other board file imports gesture APIs; the one other gesture in the Shell is the Toybox `Slider` (`packages/shell/src/ui/slider.tsx`, a pan and a tap in a race), which moves to the hooks in the same SDK commit (the expo-sdk-upgrade work lists it).
3. Re-read the v3 testing guide for `fireGestureHandler` changes, run `use-board-gestures.test.tsx`, and fix the tests only where the testing API itself changed (never to make a behaviour pass).
4. `node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs .` checks that the gesture API matches the installed major version (`rngh-api-version`).
