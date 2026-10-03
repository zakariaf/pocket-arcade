// packages/shell/src/app/perf/debug-perf-actions.ts
// Test builds only: the debug menu's Performance section (S15). e2e-maestro's createDebugParts
// builds it once with TEST_ONLY.createDebugPerfActions({ perfLog, nowMs }) over the debug
// services' perf log, so store builds contain none of it. Four actions on the perf layer's pieces:
// - "Record frame times": the frame recorder's shared values (the board host's frame runner feeds
//   sampleFrame from them); switching it off appends one 'frames' entry;
// - "Run save benchmark": the largest realistic save written 300 times into the scratch
//   perf-bench.db (never the player's save.db), then one 'save-benchmark' entry;
// - "Share performance report": sharePerfReport's iOS share sheet;
// - the section's summary line: how many entries of each kind the perf log holds.
import { makeMutable } from 'react-native-reanimated';

import { DEVICE_PERF } from './debug-perf-device.ts';
import { createFrameHistogram } from './frame-histogram.ts';
import { summarizeFrames } from './frame-report.ts';
import { largestRealisticSaveRecord } from './large-save-doc.ts';
import { BENCHMARK_DB_FILE, runSaveBenchmark, saveBenchmarkEntry } from './save-benchmark.ts';

import type { PerfDevice } from './debug-perf-device.ts';
import type { FrameHistogram } from './frame-histogram.ts';
import type { PerfEntry, PerfLog } from './perf-log.ts';
import type { SaveBenchmarkResult } from './save-benchmark.ts';
import type { SharedValue } from 'react-native-reanimated';

export type DebugPerfDeps = {
  /** The debug services' perf log (TEST_ONLY.createPerfLog over the save database). */
  readonly perfLog: PerfLog;
  /** The wall clock of new entries (the simulated clock's nowMs). */
  readonly nowMs: () => number;
  /** The device side (scratch database, clock, header, share sheet); Jest passes its own. */
  readonly device?: Partial<PerfDevice>;
};

/** How many perf-log entries of each kind (the S15 Performance summary line). */
export type PerfSummary = Readonly<Record<PerfEntry['kind'], number>>;

export type DebugPerfActions = {
  readonly isRecording: () => boolean;
  /** On: a fresh histogram; off: the recorded frames become one 'frames' entry (none: nothing). */
  readonly setRecording: (isOn: boolean) => void;
  readonly share: () => Promise<void>;
  readonly runSaveBenchmark: () => SaveBenchmarkResult;
  readonly summary: () => PerfSummary;
  /** For the board host's frame runner: sampleFrame(frames.histogram, frames.isRecording, dt). */
  readonly frames: {
    readonly histogram: SharedValue<FrameHistogram>;
    readonly isRecording: SharedValue<boolean>;
  };
};

/** The game id the benchmark document carries (a scratch file, never a player's save). */
const BENCHMARK_GAME_ID = 'perf-benchmark';
const EMPTY_SUMMARY: PerfSummary = {
  frames: 0,
  'cold-start': 0,
  'save-benchmark': 0,
  feedback: 0,
  'board-clock': 0,
};

function summaryOf(entries: readonly PerfEntry[]): PerfSummary {
  return entries.reduce<PerfSummary>(
    (counts, entry) => ({ ...counts, [entry.kind]: counts[entry.kind] + 1 }),
    EMPTY_SUMMARY,
  );
}

/** The benchmark on the scratch file, closed afterwards. */
function benchmarkOn(device: PerfDevice): SaveBenchmarkResult {
  const scratch = device.openScratchStore(BENCHMARK_DB_FILE);
  try {
    const record = largestRealisticSaveRecord(BENCHMARK_GAME_ID);
    return runSaveBenchmark({ store: scratch.store, record, now: device.now });
  } finally {
    scratch.close();
  }
}

/** @public Reached through the test-only entry (TEST_ONLY.createDebugPerfActions). */
export function createDebugPerfActions(deps: DebugPerfDeps): DebugPerfActions {
  const device: PerfDevice = { ...DEVICE_PERF, ...deps.device };
  const histogram = makeMutable(createFrameHistogram());
  const isRecording = makeMutable(false);
  return {
    isRecording: () => isRecording.get(),
    setRecording: (isOn) => {
      if (isOn) histogram.set(createFrameHistogram());
      isRecording.set(isOn);
      const report = isOn ? null : summarizeFrames(histogram.get());
      if (report === null) return;
      const atEpochMs = deps.nowMs();
      deps.perfLog.append({ kind: 'frames', label: 'debug-menu', atEpochMs, data: report });
    },
    share: () => device.share(deps.perfLog, device.header()),
    runSaveBenchmark: () => {
      const result = benchmarkOn(device);
      deps.perfLog.append(saveBenchmarkEntry(result, deps.nowMs()));
      return result;
    },
    summary: () => summaryOf(deps.perfLog.entries()),
    frames: { histogram, isRecording },
  };
}
