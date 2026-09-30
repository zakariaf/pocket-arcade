// packages/shell/src/screens/premium/premium-state-ids.ts (fixture): the S12 container test IDs.
export const PREMIUM_STATE_IDS = {
  'loading-price': 'premium.state.loading',
  'store-unavailable': 'premium.state.unavailable',
  'purchase-in-progress': 'premium.state.purchasing',
  pending: 'premium.state.pending',
  success: 'premium.state.success',
  error: 'premium.state.error',
  'already-owned': 'premium.state.owned',
} as const;

export const PREMIUM_CONTROL_IDS = {
  buy: 'premium.buy-button',
  restore: 'premium.restore-button',
  tryAgain: 'premium.try-again-button',
} as const;

export const PREMIUM_TOAST_IDS = {
  restoring: 'premium.restoring-toast',
  'restore-success': 'premium.restore-success-toast',
  'restore-empty': 'premium.restore-empty-toast',
  'restore-failed': 'premium.restore-failed-toast',
} as const;
