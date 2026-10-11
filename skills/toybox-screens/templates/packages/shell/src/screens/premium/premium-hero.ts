// packages/shell/src/screens/premium/premium-hero.ts
// Pure: the one hero key of each S12 state (rule: one hero key per screen), as PREMIUM_VIEWS names it.
import { PREMIUM_VIEWS } from './premium-views.ts';

import type { PremiumModel } from './premium-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ButtonProps } from '@e07/shell/ui/button.tsx';

export type PremiumHero = Pick<
  ButtonProps,
  'testID' | 'label' | 'onPress' | 'cap' | 'isBusy' | 'isDisabled'
>;

/** The one Buy key every buying state draws (its look changes, its id and handler never do). */
function buyKeyOf(model: PremiumModel): Pick<PremiumHero, 'testID' | 'onPress'> {
  return { testID: 'premium.buy-button', onPress: model.onBuy };
}

/** The price key: "Buy – price", or "Remove ads" disabled while the store has given no price. */
function priceKey(model: PremiumModel, t: TFunction, isLocked: boolean): PremiumHero {
  const { priceText } = model;
  return {
    ...buyKeyOf(model),
    cap: 'crown',
    label:
      priceText === null
        ? t('settings.premium.remove-ads-no-price')
        : t('premium.buy-button', { priceText }),
    isDisabled: isLocked || priceText === null,
  };
}

/**
 * Buy (crown cap), locked while a restore runs and without a price (spec S12: a tap would start a
 * purchase the flow refuses), busy while loading or purchasing, disabled offline, Try again after
 * an error.
 */
export function premiumHeroFor(model: PremiumModel, t: TFunction): PremiumHero | null {
  const buy = buyKeyOf(model);
  switch (PREMIUM_VIEWS[model.view].hero) {
    case 'buy':
      return priceKey(model, t, false);
    case 'buy-locked':
      return priceKey(model, t, true);
    case 'loading':
      return { ...buy, label: t('premium.loading'), isBusy: true };
    case 'purchasing':
      return { ...buy, label: t('premium.purchasing'), isBusy: true };
    case 'unavailable':
      return {
        ...buy,
        cap: 'crown',
        label: t('settings.premium.remove-ads-no-price'),
        isDisabled: true,
      };
    case 'try-again':
      return {
        testID: 'premium.try-again-button',
        label: t('premium.try-again'),
        onPress: model.onTryAgain,
        cap: 'restore',
      };
    case null:
      return null;
  }
}
