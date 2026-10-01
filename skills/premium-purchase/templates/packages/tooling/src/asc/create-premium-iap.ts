// packages/tooling/src/asc/create-premium-iap.ts
// Usage: node packages/tooling/src/asc/create-premium-iap.ts <bundleId>
// Needs ASC_KEY_ID and ASC_ISSUER_ID (team API key). Re-running is safe: it reuses the product, skips
// locales that exist, and posting a price schedule again replaces the schedule. The price is the
// owner's EUR 1.99 price point (O2); the product is created with Family Sharing off (O3).
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

import { ascRequest } from './asc-client.ts';
import { loadAscCredentials } from './asc-credentials.ts';
import { createAscJwt } from './asc-jwt.ts';
import {
  createIapBody,
  localizationBody,
  closestPricePoints,
  PREMIUM_LOCALIZATIONS,
  priceScheduleBody,
} from './premium-iap-payloads.ts';

import type { AscRequest } from './asc-client.ts';
import type { PricePoint } from './premium-iap-payloads.ts';

type Resource = { readonly id: string; readonly attributes?: Record<string, unknown> };
type Call = (request: AscRequest) => Promise<unknown>;

const BASE_TERRITORY = 'DEU';
const TARGET_EUR = 1.99; // owner decision O2, 2026-09-30: the EUR 1.99 App Store price point

function dataOf(json: unknown): Resource[] {
  const data: unknown = typeof json === 'object' && json !== null ? Reflect.get(json, 'data') : [];
  return (Array.isArray(data) ? data : [data]) as Resource[];
}

async function findOrCreate(call: Call, appId: string, productId: string): Promise<string> {
  const path = `/v1/apps/${appId}/inAppPurchasesV2?filter[productId]=${productId}`;
  const existing = dataOf(await call({ method: 'GET', path }))[0];
  if (existing !== undefined) return existing.id;
  const body = createIapBody(appId, productId);
  const created = dataOf(await call({ method: 'POST', path: '/v2/inAppPurchases', body }))[0];
  if (created === undefined) throw new Error('create returned no data');
  return created.id;
}

async function addMissingLocalizations(call: Call, iapId: string): Promise<void> {
  const path = `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations`;
  const existing = dataOf(await call({ method: 'GET', path })).map((l) => l.attributes?.['locale']);
  for (const [index, localization] of PREMIUM_LOCALIZATIONS.entries()) {
    if (existing.includes(localization.locale)) continue;
    const body = localizationBody(iapId, index);
    await call({ method: 'POST', path: '/v1/inAppPurchaseLocalizations', body });
  }
}

// limit=8000 is the endpoint's maximum: one page holds every DEU price point.
async function pricePoints(call: Call, iapId: string): Promise<PricePoint[]> {
  const path = `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=${BASE_TERRITORY}&limit=8000`;
  return dataOf(await call({ method: 'GET', path })).map((point) => ({
    id: point.id,
    customerPrice: Number(point.attributes?.['customerPrice']),
  }));
}

// Exactly the owner's price point; the script stops only if Apple no longer offers it.
async function choosePricePoint(call: Call, iapId: string): Promise<PricePoint> {
  const ranked = closestPricePoints(await pricePoints(call, iapId), TARGET_EUR);
  const best = ranked[0];
  if (best?.customerPrice === TARGET_EUR) return best;
  const options = ranked
    .slice(0, 3)
    .map((p) => String(p.customerPrice))
    .join(', ');
  throw new Error(
    `EUR ${String(TARGET_EUR)} is no longer an App Store price point (nearest: ${options}). Stop and ask the owner.`,
  );
}

async function main(bundleId: string, nowEpochSeconds: number): Promise<void> {
  const token = createAscJwt(loadAscCredentials(process.env), nowEpochSeconds);
  const call: Call = async (request) => {
    const response = await ascRequest(token, request);
    if (!response.ok) throw new Error(`${request.path}: ${JSON.stringify(response.errors)}`);
    return response.json;
  };
  const app = dataOf(
    await call({ method: 'GET', path: `/v1/apps?filter[bundleId]=${bundleId}` }),
  )[0];
  if (app === undefined) throw new Error(`no app record for ${bundleId}: human step G2`);
  const iapId = await findOrCreate(call, app.id, `${bundleId}.premium`);
  await addMissingLocalizations(call, iapId);
  const point = await choosePricePoint(call, iapId);
  const body = priceScheduleBody(iapId, point.id, BASE_TERRITORY);
  await call({ method: 'POST', path: '/v1/inAppPurchasePriceSchedules', body });
  console.error(
    `Premium ${iapId}: EUR ${String(point.customerPrice)}; next: availability, screenshot`,
  );
}

await main(process.argv[2] ?? '', nowEpochSeconds());
