// packages/shell/src/screens/debug/debug-overrides.ts
// Fixture stand-in for e2e-maestro's file: storage keys shaped like testIDs are not testIDs (a
// literal type, a get()/set() argument and a *_KEY constant are all skipped by check-screens).
export type DebugStoreKey = 'debug.overrides' | 'debug.pending-screen';

export type DebugStore = {
  readonly get: (key: DebugStoreKey) => string | null;
  readonly set: (key: DebugStoreKey, value: string | null) => void;
};

const PENDING_KEY = 'debug.pending-screen';

export function readOverrides(store: DebugStore): string | null {
  store.set(PENDING_KEY, null);
  return store.get('debug.overrides');
}
