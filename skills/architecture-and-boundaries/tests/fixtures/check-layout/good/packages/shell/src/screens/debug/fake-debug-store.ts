// packages/shell/src/screens/debug/fake-debug-store.ts
// The test-only debug module keeps its key-value store fake next to its port (debug-overrides.ts).
export type DebugStore = { readonly get: (key: string) => string | null };

export function createFakeDebugStore(): DebugStore {
  return { get: () => null };
}
