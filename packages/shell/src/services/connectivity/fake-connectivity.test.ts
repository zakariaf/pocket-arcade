// packages/shell/src/services/connectivity/fake-connectivity.test.ts
import { createFakeConnectivity } from './fake-connectivity.ts';

describe('createFakeConnectivity', () => {
  it('reports the value it was created with (spec 9: offline, ads are "not shown, no message")', () => {
    expect([
      createFakeConnectivity(true).isOnline(),
      createFakeConnectivity(false).isOnline(),
    ]).toStrictEqual([true, false]);
  });

  it('changes isOnline and tells every subscriber when a test calls setOnline', () => {
    const connectivity = createFakeConnectivity(true);
    const first: boolean[] = [];
    const second: boolean[] = [];
    connectivity.subscribe((isOnline) => first.push(isOnline));
    connectivity.subscribe((isOnline) => second.push(isOnline));
    connectivity.setOnline(false);
    connectivity.setOnline(true);

    expect([connectivity.isOnline(), first, second]).toStrictEqual([
      true,
      [false, true],
      [false, true],
    ]);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const connectivity = createFakeConnectivity(false);
    const seen: boolean[] = [];
    const unsubscribe = connectivity.subscribe((isOnline) => seen.push(isOnline));
    connectivity.setOnline(true);
    unsubscribe();
    connectivity.setOnline(false);

    expect(seen).toStrictEqual([true]);
  });
});
