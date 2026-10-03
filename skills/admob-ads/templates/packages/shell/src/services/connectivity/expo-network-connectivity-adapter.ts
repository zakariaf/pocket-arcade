// packages/shell/src/services/connectivity/expo-network-connectivity-adapter.ts
// NWPathMonitor under the hood: no HTTP probe (unlike @react-native-community/netinfo, banned).
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

import type { ConnectivityPort } from './connectivity-port.ts';
import type { NetworkState } from 'expo-network';

const isUsable = (state: NetworkState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export function createExpoNetworkConnectivityAdapter(): ConnectivityPort {
  let isOnline = false;
  // The first read can answer after a listener event; that event is newer, so the read is dropped.
  let hasHeardChange = false;
  const listeners = new Set<(isOnline: boolean) => void>();
  const report = (isNowOnline: boolean): void => {
    isOnline = isNowOnline;
    listeners.forEach((listener) => {
      listener(isNowOnline);
    });
  };
  getNetworkStateAsync()
    .then((state) => {
      if (!hasHeardChange) report(isUsable(state));
    })
    .catch(() => {
      // Unknown network state counts as offline (no ad, no store; spec 4.1).
      if (!hasHeardChange) report(false);
    });
  addNetworkStateListener((state) => {
    hasHeardChange = true;
    report(isUsable(state));
  });
  return {
    isOnline: () => isOnline,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
