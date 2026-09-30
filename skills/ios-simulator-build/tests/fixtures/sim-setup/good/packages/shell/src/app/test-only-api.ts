// packages/shell/src/app/test-only-api.ts
import type { DebugLinkDeps, DebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { DebugServiceDeps, DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { NetworkAttempt, NetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { ComponentType } from 'react';

/** Everything that exists only in test builds (debug menu S15, harness hooks). */
export type TestOnlyApi = {
  readonly DebugScreen: ComponentType;
  /** The composition root wraps the real ClockPort in it, so "Set date" moves today() app-wide. */
  readonly createSimulatedClock: (real: ClockPort) => SimulatedClock;
  /** The composition root wraps the real ConnectivityPort in it, so "Simulate offline" reaches every subscriber. */
  readonly createSimulatedConnectivity: (real: ConnectivityPort) => SimulatedConnectivity;
  /** The test-only key-value store the debug flags and the pending debug screen survive reloads in. */
  readonly createSqliteKvDebugStoreAdapter: () => DebugStore;
  /** The only way the debug switches and the debug link reach the connectivity, Premium and consent services. */
  readonly createDebugServices: (deps: DebugServiceDeps) => DebugServices;
  /** <scheme>://debug/setup?...: started once the navigator is ready (start(Linking)). */
  readonly createDebugLinkHandler: (deps: DebugLinkDeps) => DebugLinkHandler;
  /** Blocks and counts JS fetch, XHR and WebSocket attempts (createDebugParts installs it first). */
  readonly installNetworkGuard: (
    scope: object,
    onAttempt: (attempt: NetworkAttempt) => void,
  ) => NetworkGuard;
  readonly TEST_BUILD_SENTINEL: string;
};
