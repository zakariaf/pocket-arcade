// packages/shell/src/services/async/with-timeout.test.ts
import { withTimeout } from './with-timeout.ts';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the value when the task settles first', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);

    expect(result).toStrictEqual({ ok: true, value: 42 });
  });

  it('returns timed-out when the task hangs', async () => {
    const pending = withTimeout(new Promise<number>(() => undefined), 500);
    jest.advanceTimersByTime(500);

    await expect(pending).resolves.toStrictEqual({
      ok: false,
      error: { kind: 'timed-out', afterMs: 500 },
    });
  });

  it('passes a rejection of the task through', async () => {
    const failing = Promise.reject(new Error('store unavailable'));

    await expect(withTimeout(failing, 1000)).rejects.toThrow('store unavailable');
  });
});
