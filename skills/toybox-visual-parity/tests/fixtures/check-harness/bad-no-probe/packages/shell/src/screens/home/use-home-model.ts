// packages/shell/src/screens/home/use-home-model.ts (fixture: the opener through the Shell helper)
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';

export function useHomeParity(open: () => void): void {
  useParityOpener('save-restored-dialog', open);
}
