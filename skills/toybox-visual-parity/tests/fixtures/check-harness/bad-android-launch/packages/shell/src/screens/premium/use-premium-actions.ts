// packages/shell/src/screens/premium/use-premium-actions.ts (fixture: a set of states read once)
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

const BUY_FRAME_STATES = new Set(['premium-purchasing', 'premium-pending-approval', 'premium-success', 'premium-error']);

export function premiumParityState(): { readonly isBuy: boolean; readonly isToastStack: boolean } {
  const frameState = TEST_ONLY?.parityFrameState() ?? null;
  return { isBuy: frameState !== null && BUY_FRAME_STATES.has(frameState), isToastStack: frameState === 'premium-restore-toasts' };
}
