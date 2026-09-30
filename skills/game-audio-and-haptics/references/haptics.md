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

| `HapticCue` | iOS call (expo-haptics 57.0.3) | Use for | Android later (`performAndroidHapticsAsync`) |
|---|---|---|---|
| `selection` | `selectionAsync()` | toggles, picker steps, tray selection | `AndroidHaptics.Segment_Tick` |
| `light` | `impactAsync(ImpactFeedbackStyle.Light)` | place a piece, move a tile | `AndroidHaptics.Context_Click` |
| `medium` | `impactAsync(ImpactFeedbackStyle.Medium)` | line or column clear, merge, capture | `AndroidHaptics.Confirm` |
| `heavy` | `impactAsync(ImpactFeedbackStyle.Heavy)` | big combo, breach, explosion | `AndroidHaptics.Long_Press` |
| `success` | `notificationAsync(NotificationFeedbackType.Success)` | level won, daily done | `AndroidHaptics.Confirm` |
| `warning` | `notificationAsync(NotificationFeedbackType.Warning)` | illegal move rejected, last life | `AndroidHaptics.Reject` |
| `error` | `notificationAsync(NotificationFeedbackType.Error)` | level lost | `AndroidHaptics.Reject` |

The adapter's `fire(cue)` switch is this table as code; `check-audio-haptics.mjs` verifies every row.

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

- **iPad:** no Taptic Engine. The adapter reports `isSupported: false` (`Platform.OS === 'ios' && Platform.isPad`), and Settings hides the Vibration row (hidden, never greyed out). Android (later) is treated as supported.
- **Low Power Mode, camera running and similar states:** Expo documents that haptics silently do nothing. Every native call ends with `.catch(() => undefined)`: a failed pulse is the expected fallback, never an error for the player.
- **Simulator:** it has no Taptic Engine; `selectionAsync()` runs there without error, which proves only the wiring.

## Testing and the owner's check

- `should-pulse.test.ts`: off means silent, the 40 ms boundary (39 ms dropped, 40 ms allowed), a backwards clock.
- `expo-haptics-adapter.test.ts`: `jest.mock('expo-haptics', factory)` records native calls; the test asserts the full table, the throttle, the setting gate and `isSupported` on an iPhone.
- Everything else (screens, the game host, cue scheduling) uses `createFakeHaptics()` and asserts `played`.
- Strength and feel are judged by the owner on a phone. Ask: does each vibration match its moment, and does any sequence feel like a buzz?
