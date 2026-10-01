// packages/shell/src/services/audio/recording-feedback.ts
// Test builds only: e2e-maestro's createDebugParts wraps the Shell's AudioPort and HapticsPort
// with TEST_ONLY.recordAudioFeedback(audio, { perfLog, nowMs }) and recordHapticsFeedback(...)
// (reached through the test-only entry, so store builds contain none of it).
// Each sound and haptic cue passes through unchanged and is also appended to the perf log as
// { kind: 'feedback', label: <sound id or haptic cue>, atEpochMs }, which the E2E runner reads
// after the level-1 flow: the simulator evidence that the app asked for the win sound ('ui.win')
// and the success haptic ('success'). How they sound and feel stays the owner's device check.
import type { AudioPort } from './audio-port.ts';
import type { HapticCue, HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** One perf-log entry of kind 'feedback' (the perf log's PerfEntry accepts it). */
export type FeedbackEntry = {
  readonly kind: 'feedback';
  /** The sound id ('ui.win', a game sound) or the haptic cue ('success'). */
  readonly label: string;
  readonly atEpochMs: number;
  /** Sounds carry their timeline delay; haptic cues carry nothing. */
  readonly data: Readonly<Record<string, number>>;
};

/** The same deps as the debug perf actions: the debug services' perf log and their clock. */
export type FeedbackRecorder = {
  /** The test build's perf log (TEST_ONLY.createPerfLog(saveDriver)). */
  readonly perfLog: { append(entry: FeedbackEntry): void };
  /** The simulated clock's nowMs: the entry's time. */
  readonly nowMs: () => number;
};

/** @public The same AudioPort, with every play request also written to the perf log. */
export function recordAudioFeedback(audio: AudioPort, recorder: FeedbackRecorder): AudioPort {
  return {
    ...audio,
    play: (soundId, delayMs = 0) => {
      audio.play(soundId, delayMs);
      recorder.perfLog.append({
        kind: 'feedback',
        label: soundId,
        atEpochMs: recorder.nowMs(),
        data: { delayMs },
      });
    },
  };
}

/** @public The same HapticsPort, with every cue also written to the perf log. */
export function recordHapticsFeedback(
  haptics: HapticsPort,
  recorder: FeedbackRecorder,
): HapticsPort {
  return {
    isSupported: haptics.isSupported,
    play: (cue: HapticCue) => {
      haptics.play(cue);
      const atEpochMs = recorder.nowMs();
      recorder.perfLog.append({ kind: 'feedback', label: cue, atEpochMs, data: {} });
    },
  };
}
