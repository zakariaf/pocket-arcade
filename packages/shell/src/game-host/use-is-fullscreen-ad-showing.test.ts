// packages/shell/src/game-host/use-is-fullscreen-ad-showing.test.ts
// no-shell-context: the hook reads only the full-screen gate it is given.
import { act, renderHook } from '@testing-library/react-native';

import { createFullscreenGate } from './fullscreen-gate.ts';
import { useIsFullscreenAdShowing } from './use-is-fullscreen-ad-showing.ts';

describe('useIsFullscreenAdShowing', () => {
  it('follows the gate while an ad suspends the game and after it resumes', async () => {
    const gate = createFullscreenGate();
    const { result } = await renderHook(() => useIsFullscreenAdShowing(gate));
    expect(result.current).toBe(false);
    await act(() => {
      gate.suspend('fullscreen-ad');
    });
    expect(result.current).toBe(true);
    await act(() => {
      gate.resume('fullscreen-ad');
    });
    expect(result.current).toBe(false);
  });
});
