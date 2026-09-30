// packages/shell/src/app/test-only-api.ts
/** Everything that exists only in test builds. */
export type TestOnlyApi = { readonly TEST_BUILD_SENTINEL: string };
