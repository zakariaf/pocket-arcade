// packages/shell/src/game-host/play-clock.test.ts
import { createPlayClock, MAX_PLAY_DELTA_MS } from './play-clock.ts';

function clockAt(times: readonly number[]): () => number {
  let index = 0;
  return () => {
    const now = times[Math.min(index, times.length - 1)] ?? 0;
    index += 1;
    return now;
  };
}

describe('createPlayClock', () => {
  it('counts the time between laps only while the run was playing', () => {
    const clock = createPlayClock(clockAt([1_000, 4_000, 9_000, 10_500]));
    expect(clock.lap(true)).toBe(3_000);
    expect(clock.lap(false)).toBe(0);
    expect(clock.lap(true)).toBe(1_500);
  });

  it('clamps a clock jump forward and ignores a jump back', () => {
    const clock = createPlayClock(clockAt([0, 3_600_000, 3_500_000]));
    expect(clock.lap(true)).toBe(MAX_PLAY_DELTA_MS);
    expect(clock.lap(true)).toBe(0);
  });
});
