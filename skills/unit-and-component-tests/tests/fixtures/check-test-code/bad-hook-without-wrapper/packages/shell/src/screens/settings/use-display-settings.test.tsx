import { renderHook } from '@testing-library/react-native';

import { useDisplaySettings } from './use-display-settings.ts';

describe('useDisplaySettings', () => {
  it('returns the default theme', async () => {
    const { result } = await renderHook(() => useDisplaySettings());
    expect(result.current.theme).toBe('system');
  });
});
