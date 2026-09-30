// packages/shell/src/app/device-adapters.ts
// device-only: covered by the e2e smoke flow and the simulator kill test (every adapter here opens a native module)
import { getLocales } from 'expo-localization';

import { createDebugParts } from '@e07/shell/app/create-debug-parts.ts';
import { createShellHaptics } from '@e07/shell/app/create-shell-haptics.ts';
import { readAppVersion, readGameExtra } from '@e07/shell/app/read-game-extra.ts';
import { createExamplePicture } from '@e07/shell/game-host/create-example-picture.tsx';
import { readAdsExtra } from '@e07/shell/services/ads/read-ads-extra.ts';
import { createAudioApiAudioAdapter } from '@e07/shell/services/audio/audio-api-audio-adapter.ts';
import { createSystemClockAdapter } from '@e07/shell/services/clock/system-clock-adapter.ts';
import { createExpoNetworkConnectivityAdapter } from '@e07/shell/services/connectivity/expo-network-connectivity-adapter.ts';
import { createSqliteErrorLogAdapter } from '@e07/shell/services/error-log/sqlite-error-log-adapter.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createExpoIapPurchaseAdapter } from '@e07/shell/services/purchase/expo-iap-purchase-adapter.ts';
import { createExpoSqliteSqlDriver } from '@e07/shell/services/save/expo-sqlite-sql-driver.ts';
import { SAVE_DB_FILE } from '@e07/shell/services/save/save-db-schema.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import type { ShellAdapters } from '@e07/shell/app/create-shell-parts.ts';

/**
 * The phone's adapters, each created once per launch (never at module level: a direction reload
 * re-runs every module). The save store and the error log share one save.db connection.
 */
export function createDeviceAdapters(): ShellAdapters {
  const driver = createExpoSqliteSqlDriver(SAVE_DB_FILE);
  const clock = createSystemClockAdapter();
  const errorLog = createSqliteErrorLogAdapter(driver, clock);
  return {
    saveStore: createSqliteSaveStore(driver),
    saveDriver: driver,
    errorLog,
    clock,
    connectivity: createExpoNetworkConnectivityAdapter(),
    audio: createAudioApiAudioAdapter({
      reportError: (error) => {
        errorLog.record('audio', error);
      },
    }),
    createHaptics: (stores, shellClock) =>
      createShellHaptics({ getState: () => stores().settings.getState() }, shellClock),
    createPurchase: (isOnline) => withConnectivity(createExpoIapPurchaseAdapter(), isOnline),
    deviceLocales: getLocales(),
    createDebugParts,
    createExamplePicture: createExamplePicture(),
    config: { game: readGameExtra(), ads: readAdsExtra(), appVersion: readAppVersion() },
  };
}
