# Haptics: the port, the cue table, the throttle

Vibration in Pocket Arcade is a short tap on meaningful events (place, clear, win, lose). It follows the Vibration setting, is throttled, never throws, and is hidden on iPads, which have no Taptic Engine.

## Contents

- The port and the adapter
- The cue table
- Rules of use
- The throttle and the gate
- Devices and failure modes
- Testing and the owner's check

## The port and the adapter

`packages/shell/src/services/haptics/haptics-port.ts`:

```ts
export type HapticsPort = {
  /** False on devices without a Taptic Engine: Settings hides the Vibration row. */
  readonly isSupported: boolean;
  /** Fire-and-forget. Gated by the Vibration setting and throttled; never throws. */
  readonly play: (cue: HapticCue) => void;
};
```

`HapticCue` is `'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'`, defined in game-kit (`timeline/track.ts`) because timeline cues use it.

`expo-haptics-adapter.ts` is the only file that imports `expo-haptics` (installed with `npx expo install expo-haptics`, ~57.0.3). The composition root creates it once:

```ts
const haptics = createExpoHapticsAdapter({
  isEnabled: () => selectIsVibrationOn(stores.settings.getState()), // read at call time
  nowMs: clock.nowMs, // ClockPort, never Date.now()
});
```

Never import `Vibration` from `react-native`, and never add another haptics library.

## The cue table

| `HapticCue` | iOS call (expo-haptics 57.0.3) | Use for | Android (`performAndroidHapticsAsync`, expo-haptics 57.0.3) |
|---|---|---|---|
| `selection` | `selectionAsync()` | toggles, picker steps, tray selection | `Segment_Tick` from API 34, else `Clock_Tick` |
| `light` | `impactAsync(ImpactFeedbackStyle.Light)` | place a piece, move a tile | `Context_Click` (every level) |
| `medium` | `impactAsync(ImpactFeedbackStyle.Medium)` | line or column clear, merge, capture | `Confirm` from API 30, else `Virtual_Key` |
| `heavy` | `impactAsync(ImpactFeedbackStyle.Heavy)` | big combo, breach, explosion | `Long_Press` (every level) |
| `success` | `notificationAsync(NotificationFeedbackType.Success)` | level won, daily done | `Confirm` from API 30, else `Virtual_Key` |
| `warning` | `notificationAsync(NotificationFeedbackType.Warning)` | illegal move rejected, last life | `Reject` from API 30, else `Long_Press` |
| `error` | `notificationAsync(NotificationFeedbackType.Error)` | level lost | `Reject` from API 30, else `Long_Press` |

The adapter holds this table as code: `fireIos(cue)` is the iOS column and `fireAndroid(cue)` the Android column, and `fire(cue)` returns `Platform.OS === 'android' ? fireAndroid(cue) : fireIos(cue)`. `check-audio-haptics.mjs` verifies every row of both (`haptic-table`, `haptic-android`).

On Android the column is View haptic feedback (`View.performHapticFeedback`): it feels like the system's own taps and needs no `VIBRATE` permission. Never use `impactAsync`, `notificationAsync` or `selectionAsync` there: on Android they drive the `Vibrator`, which Expo's own docs advise against for haptics. expo-haptics' manifest still declares `android.permission.VIBRATE`, so it stays on the Android permission allowlist. Some types need a newer Android: expo-haptics reads each `HapticFeedbackConstants` field by reflection and rejects a type the phone's API level lacks (`Segment_Tick` from Android 14, API 34; `Confirm` and `Reject` from Android 11, API 30), with a fallback only for `Clock_Tick`, `Context_Click`, `Keyboard_Tap`, `Long_Press` and `Virtual_Key`, which work on every level. A rejection would land in the adapter's `.catch(() => undefined)` and the pulse would be silently absent, so `fireAndroid` reads `Number(Platform.Version)` and plays each newer type only from its level, falling back to an every-level type below it (the table's "else" types; written as `api >= 34 ? AndroidHaptics.Segment_Tick : AndroidHaptics.Clock_Tick`, which `haptic-android` checks exactly). Every cue therefore pulses on API 24 and up when Vibration is on. `expo-haptics-adapter.android.test.ts` pins the column on API 36, 34, 33 and 29, a pass over every level from 24 to 36, and that a rejected type is still swallowed with the next pulse playing (the jest-expo Android preset reports no `Platform.Version`, so the test sets it with `jest.spyOn(Platform, 'Version', 'get')`).

## Rules of use

- Fire haptics only on meaningful events: from timeline cues (`cue: { haptic: 'medium' }`) or the Shell's UI feedback. Never per frame, and never from a real-time sim's per-tick events (drain events on JS and pick the few that matter).
- The Shell's own pulses come from `playUiFeedback` (audio-architecture.md, "UI feedback"): `selection` with every toggle, `success` when a run is won, `error` when it is lost. Do not add a second `success`/`error` cue on a game's final track: the throttle would drop one of them anyway, and the result moment belongs to the Shell.
- Buttons use no haptics. The one UI exception is `selection` on toggles (and picker steps).
- One pulse per visible event. A cascade that clears five lines gets one `medium` or one `heavy`, not five pulses; the throttle would drop most of them anyway.
- Match strength to importance: `light` for the most repeated action, `medium` for a payoff, `heavy` for a rare big moment, notification types for outcomes.

## The throttle and the gate

`should-pulse.ts` is pure:

- No pulse when the Vibration setting is off.
- No pulse closer than **40 ms** (`MIN_HAPTIC_GAP_MS`) to the previous one: closer pulses feel mushy, like a buzz. The throttle drops extra pulses, so a cascade feels like one strong event.
- `nowMs` is wall-clock epoch time from `ClockPort`, so a clock that jumps backwards (negative gap) lets the pulse through rather than muting haptics.

## Devices and failure modes

- **iPad:** no Taptic Engine. The adapter reports `isSupported: false` (`Platform.OS === 'ios' && Platform.isPad`), and Settings hides the Vibration row (hidden, never greyed out). Android phones and tablets report `isSupported: true`: React Native has no reliable vibrator check, and a tablet without one ignores the feedback silently, so the Vibration row stays.
- **Low Power Mode, camera running and similar states:** Expo documents that haptics silently do nothing. Every native call ends with `.catch(() => undefined)`: a failed pulse is the expected fallback, never an error for the player.
- **Simulator:** it has no Taptic Engine; `selectionAsync()` runs there without error, which proves only the wiring.

## Testing and the owner's check

- `should-pulse.test.ts`: off means silent, the 40 ms boundary (39 ms dropped, 40 ms allowed), a backwards clock.
- `expo-haptics-adapter.test.ts`: `jest.mock('expo-haptics', factory)` records native calls; the test asserts the full table, the throttle, the setting gate and `isSupported` on an iPhone.
- `expo-haptics-adapter.android.test.ts` (the `unit-android` Jest project, where `Platform.OS` is `'android'`): the Android column on a current phone and the every-level fallbacks below API 34 and 30 (`Platform.Version` mocked), never a Vibrator call, the throttle, the setting gate, a rejected type swallowed with the next pulse still playing, and `isSupported` on Android.
- Everything else (screens, the game host, cue scheduling) uses `createFakeHaptics()` and asserts `played`.
- Strength and feel are judged by the owner on a phone. Ask: does each vibration match its moment, and does any sequence feel like a buzz?
