// packages/shell/src/__AREA__/__HOOK_FILE__.test.tsx
// A hook that reads the Shell (stores, services, theme, i18n) renders inside the same provider tree
// as a component: createShellWrapper builds it and returns the stores, so the test seeds state
// through the save and changes it the way the app does (dispatch), never by mocking a store module.
import { act, renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { __HOOK_NAME__ } from './__HOOK_FILE__.ts';

describe('__HOOK_NAME__', () => {
  it('__SEEDED_TITLE__', async () => {
    const { wrapper } = createShellWrapper({ settings: __SEEDED_SETTINGS__ });

    const { result } = await renderHook(() => __HOOK_NAME__(), { wrapper });

    expect(result.current).toStrictEqual(__SEEDED_RESULT__);
  });

  it('__UPDATE_TITLE__', async () => {
    const { wrapper, stores } = createShellWrapper();
    const { result } = await renderHook(() => __HOOK_NAME__(), { wrapper });

    await act(() => {
      stores.__STORE_NAME__.getState().dispatch(__ACTION__);
    });

    expect(result.current).toStrictEqual(__UPDATED_RESULT__);
  });
});
