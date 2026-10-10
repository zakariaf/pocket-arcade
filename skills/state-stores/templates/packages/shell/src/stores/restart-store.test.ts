// packages/shell/src/stores/restart-store.test.ts
import { createRestartStore, selectIsRestartPending } from './restart-store.ts';

// Spec S2 and S11: a choice that flips the direction restarts the app once. Between the tap and
// the reload the Shell holds that restart (never saved), so the route guards keep the screen the
// player is on instead of mounting the next one in the old direction.
describe('createRestartStore', () => {
  it('starts with no restart pending', () => {
    const store = createRestartStore();
    expect([
      store.getState().pendingDirection,
      selectIsRestartPending(store.getState()),
    ]).toStrictEqual([null, false]);
  });

  it('holds the direction of a started restart until it is cancelled', () => {
    const store = createRestartStore();
    store.getState().begin('rtl');
    expect([
      store.getState().pendingDirection,
      selectIsRestartPending(store.getState()),
    ]).toStrictEqual(['rtl', true]);

    store.getState().cancel();
    expect(store.getState().pendingDirection).toBeNull();
  });

  it('gives every app start its own store', () => {
    const first = createRestartStore();
    first.getState().begin('ltr');
    expect(createRestartStore().getState().pendingDirection).toBeNull();
  });
});
