// packages/shell/src/feature/feature.ts
import { coreStore } from '@e07/shell/core/core.ts';

/** Reads the core: the text must fit (a box) is prose, not a test call. */
export function featureValue(): number {
  return coreStore.getState().value + 1;
}
