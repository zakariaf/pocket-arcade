// packages/tooling/src/e2e/save-benchmark-evidence.ts
// Simulator evidence that the save layer stays inside its budget on the device stack: the Shell's
// smoke flow 04-debug-performance taps S15's "Run save benchmark" (debug.perf-benchmark-row), which
// writes the largest realistic save 300 times into a scratch database and appends one
// { kind: 'save-benchmark', label: 'save-write', data: { p50, p95, max, writes } } entry to the perf
// log. The runner reads the log right after the flows step (that flow is the last one: the Shell's
// flows sort after the game's, smoke/04 last) and writes reports/e2e/<game-id>/save-benchmark.json;
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
