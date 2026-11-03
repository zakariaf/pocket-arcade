// packages/shell/src/screens/settings/use-settings-model.ts (fixture: the hook that opens its frame states once on mount)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function openParityState(open: (state: string) => void): void {
  if (TEST_ONLY?.parityFrameState() === 'reset-progress-dialog-held') open('reset-progress-dialog-held');
}
