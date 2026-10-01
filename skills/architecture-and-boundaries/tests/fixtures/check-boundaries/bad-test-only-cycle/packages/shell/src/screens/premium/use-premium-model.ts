// packages/shell/src/screens/premium/use-premium-model.ts
import { useParityOpener } from '@demo/shell/app/use-parity-opener.ts';

/** S12's model: a normal screen reaches parity through the gate. */
export function usePremiumModel(open: () => void): void {
  useParityOpener('premium-restored-toast', open);
}
