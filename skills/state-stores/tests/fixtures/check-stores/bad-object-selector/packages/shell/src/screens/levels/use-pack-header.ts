// Two selectors that build a new value on every call, without useShallow.
import { selectPackStars } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import type { PackStars } from '@e07/shell/stores/progress-selectors.ts';

export function usePackHeader(levels: readonly number[]): PackStars {
  return useProgressStore((state) => selectPackStars(state, levels));
}

export function useBests(): { readonly endless: number; readonly hints: number } {
  return useProgressStore((state) => ({
    endless: state.progress.endlessBest,
    hints: state.hints.freeUsed,
  }));
}
