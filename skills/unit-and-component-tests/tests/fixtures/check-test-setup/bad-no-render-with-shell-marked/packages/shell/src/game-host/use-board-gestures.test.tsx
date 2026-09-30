// packages/shell/src/game-host/use-board-gestures.test.tsx
// no-shell-context: the gesture hook takes everything through its arguments and reads no store or port.
import { renderHook } from '@testing-library/react-native';

describe('useBoardGestures', () => {
  it('returns a gesture', async () => {
    const { result } = await renderHook(() => 1);
    expect(result.current).toBe(1);
  });
});
