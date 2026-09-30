// packages/tooling/src/asc/premium-iap-payloads.test.ts
import {
  availabilityBody,
  closestPricePoints,
  screenshotCommitBody,
  screenshotReserveBody,
} from './premium-iap-payloads.ts';

// App Store Connect's resource type names (camelCase, as its API spells them).
const AVAILABILITY = 'inAppPurchaseAvailabilities';
const IAP = 'inAppPurchases';
const SCREENSHOT = 'inAppPurchaseAppStoreReviewScreenshots';
const TERRITORY = 'territories';

describe('closestPricePoints', () => {
  it('ranks the points by distance to the EUR 1.90 target', () => {
    const points = [
      { id: 'a', customerPrice: 1.49 },
      { id: 'b', customerPrice: 1.99 },
      { id: 'c', customerPrice: 2.49 },
    ];
    expect(closestPricePoints(points, 1.9).map((p) => p.id)).toStrictEqual(['b', 'a', 'c']);
  });
});

describe('the availability and review screenshot bodies (the two steps not yet in create-premium-iap.ts)', () => {
  it('sells the purchase wherever the app is sold, new territories included', () => {
    expect(availabilityBody('iap-1', ['DEU', 'USA'])).toStrictEqual({
      data: {
        type: AVAILABILITY,
        attributes: { availableInNewTerritories: true },
        relationships: {
          inAppPurchase: { data: { type: IAP, id: 'iap-1' } },
          availableTerritories: {
            data: [
              { type: TERRITORY, id: 'DEU' },
              { type: TERRITORY, id: 'USA' },
            ],
          },
        },
      },
    });
  });

  it('reserves the review screenshot upload, then commits it with its checksum', () => {
    expect(screenshotReserveBody('iap-1', 'review.png', 2048)).toStrictEqual({
      data: {
        type: SCREENSHOT,
        attributes: { fileName: 'review.png', fileSize: 2048 },
        relationships: { inAppPurchaseV2: { data: { type: IAP, id: 'iap-1' } } },
      },
    });
    expect(screenshotCommitBody('shot-1', 'abc123')).toStrictEqual({
      data: {
        type: SCREENSHOT,
        id: 'shot-1',
        attributes: { uploaded: true, sourceFileChecksum: 'abc123' },
      },
    });
  });
});
