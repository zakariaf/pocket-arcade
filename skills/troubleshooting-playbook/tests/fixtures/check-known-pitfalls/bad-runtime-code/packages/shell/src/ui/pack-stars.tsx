// packages/shell/src/ui/pack-stars.tsx
import { useProgressStore } from '../stores/progress/progress-store.ts';

export function usePackStars(pack: string): { stars: readonly number[] } {
  return useProgressStore((state) => ({ stars: state.stars[pack] ?? [] }));
}
