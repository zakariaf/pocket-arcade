// packages/shell/src/stores/premium/premium-notice.ts
import type { PremiumFlow, PremiumState } from './premium-state.ts';

// The restore outcomes the S12 design shows as toasts over the normal page (or the owned page).
export type PremiumNotice = 'restoring' | 'restore-success' | 'restore-empty' | 'restore-failed';

const FLOW_NOTICE: Partial<Readonly<Record<PremiumFlow['kind'], PremiumNotice>>> = {
  restoring: 'restoring',
  'restore-empty': 'restore-empty',
  'restore-failed': 'restore-failed',
};

// The screen shows the toast; for 'restore-success' it dispatches 'restore-notice-shown' once
// the toast has been announced, so it never shows twice.
export function premiumNotice(state: PremiumState): PremiumNotice | null {
  const notice = FLOW_NOTICE[state.flow.kind];
  if (notice !== undefined) return notice;
  return state.didJustRestore ? 'restore-success' : null;
}
