// packages/shell/src/app/test-only-entry.ts
// Loaded ONLY through test-only.ts; a store bundle must not contain this module.
// Every export is reached through `require` in test-only.ts (TEST_ONLY.<name>), which knip cannot
// follow, so each one is tagged @public (knip's includeEntryExports would report it otherwise).
// A member joins once the file behind it exists: until then leave the export and its TestOnlyApi
// member out, never the sentinel. At Shell steps 4 to 7 the entry holds only TEST_BUILD_SENTINEL;
// DebugScreen and FontTestScreen stay out while S15 is outside shell-slice.json. Every export has a TestOnlyApi
// member of the same name, and every member an export (check-sim-setup: entry-api-match).
/** @public */
export { createDebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
/** @public */
export { createParityAds } from '@e07/shell/app/parity/parity-ads.tsx';
/** @public */
export { parityDoc } from '@e07/shell/app/parity/parity-doc.ts';
/** @public */
export { createParityErrorRoot } from '@e07/shell/app/parity/parity-error-view.tsx';
/** @public */
export { createParityPurchase } from '@e07/shell/app/parity/parity-purchase.ts';
/** @public */
export { ParityFrameRoot } from '@e07/shell/app/parity/parity-root.tsx';
export {
  /** @public */
  isParityBoardProbeOn,
  /** @public */
  isParityMotionFrozen,
  /** @public */
  parityBuildNumber,
  /** @public */
  parityFrameState,
  /** @public */
  parityGameFixture,
  /** @public */
  startParitySession,
} from '@e07/shell/app/parity/parity-session.ts';
export {
  /** @public */
  isHeldParityStart,
  /** @public */
  parityInitialState,
} from '@e07/shell/app/parity/parity-start.ts';
/** @public */
export { readParityRequest } from '@e07/shell/app/parity/read-parity-request.ts';
/** @public */
export { createDebugPerfActions } from '@e07/shell/app/perf/debug-perf-actions.ts';
/** @public */
export { createPerfLog } from '@e07/shell/app/perf/perf-log.ts';
export {
  /** @public */
  recordAudioFeedback,
  /** @public */
  recordHapticsFeedback,
} from '@e07/shell/services/audio/recording-feedback.ts';
/** @public */
export { DebugScreen } from '@e07/shell/screens/debug/debug-screen.tsx';
/** @public */
export { createDebugServices } from '@e07/shell/screens/debug/debug-services.ts';
/** @public */
export { FontTestScreen } from '@e07/shell/screens/debug/font-test-screen.tsx';
/** @public */
export { installNetworkGuard } from '@e07/shell/screens/debug/network-guard.ts';
/** @public */
export { createSimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
/** @public */
export { createSimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
/** @public */
export { createSqliteKvDebugStoreAdapter } from '@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts';

/**
 * The store-artifact gate (check-sim-app / the release gate) greps bundles for this string.
 * @public
 */
export const TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY';
