// packages/shell/src/screens/premium/premium-hero.ts
// Pure: the one hero key of each S12 state (rule: one hero key per screen).
import type { PremiumModel } from './premium-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ButtonProps } from '@e07/shell/ui/button.tsx';

export type PremiumHero = Pick<
  ButtonProps,
  'testID' | 'label' | 'onPress' | 'cap' | 'isBusy' | 'isDisabled'
>;

/** Buy (crown cap), busy while loading or purchasing, disabled offline, Try again after an error. */
export function premiumHeroFor(model: PremiumModel, t: TFunction): PremiumHero | null {
  const buy = { testID: 'premium.buy-button', onPress: model.onBuy } as const;
  switch (model.view) {
    case 'ready':
    case 'restoring':
    case 'restore-empty':
    case 'restore-failed':
      return {
        ...buy,
        cap: 'crown',
        label:
          model.priceText === null
            ? t('settings.premium.remove-ads-no-price')
            : t('premium.buy-button', { priceText: model.priceText }),
      };
    case 'loading-price':
      return { ...buy, label: t('premium.loading'), isBusy: true };
    case 'purchase-in-progress':
      return { ...buy, label: t('premium.purchasing'), isBusy: true };
    case 'store-unavailable':
      return {
        ...buy,
        cap: 'crown',
        label: t('settings.premium.remove-ads-no-price'),
        isDisabled: true,
      };
    case 'error':
      return {
        testID: 'premium.try-again-button',
        label: t('premium.try-again'),
        onPress: model.onTryAgain,
        cap: 'restore',
      };
    case 'pending':
    case 'success':
    case 'already-owned':
      return null;
  }
}
