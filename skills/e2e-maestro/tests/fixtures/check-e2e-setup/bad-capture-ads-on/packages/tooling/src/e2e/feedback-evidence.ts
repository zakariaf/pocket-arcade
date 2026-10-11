// packages/tooling/src/e2e/feedback-evidence.ts
// Simulator evidence that the level-1 flow asked for the win feedback. In test builds createDebugParts
// wraps the AudioPort and the HapticsPort with the test-only feedback recorders, which append
// { kind: 'feedback', label: <sound id or haptic cue> } to the perf log. The memory step reads the
// log right after the game's smoke flows and writes reports/e2e/<game-id>/feedback.json;
// check-e2e-report (rule feedback-evidence) needs the win sound and the success haptic in it. This
// proves the app asked for the cues on the simulator; how they sound and feel is the owner's
// device check, and Jest fakes prove the wiring.

/** The haptic cues (game-kit's HapticCue); any other feedback label is a sound id. */
export const HAPTIC_CUES: readonly string[] = [
  'selection',
  'light',
  'medium',
  'heavy',
  'success',
  'warning',
  'error',
];

export type FeedbackEvidence = {
  /** The flows the log was read after. */
  readonly flows: readonly string[];
  /** Sound ids asked for, in order (the Shell's win sound is 'ui.win'). */
  readonly sounds: readonly string[];
  /** Haptic cues asked for, in order. */
  readonly haptics: readonly string[];
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

/** The feedback entries of a perf-log payload (an array of entries; anything else holds none). */
export function feedbackEvidenceOf(perfLog: unknown, flows: readonly string[]): FeedbackEvidence {
  const labels = (Array.isArray(perfLog) ? (perfLog as unknown[]) : [])
    .filter(isRecord)
    .filter((entry) => entry['kind'] === 'feedback' && typeof entry['label'] === 'string')
    .map((entry) => String(entry['label']));
  return {
    flows,
    sounds: labels.filter((label) => !HAPTIC_CUES.includes(label)),
    haptics: labels.filter((label) => HAPTIC_CUES.includes(label)),
  };
}

/** feedback.json as written: indented JSON with one trailing newline. */
export function feedbackFileText(evidence: FeedbackEvidence): string {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}
