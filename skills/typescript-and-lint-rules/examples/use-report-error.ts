// packages/shell/src/services/error-log/use-report-error.ts
import { useServices } from '@e07/shell/app/services-context.tsx';

import type { ErrorSource } from './error-log-port.ts';

/** Returns a rejection handler for fire-and-forget work: `task().catch(reportError)`. */
export function useReportError(source: ErrorSource): (error: unknown) => void {
  const { errorLog } = useServices();
  return (error: unknown): void => {
    errorLog.record(source, error);
  };
}
