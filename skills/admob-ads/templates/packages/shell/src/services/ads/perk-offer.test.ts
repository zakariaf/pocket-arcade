// packages/shell/src/services/ads/perk-offer.test.ts
import { perkOffer } from './perk-offer.ts';

import type { AdContext, AdPolicyConfig } from './ad-policy.ts';
import type { RewardedStatus } from './ads-port.ts';
import type { Perk, PerkOffer } from './perk-offer.ts';

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

function offerOf(perk: Perk, context: AdContext, rewardedStatus: RewardedStatus): PerkOffer {
  return perkOffer(perk, { config: CONFIG, context, rewardedStatus });
}

describe('perkOffer', () => {
  // L11: 'hidden' always means the perk cannot be had, never "still loading".
  type Row = {
    readonly name: string;
    readonly context: AdContext;
    readonly status: RewardedStatus;
    readonly expected: PerkOffer;
  };
  const offline = { ...READY, isOnline: false };
  const noConsent = { ...READY, canRequestAds: false };
  it.each<Row>([
    {
      name: 'Premium',
      context: { ...READY, isPremium: true },
      status: 'unavailable',
      expected: 'free',
    },
    { name: 'a ready ad', context: READY, status: 'ready', expected: 'watch-ad' },
    { name: 'a loading ad', context: READY, status: 'loading', expected: 'loading' },
    { name: 'an ad that cannot come', context: READY, status: 'unavailable', expected: 'hidden' },
    { name: 'offline with an ad ready', context: offline, status: 'ready', expected: 'hidden' },
    { name: 'offline while loading', context: offline, status: 'loading', expected: 'hidden' },
    {
      name: 'no consent with an ad ready',
      context: noConsent,
      status: 'ready',
      expected: 'hidden',
    },
    { name: 'no consent while loading', context: noConsent, status: 'loading', expected: 'hidden' },
  ])('offers the continue as $expected for $name', ({ context, status, expected }) => {
    expect(offerOf(CONTINUE_OK, context, status)).toBe(expected);
  });

  it('hides a hint while its ad loads (hints have no loading state)', () => {
    expect(offerOf(HINT_EMPTY, READY, 'loading')).toBe('hidden');
    expect(offerOf(HINT_EMPTY, READY, 'ready')).toBe('watch-ad');
    expect(offerOf(HINT_EMPTY, READY, 'unavailable')).toBe('hidden');
  });

  it('makes perks free for Premium and uses the daily free hint first', () => {
    const premium = { ...READY, isPremium: true, isOnline: false };
    expect(offerOf(CONTINUE_OK, premium, 'unavailable')).toBe('free');
    const freeHint: Perk = { kind: 'hint', freeHintsLeft: 1 };
    expect(offerOf(freeHint, READY, 'loading')).toBe('free');
  });

  it('hides a continue the game forbids or that was already used, even for Premium', () => {
    const used: Perk = { ...CONTINUE_OK, isUsedThisLevel: true };
    const forbidden: Perk = { ...CONTINUE_OK, isAllowedByGame: false };
    const premium = { ...READY, isPremium: true };
    expect(offerOf(used, premium, 'ready')).toBe('hidden');
    expect(offerOf(forbidden, READY, 'loading')).toBe('hidden');
  });
});
