// packages/shell/src/services/audio/ui-feedback.ts
// The Shell's own feedback moments (button tap, toggle, win, lose): which UI sound and which pulse
// each one makes. Games never use these; their sounds come from timeline cues.
import type { AudioPort } from './audio-port.ts';
import type { UI_SOUNDS } from './synth/ui-sounds.ts';
import type { HapticCue, HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

type UiSoundId = keyof typeof UI_SOUNDS;

type Feedback = { readonly sound: UiSoundId; readonly haptic: HapticCue | null };

export const UI_FEEDBACK = {
  /** Any button press, through the Pressable hosts (usePressFeedback). Buttons never pulse. */
  tap: { sound: 'ui.tap', haptic: null },
  /** A toggle row or a picker step: the one UI element that pulses. */
  toggle: { sound: 'ui.toggle', haptic: 'selection' },
  /** The run ends won: once, when the result is decided, before the Result screen shows. */
  win: { sound: 'ui.win', haptic: 'success' },
  /** The run ends lost: once, when the result is decided. */
  lose: { sound: 'ui.lose', haptic: 'error' },
} as const satisfies Readonly<Record<string, Feedback>>;

export type UiFeedbackKind = keyof typeof UI_FEEDBACK;

export type FeedbackPorts = { readonly audio: AudioPort; readonly haptics: HapticsPort };

/** Plays one Shell feedback moment; the ports apply the settings, the voice policy and the throttle. */
export function playUiFeedback(ports: FeedbackPorts, kind: UiFeedbackKind): void {
  const feedback: Feedback = UI_FEEDBACK[kind];
  ports.audio.play(feedback.sound);
  if (feedback.haptic !== null) ports.haptics.play(feedback.haptic);
}
