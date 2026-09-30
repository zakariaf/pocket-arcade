// packages/shell/src/app/test-only-api.ts (fixture: the perf member of the shared pair)
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export type TestOnlyApi = {
  readonly TEST_BUILD_SENTINEL: string;
  readonly createPerfLog: (driver: SqlDriver) => PerfLog;
};
