// packages/shell/src/screens/levels/use-levels-model.ts (fixture: the hook that opens its frame states once on mount)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function openParityState(open: (state: string) => void): void {
  if (TEST_ONLY?.parityFrameState() === 'levels-locked-tile-tapped') open('levels-locked-tile-tapped');
}
