// packages/shell/src/app/perf/cold-start.ts (fixture excerpt: the pure JS entry mark)
let jsEntryEpochMs: number | null = null;

export function markJsEntry(nowEpochMs: number = Date.now()): void {
  jsEntryEpochMs ??= nowEpochMs;
}

export function jsEntryOf(): number | null {
  return jsEntryEpochMs;
}
