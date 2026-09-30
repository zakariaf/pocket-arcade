// packages/shell/src/app/perf/use-frame-recorder.test.ts
// no-shell-context: the recorder hook keeps its own refs and reads no store, port or theme.
import { act, renderHook } from '@testing-library/react-native';

import { useFrameRecorder } from './use-frame-recorder.ts';

describe('useFrameRecorder', () => {
  it('records only between start and stop', async () => {
    const { result } = await renderHook(() => useFrameRecorder());

    await act(() => {
      result.current.start();
    });

    expect(result.current.stop()?.frames).toBe(0);
  });
});
