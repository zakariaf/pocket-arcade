// packages/shell/src/app/perf/debug-perf-actions.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';

import { createDebugPerfActions } from './debug-perf-actions.ts';
import { createFrameHistogram, recordFrame } from './frame-histogram.ts';
import { BENCHMARK_DB_FILE, BENCHMARK_WRITES } from './save-benchmark.ts';

import type { PerfDevice, ScratchSaveStore } from './debug-perf-device.ts';
import type { PerfEntry, PerfLog } from './perf-log.ts';
import type { FakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';

// The scratch file's save layer: the in-memory store, and whether the file was closed.
type Scratch = ScratchSaveStore & { readonly store: FakeSaveStore; closed: boolean };
// The device side (expo-sqlite, the share sheet) never runs in Jest: each test passes its own.
jest.mock('./debug-perf-device.ts', () => ({ DEVICE_PERF: {} }));

function scratchStore(): Scratch {
  const scratch: Scratch = {
    store: createFakeSaveStore(),
    closed: false,
    close: () => {
      scratch.closed = true;
    },
  };
  return scratch;
}

const HEADER = {
  appId: 'io.applander.linesiege',
  appVersion: '1.0.0',
  buildNumber: '1',
  deviceModel: 'ios 26.5',
};

function setup() {
  const entries: PerfEntry[] = [];
  const perfLog: PerfLog = { append: (entry) => entries.push(entry), entries: () => entries };
  const scratch = scratchStore();
  const opened: string[] = [];
  let tick = 0;
  const device: PerfDevice = {
    openScratchStore: (fileName) => {
      opened.push(fileName);
      return scratch;
    },
    now: () => (tick += 0.5),
    header: () => HEADER,
    share: jest.fn(() => Promise.resolve()),
  };
  const actions = createDebugPerfActions({ perfLog, nowMs: () => 1_790_000_000_000, device });
  return { actions, entries, scratch, opened, device };
}

describe('createDebugPerfActions (S15 Performance, test builds)', () => {
  it('records frame times while switched on and logs one frames entry when switched off', () => {
    const { actions, entries } = setup();
    expect(actions.isRecording()).toBe(false);
    actions.setRecording(true);
    expect(actions.isRecording()).toBe(true);
    actions.frames.histogram.set(recordFrame(recordFrame(createFrameHistogram(), 8.3), 8.4));
    actions.setRecording(false);
    expect(actions.isRecording()).toBe(false);
    expect(entries).toStrictEqual([
      expect.objectContaining({ kind: 'frames', label: 'debug-menu', data: expect.anything() }),
    ]);
    expect(entries[0]?.data['frames']).toBe(2);
  });

  it('logs nothing when no frame ran between on and off', () => {
    const { actions, entries } = setup();
    actions.setRecording(true);
    actions.setRecording(false);
    expect(entries).toStrictEqual([]);
  });

  it('writes the largest realistic save into the scratch file only and logs the numbers', () => {
    const { actions, entries, scratch, opened } = setup();
    const result = actions.runSaveBenchmark();
    expect(opened).toStrictEqual([BENCHMARK_DB_FILE]);
    expect(result).toStrictEqual({ p50: 0.5, p95: 0.5, max: 0.5, writes: BENCHMARK_WRITES });
    expect(scratch.store.slots.get('current')?.payload.length).toBeGreaterThan(10_000);
    expect(scratch.closed).toBe(true);
    expect(entries).toStrictEqual([
      {
        kind: 'save-benchmark',
        label: 'save-write',
        atEpochMs: 1_790_000_000_000,
        data: { p50: 0.5, p95: 0.5, max: 0.5, writes: BENCHMARK_WRITES },
      },
    ]);
    expect(BENCHMARK_WRITES).toBe(300);
  });

  it('shares the report with the header and counts the log entries per kind', async () => {
    const { actions, entries, device } = setup();
    entries.push(
      { kind: 'cold-start', label: 'launch', atEpochMs: 1, data: { totalMs: 900 } },
      { kind: 'feedback', label: 'ui.win', atEpochMs: 2, data: { delayMs: 0 } },
    );
    await actions.share();
    expect(device.share).toHaveBeenCalledWith(expect.anything(), HEADER);
    expect(actions.summary()).toStrictEqual({
      'board-clock': 0,
      frames: 0,
      'cold-start': 1,
      'save-benchmark': 0,
      feedback: 1,
    });
  });
});
