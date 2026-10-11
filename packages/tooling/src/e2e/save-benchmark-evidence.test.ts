// packages/tooling/src/e2e/save-benchmark-evidence.test.ts
import {
  flowCallsOf,
  SAVE_BENCHMARK_FLOW,
  saveBenchmarkEvidenceOf,
  saveBenchmarkFileText,
} from './save-benchmark-evidence.ts';

const FLOW = 'packages/shell/e2e/flows/smoke/04-debug-performance.yaml';
const AT_EPOCH_MS = 1_790_000_000_000;
const RUN = { p50: 0.3, p95: 0.41, max: 1.2, writes: 300 };

describe('saveBenchmarkEvidenceOf', () => {
  it("keeps the newest save-benchmark entry of the perf log (S15's Run save benchmark)", () => {
    const log = [
      { kind: 'cold-start', label: 'home', atEpochMs: AT_EPOCH_MS, data: { totalMs: 1_049 } },
      {
        kind: 'save-benchmark',
        label: 'save-write',
        atEpochMs: AT_EPOCH_MS,
        data: { ...RUN, p95: 3 },
      },
      { kind: 'save-benchmark', label: 'save-write', atEpochMs: AT_EPOCH_MS + 1, data: RUN },
      { kind: 'feedback', label: 'ui.tap', atEpochMs: AT_EPOCH_MS + 2, data: {} },
    ];
    expect(saveBenchmarkEvidenceOf(log, [FLOW])).toStrictEqual({
      flows: [FLOW],
      entry: { kind: 'save-benchmark', label: 'save-write', atEpochMs: AT_EPOCH_MS + 1, data: RUN },
    });
  });

  it('finds no entry when the flows ran no benchmark, or when there is no log', () => {
    expect(saveBenchmarkEvidenceOf([], [FLOW])).toStrictEqual({ flows: [FLOW], entry: null });
    expect(saveBenchmarkEvidenceOf(null, [])).toStrictEqual({ flows: [], entry: null });
  });
});

describe('saveBenchmarkFileText', () => {
  it('writes indented JSON with one trailing newline', () => {
    expect(saveBenchmarkFileText({ flows: [], entry: null })).toBe(
      '{\n  "flows": [],\n  "entry": null\n}\n',
    );
  });
});

describe('flowCallsOf', () => {
  const GAME = 'apps/line-siege/e2e/flows/smoke/10-level-1.yaml';
  const LATER = 'packages/shell/e2e/flows/smoke/05-later-smoke.yaml';

  it('runs the save benchmark flow in a Maestro call of its own, whatever sorts after it', () => {
    expect(SAVE_BENCHMARK_FLOW).toBe(FLOW);
    expect(flowCallsOf([GAME, FLOW, LATER], [])).toStrictEqual({
      others: [GAME, LATER],
      benchmark: FLOW,
    });
  });

  it('has no benchmark call without the flow, or under a tag filter (one call, never evidence)', () => {
    expect(flowCallsOf([GAME], [])).toStrictEqual({ others: [GAME], benchmark: null });
    expect(flowCallsOf([GAME, FLOW], ['--include-tags', 'endless'])).toStrictEqual({
      others: [GAME, FLOW],
      benchmark: null,
    });
  });
});
