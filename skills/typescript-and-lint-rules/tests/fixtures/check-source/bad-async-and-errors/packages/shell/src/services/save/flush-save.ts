// packages/shell/src/services/save/flush-save.ts
/** Flushes the save. */
export function flushSave(write: () => Promise<void>): void {
  void write();
  try {
    JSON.parse("{");
  } catch {}
  console.log('flushed');
  throw 'save failed';
}
