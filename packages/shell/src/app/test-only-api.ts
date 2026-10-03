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
/** Everything that exists only in test builds (debug menu S15, harness hooks). */
export type TestOnlyApi = {
  readonly TEST_BUILD_SENTINEL: string;
};
