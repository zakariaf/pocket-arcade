// packages/tooling/src/asc/premium-iap-payloads.ts
// Pure request bodies for the Premium in-app purchase (App Store Connect API v1/v2).
export type PricePoint = { readonly id: string; readonly customerPrice: number };

const rel = (type: string, id: string): { data: { type: string; id: string } } => ({
  data: { type, id },
});

export function createIapBody(appId: string, productId: string): unknown {
  return {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: 'Premium', // reference name, max 64 chars, never shown to players
        productId, // letters, digits, '.', '-', '_'; max 100; never reusable in this app
        inAppPurchaseType: 'NON_CONSUMABLE',
        familySharable: false, // default off; Apple: once on, it cannot be turned off
        reviewNote: 'Removes all ads. Restore purchase is on the Premium page and in Settings.',
      },
      relationships: { app: rel('apps', appId) },
    },
  };
}

// App Store Connect offers no Persian or Sorani localization: en-US and de-DE only.
// Display name 2-30 chars, description max 45 chars.
export const PREMIUM_LOCALIZATIONS = [
  { locale: 'en-US', name: 'Premium', description: 'No ads, ever. One-time purchase.' },
  { locale: 'de-DE', name: 'Premium', description: 'Nie wieder Werbung. Einmalkauf.' },
] as const;

export function localizationBody(iapId: string, index: number): unknown {
  const localization = PREMIUM_LOCALIZATIONS[index];
  if (localization === undefined) throw new Error(`no localization ${String(index)}`);
  return {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: localization,
      relationships: { inAppPurchaseV2: rel('inAppPurchases', iapId) },
    },
  };
}

// Spec D3: about EUR 1.90 at the nearest Apple price point. Returns the points closest first;
// the caller uses an exact match, or asks the owner (D3) when there is none.
export function closestPricePoints(points: readonly PricePoint[], target: number): PricePoint[] {
  return [...points].sort(
    (a, b) => Math.abs(a.customerPrice - target) - Math.abs(b.customerPrice - target),
  );
}

export function priceScheduleBody(iapId: string, pricePointId: string, territory: string): unknown {
  return {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: rel('inAppPurchases', iapId),
        baseTerritory: rel('territories', territory), // required by Apple
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price-0}' }] },
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: '${price-0}',
        attributes: { startDate: null },
        relationships: { inAppPurchasePricePoint: rel('inAppPurchasePricePoints', pricePointId) },
      },
    ],
  };
}

// POST /v1/inAppPurchaseAvailabilities: sell wherever the app is sold.
export function availabilityBody(iapId: string, territoryIds: readonly string[]): unknown {
  return {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        inAppPurchase: rel('inAppPurchases', iapId),
        availableTerritories: { data: territoryIds.map((id) => ({ type: 'territories', id })) },
      },
    },
  };
}

// Review screenshot: 1) POST reserve (this body), 2) PUT the bytes to each returned
// uploadOperation, 3) PATCH { uploaded: true, sourceFileChecksum: <md5 hex> }.
export function screenshotReserveBody(iapId: string, fileName: string, fileSize: number): unknown {
  return {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      attributes: { fileName, fileSize },
      relationships: { inAppPurchaseV2: rel('inAppPurchases', iapId) },
    },
  };
}

export function screenshotCommitBody(screenshotId: string, md5Hex: string): unknown {
  return {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      id: screenshotId,
      attributes: { uploaded: true, sourceFileChecksum: md5Hex },
    },
  };
}
