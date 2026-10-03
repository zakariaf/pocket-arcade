// packages/shell/src/screens/debug/fake-debug-store.test.ts
import { createFakeDebugStore } from './fake-debug-store.ts';

describe('createFakeDebugStore', () => {
  it('keeps, replaces and removes values like the key-value store', () => {
    const store = createFakeDebugStore({ 'debug.overrides': '{}' });
    expect(store.get('debug.overrides')).toBe('{}');
    expect(store.get('debug.pending-screen')).toBeNull();

    store.set('debug.pending-screen', 'a');
    store.set('debug.overrides', null);

    expect(store.entries()).toStrictEqual({ 'debug.pending-screen': 'a' });
  });
});
