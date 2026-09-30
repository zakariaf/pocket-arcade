// packages/shell/src/game-host/board-scene.test.ts
import { tickClock } from './board-scene.ts';

const frame = (i: number) => ({ timestamp: 1000 + i * 16, timeSincePreviousFrame: 16, timeSinceFirstFrame: i * 16 });

it('measures from startAt, not from timeSinceFirstFrame', () => {
  const restarted = [frame(0), frame(1)];
  expect(restarted[0]?.timeSinceFirstFrame).toBe(0);
  expect(tickClock(1000, restarted[1] ?? frame(0))).toBe(16);
});
