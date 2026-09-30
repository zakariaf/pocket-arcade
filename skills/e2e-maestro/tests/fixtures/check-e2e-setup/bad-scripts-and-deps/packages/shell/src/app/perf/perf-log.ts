// packages/shell/src/app/perf/perf-log.ts
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export type PerfEntry = {
  readonly kind: 'frames' | 'cold-start' | 'save-benchmark';
  readonly label: string;
  readonly atEpochMs: number;
  readonly data: Readonly<Record<string, number | null | readonly number[]>>;
};
export type PerfLog = {
  append(entry: PerfEntry): void;
  entries(): readonly PerfEntry[];
};

const MAX_ENTRIES = 200;

/** Test builds only. One JSON row in the save database (ring buffer of the last 200 entries). */
export function createPerfLog(driver: SqlDriver): PerfLog {
  driver.exec(
    'CREATE TABLE IF NOT EXISTS perf_log (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
  );
  const entries = (): readonly PerfEntry[] => {
    const payload = driver.get('SELECT payload FROM perf_log WHERE id = 1', [])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as PerfEntry[]) : [];
  };
  return {
    entries,
    append: (entry) => {
      const next = [...entries(), entry].slice(-MAX_ENTRIES);
      driver.run('INSERT OR REPLACE INTO perf_log (id, payload) VALUES (1, ?)', [
        JSON.stringify(next),
      ]);
    },
  };
}
