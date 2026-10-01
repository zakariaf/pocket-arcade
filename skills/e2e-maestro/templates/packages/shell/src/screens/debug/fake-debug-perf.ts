// packages/shell/src/screens/debug/fake-debug-perf.ts
// Jest only: S15's Performance actions in memory. The switch keeps its state, the save benchmark
// appends one save-benchmark entry to the given perf log, and every call is listed in calls.
import type { DebugPerfActions } from './debug-perf.ts';
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';

export type FakeDebugPerf = DebugPerfActions & {
  /** 'record on', 'record off', 'share', 'benchmark', in call order. */
  readonly calls: readonly string[];
};

export function createFakeDebugPerf(perfLog: PerfLog | null = null): FakeDebugPerf {
  const calls: string[] = [];
  let isRecording = false;
  return {
    calls,
    isRecording: () => isRecording,
    setRecording: (isOn) => {
      isRecording = isOn;
      calls.push(isOn ? 'record on' : 'record off');
    },
    share: () => {
      calls.push('share');
      return Promise.resolve();
    },
    runSaveBenchmark: () => {
      calls.push('benchmark');
      perfLog?.append({
        kind: 'save-benchmark',
        label: 'save-write',
        atEpochMs: 0,
        data: { p50: 0.2, p95: 0.4, max: 0.9 },
      });
    },
  };
}
