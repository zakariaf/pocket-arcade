// packages/shell/src/screens/settings/language/use-settings-language-model.ts (fixture: the hook that opens its frame states once on mount)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

export function openParityState(open: (state: string) => void): void {
  if (TEST_ONLY?.parityFrameState() === 'restart-dialog') open('restart-dialog');
}
