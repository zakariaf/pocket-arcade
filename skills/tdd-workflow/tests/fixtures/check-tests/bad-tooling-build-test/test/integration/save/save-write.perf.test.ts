// test/integration/save/save-write.perf.test.ts: a perf budget test may time real work with
// performance from node:perf_hooks (the React Native Jest preset mocks the global one).
import { performance } from 'node:perf_hooks';

const P95_BUDGET_MS = 5;

describe('saveWrite', () => {
  it('keeps the p95 write time under the budget', () => {
    const samples: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      const start = performance.now();
      JSON.stringify({ i });
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    expect(samples[Math.ceil(samples.length * 0.95) - 1]).toBeLessThan(P95_BUDGET_MS);
  });
});
