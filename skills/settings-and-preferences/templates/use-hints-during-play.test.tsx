// packages/shell/src/game-host/use-hints-during-play.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useHintsDuringPlay } from './use-hints-during-play.ts';

describe('useHintsDuringPlay', () => {
  it('follows the saved setting and its changes', async () => {
    const { wrapper, stores } = createShellWrapper({ settings: { hintsDuringPlay: false } });
    const { result } = await renderHook(() => useHintsDuringPlay(), { wrapper });
    expect(result.current).toBe(false);

    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-hints-during-play', enabled: true });
    });

    expect(result.current).toBe(true);
  });
});
