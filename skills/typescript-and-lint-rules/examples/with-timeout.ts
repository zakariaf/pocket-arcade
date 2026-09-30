// packages/shell/src/services/async/with-timeout.ts
import { err, ok, type Result } from '@e07/game-kit/contract/result.ts';

export type TimeoutError = { readonly kind: 'timed-out'; readonly afterMs: number };

/**
 * Resolves with the task's value, or with a `timed-out` error after `afterMs`.
 * Never rejects for a timeout; a rejection of `task` itself still propagates.
 */
export async function withTimeout<TValue>(
  task: Promise<TValue>,
  afterMs: number,
): Promise<Result<TValue, TimeoutError>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Result<TValue, TimeoutError>>((resolve) => {
    timer = setTimeout(() => {
      resolve(err({ kind: 'timed-out', afterMs }));
    }, afterMs);
  });
  try {
    return await Promise.race([task.then((value) => ok(value)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
