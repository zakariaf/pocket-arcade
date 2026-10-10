// packages/shell/src/screens/premium/premium-toasts.ts
// Pure: the one restore-outcome toast S12 shows for a model, shared by the view (PremiumToast
// draws it) and the model hook (announces it, then clears "Purchase restored").
import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
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

const RESTORED: PremiumToastSpec = {
  testID: 'premium.restore-success-toast',
  textKey: 'premium.restore-success',
  icon: 'check',
};

const RESTORING: PremiumToastSpec = {
  testID: 'premium.restoring-toast',
  textKey: 'premium.restoring',
  icon: 'busy',
};
const EMPTY: PremiumToastSpec = {
  testID: 'premium.restore-empty-toast',
  textKey: 'premium.restore-empty',
  icon: 'info',
};
const FAILED: PremiumToastSpec = {
  testID: 'premium.restore-failed-toast',
  textKey: 'premium.restore-failed',
  icon: 'alert',
};

/** The restore outcome of each store view; the other views show no toast. */
const RESTORE_TOASTS: Readonly<Partial<Record<PremiumView, PremiumToastSpec>>> = {
  restoring: RESTORING,
  'restore-empty': EMPTY,
  'restore-failed': FAILED,
};

/** The design's restore card: the four outcomes at once, in its order (parity frame only). */
export const RESTORE_TOAST_STACK: readonly PremiumToastSpec[] = [
  RESTORING,
  RESTORED,
  EMPTY,
  FAILED,
];

/** "Purchase restored" wins while it is fresh; otherwise the restore flow's own outcome, if any. */
export function premiumToastFor(
  view: PremiumView,
  hasJustRestored: boolean,
): PremiumToastSpec | null {
  if (hasJustRestored) return RESTORED;
  return RESTORE_TOASTS[view] ?? null;
}

/** Every toast the page draws: the stack on the restore card, otherwise at most one. */
export function premiumToastsFor(model: PremiumToastInput): readonly PremiumToastSpec[] {
  if (model.isRestoreToastStack) return RESTORE_TOAST_STACK;
  const spec = premiumToastFor(model.view, model.hasJustRestored);
  return spec === null ? [] : [spec];
}
