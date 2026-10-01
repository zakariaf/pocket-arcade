// packages/shell/src/app/perf/perf-log.test.ts
import { createPerfLog } from './perf-log.ts';

import type { PerfEntry } from './perf-log.ts';
import type { SqlDriver, SqlRow, SqlValue } from '@e07/shell/services/save/sql-driver.ts';

/** The one perf_log row, in memory: what the perf log reads and writes through SqlDriver. */
function createRowDriver(): SqlDriver & { readonly ddl: string[] } {
  const ddl: string[] = [];
  let payload: SqlValue | undefined;
  return {
    ddl,
    exec: (sql) => {
      ddl.push(sql);
    },
    run: (_sql, params) => {
      [payload] = params;
    },
    get: (): SqlRow | null => (payload === undefined ? null : { payload }),
    transaction: (work) => {
      work();
    },
  };
}

function entry(index: number): PerfEntry {
  return { kind: 'frames', label: `run-${String(index)}`, atEpochMs: index, data: { p95: index } };
}

describe('createPerfLog', () => {
  it('creates its table once and starts empty', () => {
    const driver = createRowDriver();
    const log = createPerfLog(driver);
    expect(driver.ddl).toStrictEqual([
      'CREATE TABLE IF NOT EXISTS perf_log (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
    ]);
    expect(log.entries()).toStrictEqual([]);
  });

  it('appends entries in order and keeps them for the next launch', () => {
    const driver = createRowDriver();
    createPerfLog(driver).append(entry(1));
    createPerfLog(driver).append(entry(2));
    expect(createPerfLog(driver).entries()).toStrictEqual([entry(1), entry(2)]);
  });

  it("keeps the feedback entries the test build's recording ports append", () => {
    const log = createPerfLog(createRowDriver());
    const win: PerfEntry = {
      kind: 'feedback',
      label: 'ui.win',
      atEpochMs: 5,
      data: { delayMs: 0 },
    };
    const pulse: PerfEntry = { kind: 'feedback', label: 'success', atEpochMs: 6, data: {} };
    log.append(win);
    log.append(pulse);
    expect(log.entries()).toStrictEqual([win, pulse]);
  });

  it('keeps only the newest 200 entries', () => {
    const log = createPerfLog(createRowDriver());
    for (let index = 1; index <= 205; index += 1) log.append(entry(index));
    const kept = log.entries();
    expect([kept.length, kept[0]?.label, kept.at(-1)?.label]).toStrictEqual([
      200,
      'run-6',
      'run-205',
    ]);
  });
});
