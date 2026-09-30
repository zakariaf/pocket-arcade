// packages/shell/src/screens/how-to-play/use-how-to-play-model.ts (fixture: the hook that opens its frame states once on mount)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function openParityState(open: (state: string) => void): void {
  if (TEST_ONLY?.parityFrameState() === 'how-to-play-step-2') open('how-to-play-step-2');
}
