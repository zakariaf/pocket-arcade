// packages/shell/src/services/async/with-timeout.test.ts
// allow-fake-timers: withTimeout is itself a timer; fake timers drive exactly the unit under test.
import { withTimeout } from './with-timeout.ts';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects when the work takes longer than the limit', async () => {
    const pending = withTimeout(new Promise<never>(() => undefined), 5_000);
    jest.advanceTimersByTime(5_000);

    await expect(pending).rejects.toThrow('timed out after 5000 ms');
  });
});
