// packages/shell/src/services/ads/perk-offer.test.ts
import { perkOffer } from './perk-offer.ts';

import type { AdContext, AdPolicyConfig } from './ad-policy.ts';
import type { Perk } from './perk-offer.ts';

const CONFIG: AdPolicyConfig = {
  isAdsEnabled: true,
  minLevelsCompletedBeforeFirst: 3,
  minMsBetweenInterstitials: 180_000,
  minLevelsCompletedBetween: 2,
};
const READY: AdContext = {
  isPremium: false,
  isOnline: true,
  canRequestAds: true,
  isTutorialDone: true,
  levelsCompletedTotal: 10,
};
const HINT_EMPTY: Perk = { kind: 'hint', freeHintsLeft: 0 };
const CONTINUE_OK: Perk = { kind: 'continue', isAllowedByGame: true, isUsedThisLevel: false };

describe('perkOffer', () => {
  it('offers a rewarded ad only when one is loaded and ads may be served', () => {
    expect(perkOffer(HINT_EMPTY, { config: CONFIG, context: READY, isRewardedLoaded: true })).toBe(
      'watch-ad',
    );
    expect(perkOffer(HINT_EMPTY, { config: CONFIG, context: READY, isRewardedLoaded: false })).toBe(
      'hidden',
    );
    const offline = { ...READY, isOnline: false };
    expect(
      perkOffer(CONTINUE_OK, { config: CONFIG, context: offline, isRewardedLoaded: true }),
    ).toBe('hidden');
  });

  it('makes perks free for Premium and uses the daily free hint first', () => {
    const premium = { ...READY, isPremium: true, isOnline: false };
    expect(
      perkOffer(CONTINUE_OK, { config: CONFIG, context: premium, isRewardedLoaded: false }),
    ).toBe('free');
    const freeHint: Perk = { kind: 'hint', freeHintsLeft: 1 };
    expect(perkOffer(freeHint, { config: CONFIG, context: READY, isRewardedLoaded: false })).toBe(
      'free',
    );
  });

  it('hides a continue the game forbids or that was already used', () => {
    const used: Perk = { ...CONTINUE_OK, isUsedThisLevel: true };
    const premium = { ...READY, isPremium: true };
    expect(perkOffer(used, { config: CONFIG, context: premium, isRewardedLoaded: true })).toBe(
      'hidden',
    );
  });
});
