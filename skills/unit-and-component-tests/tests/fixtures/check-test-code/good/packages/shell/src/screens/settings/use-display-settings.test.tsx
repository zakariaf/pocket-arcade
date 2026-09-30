import { act, renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useDisplaySettings } from './use-display-settings.ts';

describe('useDisplaySettings', () => {
  it('follows a theme change dispatched on the store', async () => {
    const { wrapper, stores } = createShellWrapper();
    const { result } = await renderHook(() => useDisplaySettings(), { wrapper });

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-theme', theme: 'light' });
    });

    expect(result.current.theme).toBe('light');
  });
});
