// packages/shell/src/screens/debug/simulated-connectivity.test.ts
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';

import { createSimulatedConnectivity } from './simulated-connectivity.ts';

import type { FakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';

type Setup = {
  readonly network: FakeConnectivity;
  readonly port: ReturnType<typeof createSimulatedConnectivity>;
  readonly heard: boolean[];
};

function setup(isNetworkOnline: boolean): Setup {
  const network = createFakeConnectivity(isNetworkOnline);
  const port = createSimulatedConnectivity(network);
  const heard: boolean[] = [];
  port.subscribe((isOnline) => {
    heard.push(isOnline);
  });
  return { network, port, heard };
}

describe('createSimulatedConnectivity', () => {
  it('follows the real network while the switch is off', () => {
    const { network, port, heard } = setup(true);

    network.setOnline(false);
    network.setOnline(true);

    expect(port.isOnline()).toBe(true);
    expect(heard).toStrictEqual([false, true]);
  });

  it('tells every subscriber when offline=1 flips the app offline, and again when it flips back', () => {
    const { port, heard } = setup(true);

    port.setSimulatedOffline(true);
    expect(port.isOnline()).toBe(false);
    port.setSimulatedOffline(false);

    expect(port.isOnline()).toBe(true);
    expect(heard).toStrictEqual([false, true]);
  });

  it('stays offline while simulating, whatever the network reports', () => {
    const { network, port, heard } = setup(true);
    port.setSimulatedOffline(true);

    network.setOnline(false);
    network.setOnline(true);

    expect(port.isOnline()).toBe(false);
    expect(heard).toStrictEqual([false]);
  });

  it('notifies nobody when a flip does not change the answer', () => {
    const { port, heard } = setup(false);

    port.setSimulatedOffline(true);
    port.setSimulatedOffline(true);

    expect(port.isSimulatingOffline()).toBe(true);
    expect(heard).toStrictEqual([]);
  });

  it('reports the real network once the switch is turned off again', () => {
    const { network, port, heard } = setup(true);
    port.setSimulatedOffline(true);
    network.setOnline(false);

    port.setSimulatedOffline(false);

    expect(port.isOnline()).toBe(false);
    expect(heard).toStrictEqual([false]);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const { port, heard } = setup(true);
    const late: boolean[] = [];
    const unsubscribe = port.subscribe((isOnline) => {
      late.push(isOnline);
    });

    unsubscribe();
    port.setSimulatedOffline(true);

    expect(late).toStrictEqual([]);
    expect(heard).toStrictEqual([false]);
  });
});
