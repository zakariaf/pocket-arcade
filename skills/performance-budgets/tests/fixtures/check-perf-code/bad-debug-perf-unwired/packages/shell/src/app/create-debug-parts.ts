// packages/shell/src/app/create-debug-parts.ts (fixture: planted, the perf log but no debug perf actions)
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { TestOnlyApi } from '@e07/shell/app/test-only-api.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export function perfLogOf(api: TestOnlyApi | null, driver: SqlDriver): PerfLog | null {
  return api === null ? null : api.createPerfLog(driver);
}

