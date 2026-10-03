// packages/shell/src/services/connectivity/expo-network-connectivity-adapter.test.ts
// Drives the adapter against a factory mock of expo-network (NWPathMonitor has no Jest build).
// Lint bans importing the SDK outside the adapter, so the test reads the mock with requireMock.
import { createExpoNetworkConnectivityAdapter } from './expo-network-connectivity-adapter.ts';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

type NetworkState = { readonly isConnected?: boolean; readonly isInternetReachable?: boolean };
type MockedNetwork = {
  readonly getNetworkStateAsync: jest.Mock<Promise<NetworkState>>;
  readonly addNetworkStateListener: jest.Mock<void, [(state: NetworkState) => void]>;
};

const network = jest.requireMock<MockedNetwork>('expo-network');
const ONLINE = { isConnected: true, isInternetReachable: true };

function lastListener(): (state: NetworkState) => void {
  const listener = network.addNetworkStateListener.mock.calls.at(-1)?.[0];
  if (listener === undefined) throw new Error('the adapter did not subscribe to expo-network');
  return listener;
}

describe('createExpoNetworkConnectivityAdapter', () => {
  it('is offline until the first report, then follows the network', async () => {
    network.getNetworkStateAsync.mockResolvedValueOnce(ONLINE);
    const connectivity = createExpoNetworkConnectivityAdapter();
    const seen: boolean[] = [];
    connectivity.subscribe((isOnline) => seen.push(isOnline));

    expect(connectivity.isOnline()).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(connectivity.isOnline()).toBe(true);

    lastListener()({ isConnected: true, isInternetReachable: false });
    expect([connectivity.isOnline(), seen]).toStrictEqual([false, [true, false]]);
  });

  it('counts an unknown network state as offline', async () => {
    network.getNetworkStateAsync.mockRejectedValueOnce(new Error('no permission'));
    const connectivity = createExpoNetworkConnectivityAdapter();
    const seen: boolean[] = [];
    connectivity.subscribe((isOnline) => seen.push(isOnline));
    await Promise.resolve();
    await Promise.resolve();

    expect([connectivity.isOnline(), seen]).toStrictEqual([false, [false]]);
  });

  // spec 4.1 and S12: offline means no ad and "store unavailable". The first read can answer after
  // a newer change reached the listener; that older answer must not overwrite the newer one.
  it('keeps a listener event that arrived before the first read answered', async () => {
    const firstRead: ((state: NetworkState) => void)[] = [];
    network.getNetworkStateAsync.mockReturnValueOnce(
      new Promise<NetworkState>((resolve) => firstRead.push(resolve)),
    );
    const connectivity = createExpoNetworkConnectivityAdapter();
    const seen: boolean[] = [];
    connectivity.subscribe((isOnline) => seen.push(isOnline));
    lastListener()(ONLINE);
    for (const answer of firstRead) answer({ isConnected: false });
    await Promise.resolve();
    await Promise.resolve();

    expect([connectivity.isOnline(), seen]).toStrictEqual([true, [true]]);
  });

  it('keeps a listener event when the first read fails after it', async () => {
    const firstRead: ((error: Error) => void)[] = [];
    network.getNetworkStateAsync.mockReturnValueOnce(
      new Promise<NetworkState>((_resolve, reject) => firstRead.push(reject)),
    );
    const connectivity = createExpoNetworkConnectivityAdapter();
    lastListener()(ONLINE);
    for (const fail of firstRead) fail(new Error('no permission'));
    await Promise.resolve();
    await Promise.resolve();

    expect(connectivity.isOnline()).toBe(true);
  });

  it('stops calling a listener after it unsubscribes', () => {
    network.getNetworkStateAsync.mockResolvedValueOnce(ONLINE);
    const connectivity = createExpoNetworkConnectivityAdapter();
    const seen: boolean[] = [];
    const unsubscribe = connectivity.subscribe((isOnline) => seen.push(isOnline));
    unsubscribe();
    lastListener()(ONLINE);

    expect(seen).toStrictEqual([]);
  });
});
