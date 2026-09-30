// packages/shell/src/services/connectivity/expo-network-connectivity-adapter.ts
// NWPathMonitor under the hood: no HTTP probe (unlike @react-native-community/netinfo, banned).
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

import type { ConnectivityPort } from './connectivity-port.ts';
import type { NetworkState } from 'expo-network';

const isUsable = (state: NetworkState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export function createExpoNetworkConnectivityAdapter(): ConnectivityPort {
  let isOnline = false;
  const listeners = new Set<(isOnline: boolean) => void>();
  const report = (isNowOnline: boolean): void => {
    isOnline = isNowOnline;
    listeners.forEach((listener) => {
      listener(isNowOnline);
    });
  };
  const update = (state: NetworkState): void => {
    report(isUsable(state));
  };
  getNetworkStateAsync()
    .then(update)
    .catch(() => {
      report(false); // unknown network state counts as offline (no ad, no store; spec 4.1)
    });
  addNetworkStateListener(update);
  return {
    isOnline: () => isOnline,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
