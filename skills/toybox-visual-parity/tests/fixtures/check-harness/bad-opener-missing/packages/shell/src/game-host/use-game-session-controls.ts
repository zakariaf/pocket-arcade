// packages/shell/src/game-host/use-game-session-controls.ts (fixture: the hook that opens its frame states once on mount)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function openParityState(open: (state: string) => void): void {
  if (TEST_ONLY?.parityFrameState() === 'result-win') open('result-win');
  if (TEST_ONLY?.parityFrameState() === 'result-lose') open('result-lose');
}
