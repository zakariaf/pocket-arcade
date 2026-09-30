// packages/shell/src/testing/create-test-adapters.ts
// What createShellParts gets on a phone (device-adapters.ts), in memory: the composition root's
// tests build the whole app from these fakes, exactly the way the device boots.
import { createNavigationContainerRef } from '@react-navigation/native';

import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { ShellAdapters } from '@e07/shell/app/create-shell-parts.ts';
import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { FakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import type { FakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import type { FakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import type { FakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';

/** expo.extra.game of a test app whose id is the tally game's. */
export const TEST_GAME_EXTRA: GameExtra = {
  id: 'tally',
  premiumProductId: 'com.example.tally.premium',
  adPolicy: {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  modes: { daily: true, endless: true },
  levels: { packCount: 1, levelsPerPack: 3 },
  hints: { freePerDay: 1 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/tally/privacy' },
    supportEmail: 'support@example.com',
  },
};

export type TestAdapters = ShellAdapters & {
  readonly saveStore: FakeSaveStore;
  readonly errorLog: FakeErrorLog;
  readonly connectivity: FakeConnectivity;
  /** The store fake behind createPurchase (ungated), for tests that script it. */
  readonly purchase: FakePurchase;
  readonly audio: ReturnType<typeof createFakeAudio>;
  /** Every store call the purchase fake answered, in order. */
  readonly purchaseCalls: string[];
};

export type TestAdapterOptions = {
  /** The first connectivity answer (the device adapter starts offline until expo-network reports). */
  readonly isOnline?: boolean;
  /** The save.db from a previous launch (fake slots), e.g. createTestSave().store. */
  readonly saveStore?: FakeSaveStore;
  /** The real createDebugParts (with its key-value adapters mocked) for tests of the debug path. */
  readonly createDebugParts?: ShellAdapters['createDebugParts'];
};

/** What createDebugParts returns in a store build: no debug services, no link handler. */
function storeBuildDebugParts(): DebugParts {
  return { services: null, links: null, navigationRef: createNavigationContainerRef() };
}

export function createTestAdapters(options: TestAdapterOptions = {}): TestAdapters {
  const purchaseCalls: string[] = [];
  const purchase = createFakePurchase({
    isConnected: true,
    product: {
      productId: 'com.example.tally.premium',
      displayPrice: '€1.99',
      price: 1.99,
      currency: 'EUR',
    },
    restoreResult: 'synced',
    transactions: [],
    calls: purchaseCalls,
  });
  return {
    saveStore: options.saveStore ?? createFakeSaveStore(),
    // The save database's driver: only a test build's perf log writes through it here.
    saveDriver: {
      exec: () => undefined,
      run: () => undefined,
      get: () => null,
      transaction: (work) => {
        work();
      },
    },
    errorLog: createFakeErrorLog(TEST_CLOCK),
    clock: TEST_CLOCK,
    connectivity: createFakeConnectivity(options.isOnline ?? true),
    audio: createFakeAudio(),
    createHaptics: () => createFakeHaptics(),
    // As on a device: the store port is gated by the app's connectivity where it is created.
    createPurchase: (isOnline) => withConnectivity(purchase, isOnline),
    purchase,
    purchaseCalls,
    deviceLocales: [{ languageCode: 'en', languageScriptCode: null }],
    // A store build's debug parts: the tests that need S15's services build their own.
    createDebugParts: options.createDebugParts ?? storeBuildDebugParts,
    config: { game: TEST_GAME_EXTRA, ads: { adsMode: 'off', adUnits: null }, appVersion: '1.0.0' },
  };
}
