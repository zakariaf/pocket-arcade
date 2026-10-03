// packages/shell/src/services/error-log/fake-error-log.ts
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type {
  ErrorLogEntry,
  ErrorLogPort,
  ErrorSource,
} from '@e07/shell/services/error-log/error-log-port.ts';

export type RecordedError = {
  readonly atMs: number;
  readonly source: ErrorSource;
  /** The value passed to record(), unchanged, so a test can assert on it. */
  readonly error: unknown;
};

/** In-memory ErrorLogPort for tests; `recorded` keeps every call, oldest first. */
export type FakeErrorLog = ErrorLogPort & { readonly recorded: readonly RecordedError[] };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createFakeErrorLog(
  clock: Pick<ClockPort, 'nowMs'> = { nowMs: () => 0 },
): FakeErrorLog {
  const recorded: RecordedError[] = [];
  return {
    recorded,
    record: (source, error) => {
      recorded.push({ atMs: clock.nowMs(), source, error });
    },
    entries: () =>
      recorded
        .map(({ atMs, source, error }): ErrorLogEntry => ({
          atMs,
          source,
          message: messageOf(error),
        }))
        .reverse(),
  };
}
