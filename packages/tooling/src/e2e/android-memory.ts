// packages/tooling/src/e2e/android-memory.ts
// The emulator memory check, pure (lead decision e): `adb -s <serial> shell dumpsys meminfo
// <package>` after the game's smoke flows and a relaunch, its total PSS (proportional set size: the
// app's private pages plus its share of shared ones) against the same budget as the simulator's
// phys_footprint, quality-gates.json perf.memoryFootprintMbMax (150 MB). dumpsys prints kilobytes.
import type { PerfBudgets } from '@e07/tooling/e2e/sim-perf.ts';

export type PssResult = {
  readonly totalPssKb: number;
  /** MB of 1024 KB, one decimal. */
  readonly totalPssMb: number;
  readonly limitMb: number;
  readonly isOver: boolean;
};

const KB_PER_MB = 1024;

/**
 * Total PSS in KB: the App Summary's "TOTAL PSS:" (Android 11 and later) or "TOTAL:" (older), else
 * the first column of the table's TOTAL row; null when no process was found.
 */
export function totalPssKbOf(meminfo: string): number | null {
  const summary = /^\s*TOTAL(?: PSS)?:\s+(\d+)/m.exec(meminfo)?.[1];
  const table = /^\s*TOTAL\s+(\d+)\s/m.exec(meminfo)?.[1];
  const kb = summary ?? table;
  return kb === undefined ? null : Number(kb);
}

/** Total PSS against perf.memoryFootprintMbMax (the one memory budget of both platforms). */
export function judgePss(totalPssKb: number, budgets: PerfBudgets): PssResult {
  const limitMb = budgets.memoryFootprintMbMax;
  return {
    totalPssKb,
    totalPssMb: Math.round((totalPssKb / KB_PER_MB) * 10) / 10,
    limitMb,
    isOver: totalPssKb > limitMb * KB_PER_MB,
  };
}
