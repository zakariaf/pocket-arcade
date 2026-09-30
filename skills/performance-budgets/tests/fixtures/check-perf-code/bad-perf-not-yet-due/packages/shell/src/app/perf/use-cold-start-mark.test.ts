// packages/shell/src/app/perf/use-cold-start-mark.test.ts
// no-shell-context: the hook takes the perf log as its argument and reads no provider.
import { act, renderHook } from '@testing-library/react-native';

import { markJsEntry } from './cold-start.ts';
import { useColdStartMark } from './use-cold-start-mark.ts';

import type { PerfEntry, PerfLog } from './perf-log.ts';

jest.mock('./process-start.ts', () => ({ readProcessStartEpochMs: () => null }));

function memoryLog(): PerfLog & { readonly appended: PerfEntry[] } {
  const appended: PerfEntry[] = [];
  return {
    appended,
    append: (item) => {
      appended.push(item);
    },
    entries: () => appended,
  };
}

describe('useColdStartMark', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('logs the cold start once, one frame after Home is drawn, and never without a log', async () => {
    markJsEntry(0);
    await renderHook(() => {
      useColdStartMark(null);
    });
    const log = memoryLog();
    await renderHook(() => {
      useColdStartMark(log);
    });
    expect(log.appended).toStrictEqual([]);
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(log.appended).toStrictEqual([
      expect.objectContaining({
        kind: 'cold-start',
        label: 'home',
        data: expect.objectContaining({ nativeMs: null, totalMs: null }),
      }),
    ]);
    await renderHook(() => {
      useColdStartMark(log);
    });
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(log.appended).toHaveLength(1);
  });
});
