// packages/tooling/src/e2e/sim-perf.test.ts
import {
  baselineMsFrom,
  coldStartEntries,
  DEFAULT_PERF_BUDGETS,
  judgeColdStart,
  judgeMemory,
  latestColdStart,
  median,
  perfBudgetsFrom,
  physFootprintFrom,
} from './sim-perf.ts';

const coldStart = (atEpochMs: number, totalMs: number): object => ({
  kind: 'cold-start',
  label: 'launch',
  atEpochMs,
  data: { nativeMs: totalMs - 40, jsMs: 40, totalMs },
});

// The shape `footprint --pid <pid> -j <file> -f bytes --noCategories` wrote for a simulator app.
const FOOTPRINT = {
  unit: 'byte',
  processes: [
    {
      name: 'LineSiege',
      pid: 54_487,
      footprint: 46_581_848,
      auxiliary: { phys_footprint_peak: 48_482_392, phys_footprint: 48_433_240 },
    },
  ],
  errors: [],
};

describe('coldStartEntries', () => {
  it('returns the cold starts of the perf log, oldest first', () => {
    const log = [
      coldStart(300, 710),
      { kind: 'frames', atEpochMs: 250, data: { frames: 10 } },
      coldStart(100, 999),
      coldStart(200, 690),
    ];

    expect(coldStartEntries(log).map((entry) => entry.totalMs)).toStrictEqual([999, 690, 710]);
    expect(latestColdStart(log)).toStrictEqual({ atEpochMs: 300, totalMs: 710 });
  });

  it('ignores a payload that is not a list of entries', () => {
    expect(coldStartEntries({ entries: [] })).toStrictEqual([]);
    expect(latestColdStart([{ kind: 'cold-start', data: { totalMs: null } }])).toBeNull();
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect([median([5, 1, 3]), median([4, 1, 3, 2]), median([])]).toStrictEqual([3, 2.5, NaN]);
  });
});

describe('judgeColdStart', () => {
  it('drops the first launch and compares the median with the baseline times 1.2', () => {
    const result = judgeColdStart([900, 600, 610, 620, 630, 640], 500, DEFAULT_PERF_BUDGETS);

    expect(result).toMatchObject({ medianMs: 620, limitMs: 600, isRegression: true });
  });

  it('passes a run at exactly the limit', () => {
    const result = judgeColdStart([900, 600, 600, 600, 600, 600], 500, DEFAULT_PERF_BUDGETS);

    expect(result.isRegression).toBe(false);
  });

  it('judges nothing without a baseline, so the first run can write one', () => {
    const result = judgeColdStart([900, 600, 610, 620, 630, 640], null, DEFAULT_PERF_BUDGETS);

    expect(result).toMatchObject({ baselineMs: null, limitMs: null, isRegression: false });
  });

  it('refuses a run with fewer than six recorded launches', () => {
    expect(() => judgeColdStart([600, 610], 500, DEFAULT_PERF_BUDGETS)).toThrow(
      'cold start: 2 of 6 launches recorded a cold-start entry',
    );
  });
});

describe('baselineMsFrom', () => {
  it('reads medianMs and rejects anything else', () => {
    expect([
      baselineMsFrom({ medianMs: 648 }),
      baselineMsFrom({}),
      baselineMsFrom(0),
    ]).toStrictEqual([648, null, null]);
  });
});

describe('perfBudgetsFrom', () => {
  it('reads the perf section of quality-gates.json', () => {
    expect(
      perfBudgetsFrom({ perf: { coldStartSimRegressionFactor: 1.1, memoryFootprintMbMax: 120 } }),
    ).toStrictEqual({ coldStartSimRegressionFactor: 1.1, memoryFootprintMbMax: 120 });
  });

  it('falls back to the product defaults', () => {
    expect(perfBudgetsFrom({ a11y: {} })).toStrictEqual(DEFAULT_PERF_BUDGETS);
  });
});

describe('physFootprintFrom', () => {
  it('reads phys_footprint, not the dirty footprint', () => {
    expect(physFootprintFrom(FOOTPRINT)).toBe(48_433_240);
  });

  it('returns null when footprint measured nothing', () => {
    expect(physFootprintFrom({ processes: [], errors: ['no process'] })).toBeNull();
  });
});

describe('judgeMemory', () => {
  it('converts bytes to footprint MB and compares with the 150 MB budget', () => {
    expect(judgeMemory(48_433_240, DEFAULT_PERF_BUDGETS)).toStrictEqual({
      physFootprintBytes: 48_433_240,
      physFootprintMb: 46.2,
      limitMb: 150,
      isOver: false,
    });
    expect(judgeMemory(150 * 1_048_576 + 1, DEFAULT_PERF_BUDGETS).isOver).toBe(true);
  });
});
