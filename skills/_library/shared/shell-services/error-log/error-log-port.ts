// packages/shell/src/services/error-log/error-log-port.ts
export type ErrorSource =
  | 'render'
  | 'frame-callback'
  | 'save'
  | 'ads'
  | 'purchase'
  | 'audio'
  | 'haptics'
  | 'unhandled-rejection'
  | 'global-handler'
  | 'boot'
  | 'i18n'
  | 'network';

export type ErrorLogEntry = {
  readonly atMs: number;
  readonly source: ErrorSource;
  readonly message: string;
};

/**
 * Spec 8.14: the local error log (never leaves the device). `record` never throws and never
 * rejects. Adapter: sqlite-error-log-adapter.ts (newest 200 rows). Fake: fake-error-log.ts.
 */
export type ErrorLogPort = {
  readonly record: (source: ErrorSource, error: unknown) => void;
  /** Newest first. */
  readonly entries: () => readonly ErrorLogEntry[];
};
