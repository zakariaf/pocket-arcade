// packages/shell/src/services/connectivity/expo-network-connectivity-adapter.ts (fixture)
import { getNetworkStateAsync } from 'expo-network';

export async function isOnlineNow(): Promise<boolean> {
  const state = await getNetworkStateAsync();
  return state.isConnected === true;
}
