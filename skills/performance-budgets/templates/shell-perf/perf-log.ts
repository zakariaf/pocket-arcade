// packages/shell/src/app/perf/perf-log.ts
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

export type PerfEntry = {
  /**
   * 'feedback': a sound or haptic cue the app asked for (game-audio-and-haptics' recording
   * decorators, label = the sound id or the cue), the simulator evidence of the win feedback.
   * 'board-clock': the board clock's trace (board-rendering-skia), label push, stop, resume,
   * frame, done or runnable, data { seq, startAt, elapsedMs, endMs, isAppActive, isFocused,
   * isAdShowing }; written only while the debug link's boardLayout=1 is on.
   */
  readonly kind: 'frames' | 'cold-start' | 'save-benchmark' | 'feedback' | 'board-clock';
  readonly label: string;
  readonly atEpochMs: number;
  readonly data: Readonly<Record<string, number | boolean | null | readonly number[]>>;
};
export type PerfLog = {
  append(entry: PerfEntry): void;
  entries(): readonly PerfEntry[];
};

/** The newest 200 evidence entries (frames, cold starts, benchmarks, feedback) are kept... */
const MAX_ENTRIES = 200;
/** ...and, beside them, the newest 400 board-clock trace entries, so a trace never evicts them. */
const MAX_TRACE_ENTRIES = 400;

function trimmed(entries: readonly PerfEntry[]): PerfEntry[] {
  const traces = entries.filter((entry) => entry.kind === 'board-clock');
  const evidence = entries.filter((entry) => entry.kind !== 'board-clock');
  const kept = new Set([...traces.slice(-MAX_TRACE_ENTRIES), ...evidence.slice(-MAX_ENTRIES)]);
  return entries.filter((entry) => kept.has(entry));
}

/** Test builds only. One JSON row in the save database (ring buffer of the newest entries). */
export function createPerfLog(driver: SqlDriver): PerfLog {
  driver.exec(
    'CREATE TABLE IF NOT EXISTS perf_log (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
  );
  const entries = (): readonly PerfEntry[] => {
    const payload = driver.get('SELECT payload FROM perf_log WHERE id = 1', [])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as PerfEntry[]) : [];
  };
  return {
    entries,
    append: (entry) => {
      const next = trimmed([...entries(), entry]);
      driver.run('INSERT OR REPLACE INTO perf_log (id, payload) VALUES (1, ?)', [
        JSON.stringify(next),
      ]);
    },
  };
}
