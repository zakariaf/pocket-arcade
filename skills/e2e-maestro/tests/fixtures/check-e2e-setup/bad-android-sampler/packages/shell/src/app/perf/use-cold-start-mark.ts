// packages/shell/src/app/perf/use-cold-start-mark.ts
import { useEffect } from 'react';

import { markHomeInteractive } from './cold-start.ts';
import { readProcessStartEpochMs } from './process-start.ts';

import type { PerfLog } from './perf-log.ts';

/**
 * Home calls this once its data is on screen. Allowed effect: it measures, it never sets
 * state. The mark lands one frame after the commit, i.e. when Home is actually drawn.
 */
export function useColdStartMark(perfLog: PerfLog | null): void {
  useEffect(() => {
    if (perfLog === null) return undefined;
    const frame = requestAnimationFrame(() => {
      const now = Date.now();
      const report = markHomeInteractive(now, readProcessStartEpochMs());
      if (report !== null)
        perfLog.append({ kind: 'cold-start', label: 'home', atEpochMs: now, data: report });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [perfLog]);
}
