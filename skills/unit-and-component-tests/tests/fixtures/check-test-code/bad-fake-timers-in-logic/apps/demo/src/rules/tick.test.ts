import { tick } from './tick.ts';

describe('tick', () => {
  it('advances one second', () => {
    jest.useFakeTimers();
    jest.advanceTimersByTime(1000);
    expect(tick(0)).toBe(1);
  });
});
