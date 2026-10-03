// packages/shell/src/app/perf/use-frame-recorder.test.ts
// no-shell-context: the recorder hook takes no arguments, keeps its own shared values and reads no store or port.
import { act, renderHook } from '@testing-library/react-native';

import { sampleFrame, useFrameRecorder } from './use-frame-recorder.ts';

describe('useFrameRecorder', () => {
  it('records only between start and stop', async () => {
    const { result } = await renderHook(() => useFrameRecorder());
    const recorder = result.current;

    sampleFrame(recorder.histogram, recorder.isRecording, 8.3);
    await act(() => {
      recorder.start();
    });
    for (const dt of [null, 8.3, 8.4, 33])
      sampleFrame(recorder.histogram, recorder.isRecording, dt);
    const report = recorder.stop();

    expect(report?.frames).toBe(3);
    expect(report?.maxMs).toBe(33);
  });
});
