// packages/shell/src/app/test-only-api.ts
// device-only: covered by check-sim-setup entry-api-match and the E2E debug-link flows
// The shape of TEST_ONLY: every member exists only in test builds. A member joins once the file
// behind it exists (the S15 screen, e2e-maestro's debug kit, the parity harness, the perf log and
// its debug actions and feedback recorders):
// until then leave that member and its export in test-only-entry.ts out, never the sentinel. At
// Shell steps 4 to 6 the pair holds only TEST_BUILD_SENTINEL (the Shell core's members join at step
// 7); DebugScreen and FontTestScreen stay
// out while S15 is outside shell-slice.json. Every member here has an export of the same name in the entry
// (check-sim-setup's entry-api-match rule): a member without one is undefined at run time.
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { NetworkAttempt, NetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

/** Everything that exists only in test builds (debug menu S15, harness hooks). */
export type TestOnlyApi = {
  /** The composition root wraps the real ClockPort in it, so "Set date" moves today() app-wide. */
  readonly createSimulatedClock: (real: ClockPort) => SimulatedClock;
  /** The composition root wraps the real ConnectivityPort in it, so "Simulate offline" reaches every subscriber. */
  readonly createSimulatedConnectivity: (real: ConnectivityPort) => SimulatedConnectivity;
  /** Blocks and counts JS fetch, XHR and WebSocket attempts (createDebugParts installs it first). */
  readonly installNetworkGuard: (
    scope: object,
    onAttempt: (attempt: NetworkAttempt) => void,
  ) => NetworkGuard;
  readonly TEST_BUILD_SENTINEL: string;
  // Perf layer (performance-budgets): createDebugParts makes the cold-start log with it.
  /** The perf log in the save database (table perf_log): Home's cold-start mark, the frame recorder. */
  readonly createPerfLog: (driver: SqlDriver) => PerfLog;
};
