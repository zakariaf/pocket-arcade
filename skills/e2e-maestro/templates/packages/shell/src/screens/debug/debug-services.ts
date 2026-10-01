// packages/shell/src/screens/debug/debug-services.ts
// Test builds only (S15), created through the test-only entry. The debug switches and the debug
// link <scheme>://debug/setup?... reach real services only through these actions:
// - offline=0|1 flips the SimulatedConnectivity the whole app was built with, which tells every
//   ConnectivityPort subscriber (ad policy, connectivity-gated store, S12 reload);
// - premium=0|1 writes the save's premium section first, then dispatches 'debug-premium-set'
//   (never StoreKit, never 'premium-granted', never a direct store write);
// - a consent port for a debug geography comes from createConsentPort, so an ADS_MODE=off build
//   still never calls Google's UMP;
// - date=YYYY-MM-DD sets the SimulatedClock the whole app was built with (today() only);
// - boardLayout=0|1 is kept here, and the board host factory asks isBoardLayoutOn() when it draws
//   (the composition root passes it as createGameBoardHost's isLayoutProbeOn);
// - ads=off|test and seed=<n> are kept here for the ad policy and the game host to read;
// - perfLog is the test build's perf log (performance-budgets): Home's useColdStartMark reads it
//   through useOptionalDebugServices()?.perfLog, which is null in store builds; perf is S15's
//   Performance section over that log (record frame times, share the report, save benchmark).
// Every flag outside the save is written to the test-only key-value store at once and applied
// again when the services are created, so it survives the direction reload and a killed app.
import { createConsentPort } from '@e07/shell/services/consent/consent-factory.ts';

import { decodeDebugOverrides, encodeDebugOverrides } from './debug-overrides.ts';

import type { DebugAdsOverride, DebugOverrides, DebugStore } from './debug-overrides.ts';
import type { DebugPerfActions } from './debug-perf.ts';
import type { SimulatedClock } from './simulated-clock.ts';
import type { SimulatedConnectivity } from './simulated-connectivity.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { DebugGeography } from '@e07/shell/services/consent/admob-consent-adapter.ts';
import type { ConsentAdsMode } from '@e07/shell/services/consent/consent-factory.ts';
import type { ConsentPort } from '@e07/shell/services/consent/consent-port.ts';
import type { PremiumChange } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

export type DebugServiceDeps = {
  /** The same object the composition root handed to every service as its ConnectivityPort. */
  readonly connectivity: SimulatedConnectivity;
  /** The same object the composition root handed to every service as its ClockPort. */
  readonly clock: SimulatedClock;
  /** The test-only key-value store (TEST_ONLY.createSqliteKvDebugStoreAdapter()). */
  readonly store: DebugStore;
  /** TEST_ONLY.createPerfLog(save driver): the cold-start and frame entries e2e:ios reads back. */
  readonly perfLog: PerfLog;
  /** TEST_ONLY.createDebugPerfActions over that perf log: S15's Performance section. */
  readonly perf: DebugPerfActions;
  /** The premium service's synchronous save write (premiumDeps.persistPremium). */
  readonly persistPremium: (change: PremiumChange) => void;
  /** stores.premium.getState().dispatch */
  readonly dispatchPremium: (action: PremiumAction) => void;
  /** ClockPort.nowMs: a revocation carries its date, or the save guard keeps Premium on. */
  readonly nowMs: () => number;
  /** readAdsExtra().adsMode of this build. */
  readonly adsMode: ConsentAdsMode;
  /** ErrorLogPort: consent errors are recorded, never shown. */
  readonly onError: (error: unknown) => void;
};

export type DebugServices = {
  readonly setOffline: (isOffline: boolean) => void;
  readonly isOffline: () => boolean;
  /** date=YYYY-MM-DD (S15 "Set date"); null follows the real calendar again. */
  readonly setDate: (today: DateKey | null) => void;
  readonly setPremium: (isPremium: boolean) => void;
  readonly createConsent: (geography: DebugGeography) => ConsentPort;
  /** boardLayout=0|1: the board renders game.board-layout for flows while it is on (off at first). */
  readonly setBoardLayout: (isOn: boolean) => void;
  readonly isBoardLayoutOn: () => boolean;
  /** ads=test|off, S15 "Always show test ads" / "Never show ads"; null follows the ad policy. */
  readonly setAdsOverride: (ads: DebugAdsOverride | null) => void;
  readonly adsOverride: () => DebugAdsOverride | null;
  /** seed=<n>: the seed the game host uses for the next level run; null uses the level's own. */
  readonly setSeed: (seed: number | null) => void;
  readonly seedOverride: () => number | null;
  /** The perf log (Home's cold-start mark, the frame recorder, the save benchmark, feedback cues). */
  readonly perfLog: PerfLog;
  /** S15's Performance section: record frame times, share the report, run the save benchmark. */
  readonly perf: DebugPerfActions;
};

type Overrides = {
  readonly current: () => DebugOverrides;
  readonly change: (patch: Partial<DebugOverrides>) => void;
};

/**
 * Reads the flags a previous run of this build left, applies them, and saves every change. Only
 * a stored flag is applied: a date set before the services exist (a parity launch sets its frame's
 * date first) is kept, and nothing is switched off that something else switched on.
 */
function restoreOverrides(deps: DebugServiceDeps): Overrides {
  let overrides = decodeDebugOverrides(deps.store.get('debug.overrides'));
  if (overrides.isOffline) deps.connectivity.setSimulatedOffline(true);
  if (overrides.date !== null && deps.clock.simulatedToday() === null) {
    deps.clock.setSimulatedToday(overrides.date);
  }
  return {
    current: () => overrides,
    change: (patch) => {
      overrides = { ...overrides, ...patch };
      deps.store.set('debug.overrides', encodeDebugOverrides(overrides));
    },
  };
}

function premiumAction(deps: DebugServiceDeps): (isPremium: boolean) => void {
  return (isPremium) => {
    deps.persistPremium(
      isPremium ? { isPremium: true } : { isPremium: false, revokedAtMs: deps.nowMs() },
    );
    deps.dispatchPremium({ type: 'debug-premium-set', isPremium });
  };
}

export function createDebugServices(deps: DebugServiceDeps): DebugServices {
  const overrides = restoreOverrides(deps);
  return {
    setOffline: (isOffline) => {
      deps.connectivity.setSimulatedOffline(isOffline);
      overrides.change({ isOffline });
    },
    isOffline: () => overrides.current().isOffline,
    setDate: (today) => {
      deps.clock.setSimulatedToday(today);
      overrides.change({ date: today });
    },
    setPremium: premiumAction(deps),
    createConsent: (geography) =>
      createConsentPort(deps.adsMode, { debugGeography: geography, onError: deps.onError }),
    setBoardLayout: (isOn) => {
      overrides.change({ isBoardLayoutOn: isOn });
    },
    isBoardLayoutOn: () => overrides.current().isBoardLayoutOn,
    setAdsOverride: (ads) => {
      overrides.change({ ads });
    },
    adsOverride: () => overrides.current().ads,
    setSeed: (seed) => {
      overrides.change({ seed });
    },
    seedOverride: () => overrides.current().seed,
    perfLog: deps.perfLog,
    perf: deps.perf,
  };
}
