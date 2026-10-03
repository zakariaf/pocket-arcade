// packages/shell/src/app/test-only-entry.ts
// device-only: covered by check-sim-setup entry-api-match and the E2E debug-link flows
// Loaded ONLY through test-only.ts; a store bundle must not contain this module.
// Every export is reached through `require` in test-only.ts (TEST_ONLY.<name>), which knip cannot
// follow, so each one is tagged @public (knip's includeEntryExports would report it otherwise).
// A member joins once the file behind it exists: until then leave the export and its TestOnlyApi
// member out, never the sentinel. At Shell steps 4 to 6 the entry holds only TEST_BUILD_SENTINEL
// (the Shell core's members join at step 7); DebugScreen and FontTestScreen stay out while S15 is
// outside shell-slice.json. Every export has a TestOnlyApi member of the same name, and every member
// an export (check-sim-setup: entry-api-match).
/** @public */
export { createPerfLog } from '@e07/shell/app/perf/perf-log.ts';
/** @public */
export { createSimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
/** @public */
export { createSimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';

/**
 * The store-artifact gate (check-sim-app / the release gate) greps bundles for this string.
 * @public
 */
export const TEST_BUILD_SENTINEL = 'SHELL_TEST_BUILD_ONLY';
