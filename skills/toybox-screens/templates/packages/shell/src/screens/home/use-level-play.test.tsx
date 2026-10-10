// packages/shell/src/screens/home/use-level-play.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { useLevelPlay } from './use-level-play.ts';

import type { StoreApi } from 'zustand/vanilla';

type Focus = { readonly isFocused: boolean };

// Focus as React Navigation reports it: a store the test flips, read through a real subscription.
jest.mock('@react-navigation/native', () => {
  const { useStore } = require('zustand');
  const { createStore } = require('zustand/vanilla');
  const store = createStore(() => ({ isFocused: true }));
  return {
    mockFocusStore: store,
    useNavigation: () => ({ navigate: () => undefined }),
    useIsFocused: () => useStore(store, (state: Focus) => state.isFocused),
  };
});
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const { mockFocusStore } = jest.requireMock<{ mockFocusStore: StoreApi<Focus> }>(
  '@react-navigation/native',
);

describe('useLevelPlay', () => {
  it('offers Continue for a level run started while the screen was covered (spec S4)', async () => {
    const shell = createHostWrapper({ services: { save: createTestSave().save } });
    const { result } = await renderHook(() => useLevelPlay(), { wrapper: shell.wrapper });
    expect(result.current).toMatchObject({ isContinue: false, level: 1 });

    // The Game screen covers Home and writes a new level run there, outside React.
    await act(() => {
      mockFocusStore.setState({ isFocused: false });
    });
    shell.host.openSession({ start: 'new', ref: { kind: 'level', level: 2 } });
    await act(() => {
      mockFocusStore.setState({ isFocused: true });
    });
    expect(result.current).toMatchObject({ isContinue: true, level: 2 });
  });
});
