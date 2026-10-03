// packages/shell/src/app/create-premium-deps.ts
// premium-purchase's service dependencies, built once by the composition root and shared by
// startPremium, connectPremiumReloads, the debug services and S12 (PremiumScreenDepsProvider).
// The store port arrives already gated by connectivity (withConnectivity where it is created).
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { formatStorePrice } from '@e07/shell/services/purchase/format-store-price.ts';
import { selectDigits, selectLanguage } from '@e07/shell/stores/settings-selectors.ts';

import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { DeviceLocale } from '@e07/shell/i18n/resolve-language.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type {
  PremiumChange,
  PremiumServiceDeps,
} from '@e07/shell/services/purchase/premium-service.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type PremiumInput = {
  readonly save: SaveService;
  readonly stores: ShellStores;
  readonly clock: ClockPort;
  readonly errorLog: ErrorLogPort;
  /** The store port, gated by connectivity: withConnectivity(createExpoIapPurchaseAdapter(), isOnline). */
  readonly purchase: PurchasePort;
  /** game.config premium.productId, from readGameExtra().premiumProductId. */
  readonly productId: string;
  readonly deviceLocales: readonly DeviceLocale[];
};

/** True when the save already holds the change, so writing it again would change nothing. */
function holdsChange(premium: SaveDoc['premium'], change: PremiumChange): boolean {
  return change.isPremium
    ? premium.owned && premium.ownedSinceMs !== null && premium.revokedAtMs === null
    : !premium.owned && premium.revokedAtMs === change.revokedAtMs;
}

/**
 * The save's premium section after a change (a revoke carries its date for the save guard). False
 * when the change did not reach the disk (save.update's answer: a refused write, a rejected
 * document, a pending quarantine copy, or a newer app's read-only save): the purchase then stays
 * unfinished, so the store delivers it again. The re-check runs at launch, every foreground and
 * reconnect: a change the save already holds is on disk already, so it writes nothing and is true.
 */
export function persistPremiumIn(
  save: SaveService,
  clock: Pick<ClockPort, 'nowMs'>,
): (change: PremiumChange) => boolean {
  return (change) => {
    if (holdsChange(save.doc().premium, change)) return true;
    const atMs = clock.nowMs();
    return save.update(
      (doc) => ({
        ...doc,
        // A purchase clears an old refund date: the save guard reads revokedAtMs, so a date kept
        // from an earlier refund would let a later change without one turn Premium off.
        premium: change.isPremium
          ? {
              ...doc.premium,
              owned: true,
              ownedSinceMs: doc.premium.ownedSinceMs ?? atMs,
              revokedAtMs: null,
            }
          : { ...doc.premium, owned: false, revokedAtMs: change.revokedAtMs },
      }),
      { refreshBackup: true },
    );
  };
}

/** The price in the player's language and digits, read at the moment it is formatted. */
function priceFormatter(input: PremiumInput): PremiumServiceDeps['formatPrice'] {
  return (product) => {
    const settings = input.stores.settings.getState();
    const language = resolveLanguage(selectLanguage(settings), input.deviceLocales);
    return formatStorePrice(product, localeTagFor(language, selectDigits(settings)));
  };
}

/** One PremiumServiceDeps: the gated store port, one save write per change, the price formatter. */
export function createPremiumDeps(input: PremiumInput): PremiumServiceDeps {
  return {
    port: input.purchase,
    productId: input.productId,
    dispatch: input.stores.premium.getState().dispatch,
    persistPremium: persistPremiumIn(input.save, input.clock),
    formatPrice: priceFormatter(input),
    onError: (error) => {
      input.errorLog.record('purchase', error);
    },
  };
}
