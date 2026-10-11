// packages/tooling/src/e2e/save-benchmark-evidence.ts
// Simulator evidence that the save layer stays inside its budget on the device stack: the Shell's
// smoke flow 04-debug-performance taps S15's "Run save benchmark" (debug.perf-benchmark-row), which
// writes the largest realistic save 300 times into a scratch database and appends one
// { kind: 'save-benchmark', label: 'save-write', data: { p50, p95, max, writes } } entry to the perf
// log. The runner runs that flow in a Maestro call of its own after the other flows (flowCallsOf),
// reads the log right after it and writes reports/e2e/<game-id>/save-benchmark.json;
// check-e2e-report (rule save-benchmark) needs 300 writes and p95 under quality-gates.json's
// perf.saveWriteP95MsMax (5 ms).

export type SaveBenchmarkEvidence = {
  /** The flows the log was read after. */
  readonly flows: readonly string[];
  /** The newest save-benchmark entry of the perf log, or null when no flow ran the benchmark. */
  readonly entry: Readonly<Record<string, unknown>> | null;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

export function saveBenchmarkEvidenceOf(
  perfLog: unknown,
  flows: readonly string[],
): SaveBenchmarkEvidence {
  const entries = (Array.isArray(perfLog) ? (perfLog as unknown[]) : [])
    .filter(isRecord)
    .filter((entry) => entry['kind'] === 'save-benchmark');
  return { flows, entry: entries.at(-1) ?? null };
}

/** save-benchmark.json as written: indented JSON with one trailing newline. */
export function saveBenchmarkFileText(evidence: SaveBenchmarkEvidence): string {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

/** The Shell's smoke flow that runs S15's save benchmark. */
export const SAVE_BENCHMARK_FLOW = 'packages/shell/e2e/flows/smoke/04-debug-performance.yaml';

/** The flows step's Maestro calls: every other flow, then the benchmark flow (null: none). */
export type FlowCalls = { readonly others: readonly string[]; readonly benchmark: string | null };

/**
 * The flows step's Maestro calls: every other flow, then the benchmark flow alone, so its perf-log
 * entry is read right after it, whatever flow sorts last. Under a tag filter (--include-tags, while
 * iterating; never evidence) one call keeps the filter on every flow: Maestro ignores tags for a
 * single flow file, so a call of its own would run the benchmark whatever the filter says.
 */
export function flowCallsOf(flows: readonly string[], maestroArgs: readonly string[]): FlowCalls {
  const benchmark = flows.find((flow) => flow === SAVE_BENCHMARK_FLOW) ?? null;
  if (benchmark === null || maestroArgs.includes('--include-tags')) {
    return { others: flows, benchmark: null };
  }
  return { others: flows.filter((flow) => flow !== benchmark), benchmark };
}
