// packages/tooling/src/storekit/busy-note.ts
// StoreKit's test store answers slowly on a busy Mac: at a load average near 600 on 12 cores
// (2026-10-01) its requests took 26 to 173 s and 5 of 7 harness flows timed out with a correct
// app. storekit-harness.ts prints this note before the run and after a failed one.

/** The note for a busy Mac (1-minute load average above twice the cores), else null. */
export function busyNote(load: number, cores: number): string | null {
  const limit = cores * 2;
  if (load <= limit) return null;
  return `storekit: the Mac is busy (load average ${load.toFixed(0)} on ${String(cores)} cores); StoreKit's test store answers slowly, so a flow may time out with a correct app: rerun on a fresh simulator once the load is below ${String(limit)}`;
}
