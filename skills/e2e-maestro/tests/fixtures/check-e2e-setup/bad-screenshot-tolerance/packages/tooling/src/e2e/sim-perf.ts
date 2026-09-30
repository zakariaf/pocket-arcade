// packages/tooling/src/e2e/sim-perf.ts — the judges behind the simulator performance steps of
// `npm run e2e:ios`: cold start (6 launches, the first dropped as warm-up, median against the
// committed baseline x coldStartSimRegressionFactor) and memory (phys_footprint after the game's
// smoke flow against memoryFootprintMbMax). Pure functions; run-e2e-ios.ts does the simctl work.

/** Launches per cold-start run: the first warms the simulator's caches and is dropped. */
export const COLD_LAUNCHES = 6;
/** footprint reports bytes; its "MB" is 1,048,576 bytes. */
const BYTES_PER_MB = 1_048_576;

export type PerfBudgets = {
  readonly coldStartSimRegressionFactor: number;
  readonly memoryFootprintMbMax: number;
};

export const DEFAULT_PERF_BUDGETS: PerfBudgets = {
  coldStartSimRegressionFactor: 1.2,
  memoryFootprintMbMax: 150,
};

export type ColdStartResult = {
  /** totalMs of each launch of this run, in launch order (the first is the warm-up). */
  readonly launchesMs: readonly number[];
  readonly medianMs: number;
  /** null: no committed baseline yet, this run writes the first one. */
  readonly baselineMs: number | null;
  readonly limitMs: number | null;
  readonly isRegression: boolean;
};

export type MemoryResult = {
  readonly physFootprintBytes: number;
  readonly physFootprintMb: number;
  readonly limitMb: number;
  readonly isOver: boolean;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The perf budgets from quality-gates.json ("perf"), falling back to the product defaults. */
export function perfBudgetsFrom(qualityGates: unknown): PerfBudgets {
  const perf = isRecord(qualityGates) && isRecord(qualityGates['perf']) ? qualityGates['perf'] : {};
  const factor = perf['coldStartSimRegressionFactor'];
  const memory = perf['memoryFootprintMbMax'];
  return {
    coldStartSimRegressionFactor:
      typeof factor === 'number' ? factor : DEFAULT_PERF_BUDGETS.coldStartSimRegressionFactor,
    memoryFootprintMbMax:
      typeof memory === 'number' ? memory : DEFAULT_PERF_BUDGETS.memoryFootprintMbMax,
  };
}

export type ColdStartEntry = { readonly atEpochMs: number; readonly totalMs: number };

/** The cold-start entries of the perf_log payload (a JSON array of entries), oldest first. */
export function coldStartEntries(perfLog: unknown): ColdStartEntry[] {
  if (!Array.isArray(perfLog)) return [];
  const rows: ColdStartEntry[] = [];
  for (const entry of perfLog as readonly unknown[]) {
    if (!isRecord(entry) || entry['kind'] !== 'cold-start' || !isRecord(entry['data'])) continue;
    const atEpochMs = entry['atEpochMs'];
    const totalMs = entry['data']['totalMs'];
    if (typeof atEpochMs === 'number' && typeof totalMs === 'number') {
      rows.push({ atEpochMs, totalMs });
    }
  }
  return rows.sort((a, b) => a.atEpochMs - b.atEpochMs);
}

/**
 * The newest cold start, or null. A launch has been measured once this is newer than before the
 * launch (compare atEpochMs, not counts: the log is a ring buffer of 200 entries).
 */
export function latestColdStart(perfLog: unknown): ColdStartEntry | null {
  return coldStartEntries(perfLog).at(-1) ?? null;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return Number.NaN;
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
}

/** The committed baseline file perf-baselines/cold-start-sim-<game>.json = { "medianMs": n }. */
export function baselineMsFrom(baselineFile: unknown): number | null {
  const value = isRecord(baselineFile) ? baselineFile['medianMs'] : undefined;
  return typeof value === 'number' && value > 0 ? value : null;
}

export function judgeColdStart(
  launchesMs: readonly number[],
  baselineMs: number | null,
  budgets: PerfBudgets,
): ColdStartResult {
  if (launchesMs.length < COLD_LAUNCHES) {
    throw new Error(
      `cold start: ${String(launchesMs.length)} of ${String(COLD_LAUNCHES)} launches recorded a cold-start entry`,
    );
  }
  const medianMs = median(launchesMs.slice(-COLD_LAUNCHES).slice(1));
  const limitMs = baselineMs === null ? null : baselineMs * budgets.coldStartSimRegressionFactor;
  return {
    launchesMs,
    medianMs,
    baselineMs,
    limitMs,
    isRegression: limitMs !== null && medianMs > limitMs,
  };
}

/** phys_footprint of the one process in `footprint --pid <pid> -j <file> -f bytes` output. */
export function physFootprintFrom(footprintJson: unknown): number | null {
  if (!isRecord(footprintJson) || !Array.isArray(footprintJson['processes'])) return null;
  const [measured] = footprintJson['processes'] as readonly unknown[];
  if (!isRecord(measured) || !isRecord(measured['auxiliary'])) return null;
  const bytes = measured['auxiliary']['phys_footprint'];
  return typeof bytes === 'number' && bytes > 0 ? bytes : null;
}

export function judgeMemory(physFootprintBytes: number, budgets: PerfBudgets): MemoryResult {
  const physFootprintMb = Math.round((physFootprintBytes / BYTES_PER_MB) * 10) / 10;
  return {
    physFootprintBytes,
    physFootprintMb,
    limitMb: budgets.memoryFootprintMbMax,
    isOver: physFootprintBytes > budgets.memoryFootprintMbMax * BYTES_PER_MB,
  };
}
