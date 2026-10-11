// packages/shell/src/screens/debug/simulated-connectivity.ts
// Test builds only, created through the test-only entry. Wraps the real ConnectivityPort so the S15
// switch "Simulate offline" and the debug link offline=0|1 can take the whole app offline. Every flip
// that changes the answer is pushed to the subscribers exactly like a real outage: the ad policy,
// the connectivity-gated store and the S12 reload all listen through subscribe(), so a flip that
// only changed isOnline() would leave them showing the old state.
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';

export type SimulatedConnectivity = ConnectivityPort & {
  readonly isSimulatingOffline: () => boolean;
  /** offline=1 / the switch on: answer offline whatever the network does; offline=0: follow it. */
  readonly setSimulatedOffline: (isOffline: boolean) => void;
};

export function createSimulatedConnectivity(real: ConnectivityPort): SimulatedConnectivity {
  let isSimulatingOffline = false;
  const listeners = new Set<(isOnline: boolean) => void>();
  const answer = (): boolean => !isSimulatingOffline && real.isOnline();
  let wasOnline = answer();
  const publishIfChanged = (): void => {
    const isOnline = answer();
    if (isOnline === wasOnline) return;
    wasOnline = isOnline;
    listeners.forEach((listener) => {
      listener(isOnline);
    });
  };
  // One subscription for the app's lifetime: this port is created once, in the composition root.
  real.subscribe(publishIfChanged);
  return {
    isOnline: answer,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isSimulatingOffline: () => isSimulatingOffline,
    setSimulatedOffline: (isOffline) => {
      isSimulatingOffline = isOffline;
      publishIfChanged();
    },
  };
}
