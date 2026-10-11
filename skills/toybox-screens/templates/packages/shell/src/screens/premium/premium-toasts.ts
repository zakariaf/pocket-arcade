// packages/shell/src/screens/premium/premium-toasts.ts
// Pure: the one restore-outcome toast S12 shows for a model, shared by the view (PremiumToast
// draws it) and the model hook (announces it, then clears "Purchase restored").
import { PREMIUM_VIEWS } from './premium-views.ts';

import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
import type { PremiumNotice } from '@e07/shell/stores/premium/premium-notice.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';

export type PremiumToastSpec = {
  readonly testID: string;
  readonly textKey: ShellMessageKey;
  /** 'busy' draws the hopping blocks (restoring). */
  readonly icon: IconName | 'busy';
};

/** The model fields the toasts depend on. */
export type PremiumToastInput = {
  readonly view: PremiumView;
  readonly hasJustRestored: boolean;
  readonly isRestoreToastStack: boolean;
};

/** The toast of each restore outcome. */
const TOASTS: Readonly<Record<PremiumNotice, PremiumToastSpec>> = {
  restoring: { testID: 'premium.restoring-toast', textKey: 'premium.restoring', icon: 'busy' },
  'restore-success': {
    testID: 'premium.restore-success-toast',
    textKey: 'premium.restore-success',
    icon: 'check',
  },
  'restore-empty': {
    testID: 'premium.restore-empty-toast',
    textKey: 'premium.restore-empty',
    icon: 'info',
  },
  'restore-failed': {
    testID: 'premium.restore-failed-toast',
    textKey: 'premium.restore-failed',
    icon: 'alert',
  },
};

/** The design's restore card: the four outcomes at once, in its order (parity frame only). */
export const RESTORE_TOAST_STACK: readonly PremiumToastSpec[] = [
  TOASTS.restoring,
  TOASTS['restore-success'],
  TOASTS['restore-empty'],
  TOASTS['restore-failed'],
];

/** "Purchase restored" wins while it is fresh; otherwise the restore flow's own outcome, if any. */
export function premiumToastFor(
  view: PremiumView,
  hasJustRestored: boolean,
): PremiumToastSpec | null {
  if (hasJustRestored) return TOASTS['restore-success'];
  const notice = PREMIUM_VIEWS[view].toast;
  return notice === null ? null : TOASTS[notice];
}

/** Every toast the page draws: the stack on the restore card, otherwise at most one. */
export function premiumToastsFor(model: PremiumToastInput): readonly PremiumToastSpec[] {
  if (model.isRestoreToastStack) return RESTORE_TOAST_STACK;
  const spec = premiumToastFor(model.view, model.hasJustRestored);
  return spec === null ? [] : [spec];
}
