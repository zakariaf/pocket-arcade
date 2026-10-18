// packages/shell/src/app/use-is-app-active.test.ts
// no-shell-context: the hook reads only React Native's AppState, which the test drives.
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useIsAppActive } from './use-is-app-active.ts';

import type { AppStateStatus } from 'react-native';

type Listener = (state: AppStateStatus) => void;

/** Captures the one AppState listener the hook adds, and counts removals. */
function fakeAppState(current: AppStateStatus): { emit: Listener; readonly removed: number[] } {
  let listener: Listener = () => undefined;
  const removed: number[] = [];
  Object.defineProperty(AppState, 'currentState', { value: current, configurable: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type: string, next: Listener) => {
    listener = next;
    return { remove: () => removed.push(1) };
  });
  return {
    emit: (state) => {
      listener(state);
    },
    removed,
  };
}

describe('useIsAppActive', () => {
  it('is true in the foreground and follows background and inactive changes', async () => {
    const app = fakeAppState('active');
    const { result } = await renderHook(() => useIsAppActive());
    expect(result.current).toBe(true);

    await act(() => {
      app.emit('background');
    });
    expect(result.current).toBe(false);

    await act(() => {
      app.emit('active');
    });
    expect(result.current).toBe(true);
  });

  it('starts false when the app launches in the background, and unsubscribes on unmount', async () => {
    const app = fakeAppState('background');
    const { result, unmount } = await renderHook(() => useIsAppActive());
    expect(result.current).toBe(false);
    await unmount();
    expect(app.removed).toStrictEqual([1]);
  });
});
