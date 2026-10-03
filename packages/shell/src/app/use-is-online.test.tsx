// packages/shell/src/app/use-is-online.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useIsOnline } from './use-is-online.ts';

describe('useIsOnline', () => {
  it('follows the connectivity port, starting from its last report', async () => {
    const connectivity = createFakeConnectivity(false);
    const { wrapper } = createShellWrapper({ services: { connectivity } });
    const { result } = await renderHook(() => useIsOnline(), { wrapper });
    expect(result.current).toBe(false);

    await act(() => {
      connectivity.setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});
