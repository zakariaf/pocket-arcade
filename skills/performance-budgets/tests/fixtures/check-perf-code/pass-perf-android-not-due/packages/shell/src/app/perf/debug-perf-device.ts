// packages/shell/src/app/perf/debug-perf-device.ts
// device-only: covered by the debug menu's Performance section (S15) on the simulator: the scratch database, the share sheet and the build's ids.
// The device side of createDebugPerfActions: a test build's debug menu uses these; the Jest test
// passes its own. Test builds only (reached through debug-perf-actions.ts and the test-only entry).
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { createExpoSqliteSqlDriver } from '@e07/shell/services/save/expo-sqlite-sql-driver.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { deviceNow } from './save-benchmark.ts';
import { sharePerfReport } from './share-perf-report.ts';

import type { PerfLog } from './perf-log.ts';
import type { PerfReportHeader } from './share-perf-report.ts';
import type { SaveStore } from '@e07/shell/services/save/save-store.ts';

/** A save store on another database file, and how to close that file. */
export type ScratchSaveStore = { readonly store: SaveStore; readonly close: () => void };

export type PerfDevice = {
  /** Opens the save layer on another database file: the benchmark's scratch perf-bench.db. */
  readonly openScratchStore: (fileName: string) => ScratchSaveStore;
  /** High-resolution ms for the benchmark. */
  readonly now: () => number;
  /** App id, version, build number and platform for the shared report. */
  readonly header: () => PerfReportHeader;
  /** The iOS share sheet with the whole log (nothing is sent by our code). */
  readonly share: (log: PerfLog, header: PerfReportHeader) => Promise<void>;
};

function perfReportHeader(): PerfReportHeader {
  const config = Constants.expoConfig;
  return {
    appId: config?.ios?.bundleIdentifier ?? 'unknown',
    appVersion: config?.version ?? 'unknown',
    buildNumber: config?.ios?.buildNumber ?? 'unknown',
    deviceModel: `${Platform.OS} ${String(Platform.Version)}`,
  };
}

/** The real save layer (the same SQLite writes as the player's save) on a scratch file. */
function openScratchStore(fileName: string): ScratchSaveStore {
  const driver = createExpoSqliteSqlDriver(fileName);
  return {
    store: createSqliteSaveStore(driver),
    close: () => {
      driver.close();
    },
  };
}

export const DEVICE_PERF: PerfDevice = {
  openScratchStore,
  now: deviceNow,
  header: perfReportHeader,
  share: sharePerfReport,
};
