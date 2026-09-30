// test/integration/save/save-write.perf.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The RN Jest preset replaces global performance.now with a 1 ms Date.now mock.
import { performance } from 'node:perf_hooks';

import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { encodeSaveDoc, validateSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WRITES = 300;
const WARMUP = 20;
const P95_BUDGET_MS = 5; // perf.saveWriteP95MsMax in quality-gates.json
const META = { appVersion: '1.0.0', writtenAtMs: 1_790_000_000_000, writeCount: 1 };
const TODAY = '2026-09-26';

/** Worst realistic document: 90 levels, 60 daily results (older ones are pruned), a 200-move run. */
function makeLargeSaveDoc(): SaveDoc {
  const base = createDefaultSaveDoc('line-siege');
  const levels = Object.fromEntries(
    Array.from({ length: 90 }, (_, i) => [
      String(i + 1),
      { stars: 3, bestScore: 1000 + i, bestMoves: 7, completions: 2, firstCompletedOn: TODAY },
    ]),
  );
  const results = Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [
      addDays(TODAY, -i),
      { won: i % 3 !== 0, score: i * 7, moves: 11, playMs: 120_000 },
    ]),
  );
  const log = Array.from({ length: 200 }, (_, i) => ({
    kind: 'move' as const,
    move: { column: i % 7 },
  }));
  const candidate: unknown = {
    ...base,
    progress: { ...base.progress, levels },
    daily: { ...base.daily, results },
    run: {
      ref: { kind: 'level', level: 12 },
      seed: 42,
      difficulty: 12,
      stateVersion: 1,
      state: { columns: [3, 1, 4, 1, 5, 9, 2], score: 4210 },
      log,
      moveCount: 200,
      undoCount: 0,
      hintsUsed: 0,
      continuesUsed: 0,
      playMs: 900_000,
      resumeOnLaunch: true,
    },
  };
  const checked = validateSaveDoc(candidate);
  if ('error' in checked) throw new Error(`large save fixture is invalid: ${checked.error}`);
  return checked.doc;
}

function percentile(sortedMs: readonly number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[index] ?? Number.NaN;
}

describe('SqliteSaveStore write performance', () => {
  it('writes the largest realistic save with p95 under 5 ms (WAL + synchronous FULL)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'save-perf-'));
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(makeLargeSaveDoc(), META);
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
