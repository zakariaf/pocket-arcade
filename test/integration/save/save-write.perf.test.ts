// test/integration/save/save-write.perf.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The RN Jest preset replaces global performance.now with a 1 ms Date.now mock.
import { performance } from 'node:perf_hooks';

import { largestRealisticSaveRecord } from '@e07/shell/app/perf/large-save-doc.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

const WRITES = 300;
const WARMUP = 20;
const P95_BUDGET_MS = 5; // perf.saveWriteP95MsMax in quality-gates.json

function percentile(sortedMs: readonly number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[index] ?? Number.NaN;
}

describe('SqliteSaveStore write performance', () => {
  it('writes the largest realistic save with p95 under 5 ms (WAL + synchronous FULL)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'save-perf-'));
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    // The debug menu's device benchmark writes the same document (app/perf/large-save-doc.ts).
    const record = largestRealisticSaveRecord('line-siege');
    const samples: number[] = [];
    for (let i = 0; i < WARMUP + WRITES; i += 1) {
      const start = performance.now();
      store.write({ current: record }); // the per-move write: current only
      if (i >= WARMUP) samples.push(performance.now() - start);
    }
    driver.close();
    rmSync(dir, { recursive: true, force: true });
    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 95);
    console.warn(`save write p50=${percentile(samples, 50).toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
