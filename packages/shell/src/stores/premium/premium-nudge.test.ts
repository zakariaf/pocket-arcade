// packages/shell/src/stores/premium/premium-nudge.test.ts
import { premiumNudgePrice } from './premium-nudge.ts';

import type { NudgeInput } from './premium-nudge.ts';

const TODAY = '2026-09-28';
const FIRST_TODAY: NudgeInput = {
  isPremium: false,
  priceText: '€1.99',
  lastShownOn: '2026-09-27',
  today: TODAY,
};

describe('premiumNudgePrice', () => {
  it('offers the line once a day with the store price', () => {
    expect(premiumNudgePrice(FIRST_TODAY)).toBe('€1.99');
    expect(premiumNudgePrice({ ...FIRST_TODAY, lastShownOn: null })).toBe('€1.99');
  });

  it('stays quiet for the rest of the day once shown', () => {
    expect(premiumNudgePrice({ ...FIRST_TODAY, lastShownOn: TODAY })).toBeNull();
  });

  it('skips the line for an owner or without a store price', () => {
    expect(premiumNudgePrice({ ...FIRST_TODAY, isPremium: true })).toBeNull();
    expect(premiumNudgePrice({ ...FIRST_TODAY, priceText: null })).toBeNull();
  });
});
