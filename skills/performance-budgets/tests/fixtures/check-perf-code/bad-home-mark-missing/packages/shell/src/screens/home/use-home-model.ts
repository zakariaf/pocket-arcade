// packages/shell/src/screens/home/use-home-model.ts (fixture: planted, Home never marks cold start)
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';

export function useHomeMark(perfLog: PerfLog | null): PerfLog | null {
  return perfLog;
}
