// packages/shell/src/screens/debug/use-debug-model.ts (fixture: S15's opener turns the always-test-ads switch on through its own handler)
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';

export function useDebugParity(onToggle: (id: 'ads-always-test') => void): void {
  useParityOpener('debug-ads-always-test', () => {
    onToggle('ads-always-test');
  });
}
