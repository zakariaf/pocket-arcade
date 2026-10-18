// packages/tooling/src/e2e/android-memory.ts
// The emulator memory check, pure. `adb -s <serial> shell dumpsys meminfo <package>` after the
// game's smoke flows and a relaunch. The budget is the one of both platforms,
// quality-gates.json perf.memoryFootprintMbMax (150 MB), and so is the quantity: iOS judges
// phys_footprint, the app's dirty and compressed memory without its clean file-backed pages, and
// the Android number like it is the TOTAL row's Private Dirty plus the swapped-out part (TOTAL SWAP
// PSS). Total PSS also counts the clean, reclaimable mapped code (.apk, .dex, .so: about 82 of the
// 211 MB Line Siege showed in E18-T24), so it is kept as information only (lead decision,
// 2026-10-17). dumpsys prints kilobytes; an MB is 1024 KB.
import type { PerfBudgets } from '@e07/tooling/e2e/sim-perf.ts';

export type MemoryReading = {
  readonly totalPssKb: number;
  readonly privateDirtyKb: number;
  /** 0 where the device reports no swap. */
  readonly swapPssKb: number;
};

export type MemoryResult = MemoryReading & {
  /** privateDirtyKb + swapPssKb: the number judged. */
  readonly footprintKb: number;
  /** MB of 1024 KB, one decimal. */
  readonly footprintMb: number;
  readonly totalPssMb: number;
  readonly limitMb: number;
  readonly isOver: boolean;
};

const KB_PER_MB = 1024;

const mbOf = (kb: number): number => Math.round((kb / KB_PER_MB) * 10) / 10;

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

/** The table's column names, from its two header lines ("Private" over "Dirty": "Private Dirty"). */
function columnsOf(lines: readonly string[]): string[] | null {
  const at = lines.findIndex((line) => /^\s*Pss\s+Private\b/.test(line));
  const top = lines[at]?.trim().split(/\s+/);
  const bottom = lines[at + 1]?.trim().split(/\s+/);
  if (at < 0 || top === undefined || bottom === undefined) return null;
  return top.map((name, index) => `${name} ${bottom[index] ?? ''}`.trim());
}

/** Total PSS, private dirty and swap PSS in KB, from the table's TOTAL row; null without a process. */
export function memoryOf(meminfo: string): MemoryReading | null {
  const lines = meminfo.split('\n');
  const columns = columnsOf(lines);
  const totals = lines
    .find((line) => /^\s*TOTAL\s+\d/.test(line))
    ?.trim()
    .split(/\s+/)
    .slice(1)
    .map(Number);
  if (columns === null || totals === undefined) return null;
  const valueOf = (name: string): number | undefined => {
    const index = columns.indexOf(name);
    return index < 0 ? undefined : totals[index];
  };
  const privateDirtyKb = valueOf('Private Dirty');
  const totalPssKb = totalPssKbOf(meminfo);
  if (privateDirtyKb === undefined || totalPssKb === null) return null;
  const summarySwap = /TOTAL SWAP PSS:\s+(\d+)/.exec(meminfo)?.[1];
  const swapPssKb =
    summarySwap === undefined ? (valueOf('SwapPss Dirty') ?? 0) : Number(summarySwap);
  return { totalPssKb, privateDirtyKb, swapPssKb };
}

/** Private dirty + swap against perf.memoryFootprintMbMax; total PSS beside it as information. */
export function judgeMemory(reading: MemoryReading, budgets: PerfBudgets): MemoryResult {
  const limitMb = budgets.memoryFootprintMbMax;
  const footprintKb = reading.privateDirtyKb + reading.swapPssKb;
  return {
    footprintKb,
    footprintMb: mbOf(footprintKb),
    privateDirtyKb: reading.privateDirtyKb,
    swapPssKb: reading.swapPssKb,
    totalPssKb: reading.totalPssKb,
    totalPssMb: mbOf(reading.totalPssKb),
    limitMb,
    isOver: footprintKb > limitMb * KB_PER_MB,
  };
}
