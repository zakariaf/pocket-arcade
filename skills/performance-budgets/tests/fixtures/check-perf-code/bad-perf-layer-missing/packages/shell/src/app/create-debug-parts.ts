// packages/shell/src/app/create-debug-parts.ts (fixture: the perf log of test builds)
import type { DebugPerfActions, DebugPerfDeps } from '@e07/shell/app/perf/debug-perf-actions.ts';
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { TestOnlyApi } from '@e07/shell/app/test-only-api.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export function perfLogOf(api: TestOnlyApi | null, driver: SqlDriver): PerfLog | null {
  return api === null ? null : api.createPerfLog(driver);
}

export function perfActionsOf(
  api: TestOnlyApi | null,
  log: PerfLog,
  driver: SqlDriver,
  deps: DebugPerfDeps,
): DebugPerfActions | null {
  return api === null ? null : api.createDebugPerfActions(log, driver, deps);
}
