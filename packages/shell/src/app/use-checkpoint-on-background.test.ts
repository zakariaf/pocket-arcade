// packages/shell/src/app/use-checkpoint-on-background.test.ts
// no-shell-context: the hook takes the save service as its argument.
import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useCheckpointOnBackground } from './use-checkpoint-on-background.ts';

import type { AppStateStatus } from 'react-native';

/** The AppState 'change' listeners the hook registered (React Native's Jest AppState is inert). */
function watchAppState(): {
  readonly emit: (next: AppStateStatus) => void;
  readonly removed: jest.Mock;
} {
  const removed = jest.fn();
  const listeners: ((next: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: removed };
  });
  return {
    emit: (next) => {
      listeners.forEach((listener) => {
        listener(next);
      });
    },
    removed,
  };
}

describe('useCheckpointOnBackground', () => {
  it('folds the WAL into save.db when the app goes to the background, not before', async () => {
    const appState = watchAppState();
    const { save } = createTestSave();
    const checkpoint = jest.spyOn(save, 'checkpoint');
    await renderHook(() => {
      useCheckpointOnBackground(save);
    });
    await act(() => {
      appState.emit('inactive');
    });
    expect(checkpoint).not.toHaveBeenCalled();
    await act(() => {
      appState.emit('background');
    });
    expect(checkpoint).toHaveBeenCalledTimes(1);
  });

  it('stops listening when the app root unmounts', async () => {
    const appState = watchAppState();
    const { unmount } = await renderHook(() => {
      useCheckpointOnBackground(createTestSave().save);
    });
    await unmount();
    expect(appState.removed).toHaveBeenCalledTimes(1);
  });
});
