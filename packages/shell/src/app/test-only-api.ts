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
import type { DebugLinkDeps, DebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import type { ParityDocInput } from '@e07/shell/app/parity/parity-doc.ts';
import type { ParityPlan, ParityState } from '@e07/shell/app/parity/parity-plans.ts';
import type { ParityPurchaseInput } from '@e07/shell/app/parity/parity-purchase.ts';
import type { ParityParseResult, ParityRequest } from '@e07/shell/app/parity/parity-request.ts';
import type { ParityFrameRootProps } from '@e07/shell/app/parity/parity-root.tsx';
import type { parityGameFixture } from '@e07/shell/app/parity/parity-session.ts';
import type { PerfLog } from '@e07/shell/app/perf/perf-log.ts';
import type { ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { DebugPerfActions, DebugPerfDeps } from '@e07/shell/screens/debug/debug-perf.ts';
import type { DebugServiceDeps, DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { NetworkAttempt, NetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { ConsentDebugTools } from '@e07/shell/services/consent/admob-consent-debug-adapter.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';
import type { InitialState } from '@react-navigation/native';
import type { ComponentType } from 'react';

/** Everything that exists only in test builds (debug menu S15, harness hooks). */
export type TestOnlyApi = {
  readonly DebugScreen: ComponentType;
  /** S15's font test page (every type role in en, de, fa and ckb); the Debug group's FontTest route. */
  readonly FontTestScreen: ComponentType;
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
  /**
   * admob-ads' consent debug tools: createDebugParts gives the debug services resetConsent for the
   * debug link's geo=eea|other (only with ads on: an ADS_MODE=off build never calls Google's UMP).
   */
  readonly createAdmobConsentDebugAdapter: () => ConsentDebugTools;
  /** Blocks and counts JS fetch, XHR and WebSocket attempts (createDebugParts installs it first). */
  readonly installNetworkGuard: (
    scope: object,
    onAttempt: (attempt: NetworkAttempt) => void,
  ) => NetworkGuard;
  readonly TEST_BUILD_SENTINEL: string;
  // Parity harness (toybox-visual-parity): parity-startup.tsx reaches the first nine.
  /** The -parity launch argument of this launch: null for a normal start. */
  readonly readParityRequest: () => ParityParseResult | null;
  readonly startParitySession: (request: ParityRequest) => void;
  readonly createParityErrorRoot: (message: string) => ComponentType;
  readonly parityDoc: <T extends ShellGameTypes>(input: ParityDocInput<T>) => SaveDoc;
  readonly createParityAds: () => AdsPort;
  readonly createParityPurchase: (input: ParityPurchaseInput) => PurchasePort;
  readonly parityInitialState: (plan: ParityPlan) => InitialState | undefined;
  readonly isHeldParityStart: (plan: ParityPlan) => boolean;
  readonly ParityFrameRoot: ComponentType<ParityFrameRootProps>;
  /** Model hooks: the fixture's build number (version text) and the frame state to open once. */
  readonly parityBuildNumber: () => string | null;
  readonly parityFrameState: () => ParityState | null;
  /**
   * animations=off: every decorative loop and entrance holds still at rest (use-reduce-motion.ts
   * returns true while this does; the saved Reduce motion setting is untouched).
   */
  readonly isParityMotionFrozen: () => boolean;
  /** probe=board: the launch that only reports the board rectangle (game.board-layout), no frame state. */
  readonly isParityBoardProbeOn: () => boolean;
  /** The design's numbers for S5-S7 (level 12, score 1,840, stars 3 ...); null on a normal launch. */
  readonly parityGameFixture: typeof parityGameFixture;
  // Perf layer (performance-budgets): createDebugParts makes the cold-start log with it.
  /** The perf log in the save database (table perf_log): Home's cold-start mark, the frame recorder. */
  readonly createPerfLog: (driver: SqlDriver) => PerfLog;
  /**
   * S15's Performance section (record frame times, share the report, run the save benchmark):
   * createDebugParts builds it once over DebugServices' perf log; use-debug-model reads it there.
   */
  readonly createDebugPerfActions: (deps: DebugPerfDeps) => DebugPerfActions;
  /**
   * E2E feedback evidence: createDebugParts wraps the app's AudioPort and HapticsPort, so every
   * sound and pulse asked for appends { kind: 'feedback', label: <sound id or haptic cue> } to the
   * perf log, which e2e:ios reads after the level-1 flow (feedback.json). Each call is passed on
   * to the real port unchanged.
   */
  readonly recordAudioFeedback: (audio: AudioPort, deps: DebugPerfDeps) => AudioPort;
  readonly recordHapticsFeedback: (haptics: HapticsPort, deps: DebugPerfDeps) => HapticsPort;
};
