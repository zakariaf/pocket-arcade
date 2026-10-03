// packages/shell/src/testing/flush-microtasks.ts — lets queued promise callbacks run (no fake timers needed).
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
