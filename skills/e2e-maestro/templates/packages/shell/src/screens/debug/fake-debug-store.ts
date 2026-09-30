// packages/shell/src/screens/debug/fake-debug-store.ts
// Jest only: the test-only key-value store in memory. Hand the same fake to a second
// createDebugServices (or createDebugLinkHandler) to play a direction reload or a killed app.
import type { DebugStore, DebugStoreKey } from './debug-overrides.ts';

export type FakeDebugStore = DebugStore & {
  /** What a reload would find, key by key (absent keys are left out). */
  readonly entries: () => Readonly<Partial<Record<DebugStoreKey, string>>>;
};

export function createFakeDebugStore(
  initial: Readonly<Partial<Record<DebugStoreKey, string>>> = {},
): FakeDebugStore {
  const values = new Map<DebugStoreKey, string>(
    Object.entries(initial) as [DebugStoreKey, string][],
  );
  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      if (value === null) values.delete(key);
      else values.set(key, value);
    },
    entries: () => Object.fromEntries(values),
  };
}
