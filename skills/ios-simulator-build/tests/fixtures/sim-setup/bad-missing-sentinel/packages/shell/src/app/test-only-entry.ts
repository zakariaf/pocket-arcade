// packages/shell/src/app/test-only-entry.ts
// Loaded ONLY through test-only.ts; a store bundle must not contain this module.
// Every export is reached through `require` in test-only.ts (TEST_ONLY.<name>), which knip cannot
// follow, so each one is tagged @public (knip's includeEntryExports would report it otherwise).
/** @public */
export { createDebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
/** @public */
export { DebugScreen } from '@e07/shell/screens/debug/debug-screen.tsx';
/** @public */
export { createDebugServices } from '@e07/shell/screens/debug/debug-services.ts';
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
export const TEST_BUILD_SENTINEL = 'debug';
