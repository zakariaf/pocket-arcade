// packages/shell/src/services/connectivity/fake-connectivity.ts
// Jest only: a ConnectivityPort whose answer the test sets. (The test-only "Simulate offline" switch
// wraps the real adapter instead: SimulatedConnectivity from packages/shell/src/screens/debug/.)
import type { ConnectivityPort } from './connectivity-port.ts';

export type FakeConnectivity = ConnectivityPort & {
  readonly setOnline: (isOnline: boolean) => void;
};

export function createFakeConnectivity(isInitiallyOnline: boolean): FakeConnectivity {
  let isOnline = isInitiallyOnline;
  const listeners = new Set<(isOnline: boolean) => void>();
  return {
    isOnline: () => isOnline,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOnline: (isNowOnline) => {
      isOnline = isNowOnline;
      listeners.forEach((listener) => {
        listener(isNowOnline);
      });
    },
  };
}
