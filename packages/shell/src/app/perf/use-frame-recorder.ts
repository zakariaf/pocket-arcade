// packages/shell/src/app/perf/use-frame-recorder.ts
import { useSharedValue } from 'react-native-reanimated';

import { createFrameHistogram, recordFrame } from './frame-histogram.ts';
import { summarizeFrames } from './frame-report.ts';

import type { FrameHistogram } from './frame-histogram.ts';
import type { FrameReport } from './frame-report.ts';
import type { SharedValue } from 'react-native-reanimated';

export type FrameRecorder = {
  readonly histogram: SharedValue<FrameHistogram>;
  readonly isRecording: SharedValue<boolean>;
  readonly start: () => void;
  /** Stops and returns the summary (null when no frame ran). */
  readonly stop: () => FrameReport | null;
};

/**
 * The recorder never owns a frame callback: the board host's existing callback calls
 * sampleFrame(...) so idle screens stay idle (no extra display link).
 */
export function useFrameRecorder(): FrameRecorder {
  const histogram = useSharedValue(createFrameHistogram());
  const isRecording = useSharedValue(false);
  const start = (): void => {
    histogram.set(createFrameHistogram());
    isRecording.set(true);
  };
  const stop = (): FrameReport | null => {
    isRecording.set(false);
    return summarizeFrames(histogram.get());
  };
  return { histogram, isRecording, start, stop };
}

/** Worklet: call from the board host's frame callback with frame.timeSincePreviousFrame. */
export function sampleFrame(
  histogram: SharedValue<FrameHistogram>,
  isRecording: SharedValue<boolean>,
  dtMs: number | null,
): void {
  'worklet';
  if (!isRecording.get() || dtMs === null) return;
  histogram.set(recordFrame(histogram.get(), dtMs));
}
