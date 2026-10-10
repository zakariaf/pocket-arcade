// packages/shell/src/screens/settings/use-display-settings.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useDisplaySettings } from './use-display-settings.ts';

async function setup() {
  const { wrapper, stores } = createShellWrapper({
    settings: { theme: 'dark', colorBlind: true, reduceMotion: 'on' },
  });
  const { result } = await renderHook(() => useDisplaySettings(), { wrapper });
  return { result, stores };
}

describe('useDisplaySettings', () => {
  it('returns the saved theme, colour-blind and reduce-motion values (spec S11, 8.11)', async () => {
    const { result } = await setup();
    expect(result.current).toStrictEqual({
      theme: 'dark',
      isColorBlind: true,
      reduceMotion: 'on',
    });
  });

  it('returns the new theme after a set-theme dispatch', async () => {
    const { result, stores } = await setup();
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-theme', theme: 'system' });
    });
    expect(result.current.theme).toBe('system');
  });

  it('keeps the same object when an unrelated setting changes', async () => {
    const { result, stores } = await setup();
    const before = result.current;
    await act(() => {
      stores.settings.getState().dispatch({ type: 'set-sound', enabled: true, volume: 40 });
    });
    expect(result.current).toBe(before);
  });
});
