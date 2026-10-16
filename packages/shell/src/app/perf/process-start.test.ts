// packages/shell/src/app/perf/process-start.test.ts
import { processStartFrom, readProcessStartEpochMs } from './process-start.ts';

// The one module both platforms register as ProcessStart: Swift on iOS, Kotlin on Android.
function nativeModule(epochMs: number) {
  return { getProcessStartEpochMs: () => epochMs };
}

describe('process start', () => {
  it('returns the epoch ms the native module reads, on Android as on iOS', () => {
    expect(processStartFrom(nativeModule(1_760_000_000_123))).toBe(1_760_000_000_123);
  });

  it('returns null when the native read failed (-1)', () => {
    expect(processStartFrom(nativeModule(-1))).toBeNull();
  });

  it('returns null without the native module, as in Jest', () => {
    expect(processStartFrom(null)).toBeNull();
    expect(readProcessStartEpochMs()).toBeNull();
  });
});
