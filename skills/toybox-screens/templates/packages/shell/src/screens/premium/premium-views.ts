// packages/shell/src/screens/premium/premium-views.ts
// Pure: what S12 draws in each of its views, in one table: the state marker E2E flows wait for
// (the normal page has none), the hero key, the Restore key, the small print and the restore
// toast. The page, the hero, the Restore key and the toasts all read it.
import type { PremiumNotice } from '@e07/shell/stores/premium/premium-notice.ts';
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';

/** The normal page: the offer, with the restore flow's outcome as a toast over it. */
export type PremiumOfferView = 'ready' | 'restoring' | 'restore-empty' | 'restore-failed';

/** Every other view draws its own state body under its state marker. */
export type PremiumStateView = Exclude<PremiumView, PremiumOfferView>;

/**
 * buy: the price key (crown cap), disabled without the store's price; buy-locked: the same key
 * locked while a restore runs; loading and purchasing: busy; unavailable: disabled.
 */
export type PremiumHeroKind =
  'buy' | 'buy-locked' | 'loading' | 'purchasing' | 'unavailable' | 'try-again';

/** quiet: the centred link; locked: that link disabled; block: the owner's key; null: none. */
export type PremiumRestoreKind = 'quiet' | 'locked' | 'block';

export type PremiumViewSpec<TView extends PremiumView = PremiumView> = {
  readonly marker: TView extends PremiumOfferView ? null : string;
  /** One hero key per screen, or none (pending, success, owned). */
  readonly hero: PremiumHeroKind | null;
  readonly restore: PremiumRestoreKind | null;
  readonly hasSmallPrint: boolean;
  /** The restore flow's own toast; a fresh "Purchase restored" wins over it (premium-toasts.ts). */
  readonly toast: Exclude<PremiumNotice, 'restore-success'> | null;
};

export const PREMIUM_VIEWS: { readonly [TView in PremiumView]: PremiumViewSpec<TView> } = {
  ready: { marker: null, hero: 'buy', restore: 'quiet', hasSmallPrint: true, toast: null },
  restoring: {
    marker: null,
    hero: 'buy-locked',
    restore: 'locked',
    hasSmallPrint: true,
    toast: 'restoring',
  },
  'restore-empty': {
    marker: null,
    hero: 'buy',
    restore: 'quiet',
    hasSmallPrint: true,
    toast: 'restore-empty',
  },
  'restore-failed': {
    marker: null,
    hero: 'buy',
    restore: 'quiet',
    hasSmallPrint: true,
    toast: 'restore-failed',
  },
  'loading-price': {
    marker: 'premium.state.loading',
    hero: 'loading',
    restore: 'quiet',
    hasSmallPrint: true,
    toast: null,
  },
  'store-unavailable': {
    marker: 'premium.state.unavailable',
    hero: 'unavailable',
    restore: 'locked',
    hasSmallPrint: false,
    toast: null,
  },
  'purchase-in-progress': {
    marker: 'premium.state.purchasing',
    hero: 'purchasing',
    restore: 'locked',
    hasSmallPrint: true,
    toast: null,
  },
  pending: {
    marker: 'premium.state.pending',
    hero: null,
    restore: 'quiet',
    hasSmallPrint: false,
    toast: null,
  },
  success: {
    marker: 'premium.state.success',
    hero: null,
    restore: null,
    hasSmallPrint: false,
    toast: null,
  },
  error: {
    marker: 'premium.state.error',
    hero: 'try-again',
    restore: 'quiet',
    hasSmallPrint: false,
    toast: null,
  },
  'already-owned': {
    marker: 'premium.state.owned',
    hero: null,
    restore: 'block',
    hasSmallPrint: false,
    toast: null,
  },
};

/** The normal page (no state marker): the offer is drawn, not a state body. */
export function isOfferView(view: PremiumView): view is PremiumOfferView {
  return PREMIUM_VIEWS[view].marker === null;
}
