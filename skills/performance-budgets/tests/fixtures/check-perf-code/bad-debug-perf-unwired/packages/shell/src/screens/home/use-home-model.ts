// packages/shell/src/screens/home/use-home-model.ts (fixture: Home marks cold start)
import { useColdStartMark } from '@e07/shell/app/perf/use-cold-start-mark.ts';

import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';

export function useHomeMark(perfLog: PerfLog | null): void {
  useColdStartMark(perfLog);
}
