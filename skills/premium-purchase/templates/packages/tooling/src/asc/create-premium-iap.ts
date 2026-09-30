// packages/tooling/src/asc/create-premium-iap.ts
// Usage: node packages/tooling/src/asc/create-premium-iap.ts <bundleId> [--price <EUR>]
// Needs ASC_KEY_ID and ASC_ISSUER_ID (team API key). Re-running is safe: it reuses the product, skips
// locales that exist, and posting a price schedule again replaces the schedule.
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
const TARGET_EUR = 1.9; // spec D3: about EUR 1.90

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

async function choosePricePoint(call: Call, iapId: string, wanted: number): Promise<PricePoint> {
  const ranked = closestPricePoints(await pricePoints(call, iapId), wanted);
  const best = ranked[0];
  if (best?.customerPrice === wanted) return best;
  const options = ranked
    .slice(0, 3)
    .map((p) => String(p.customerPrice))
    .join(', ');
  throw new Error(`EUR ${String(wanted)} is not a price point. Ask the owner (D3): ${options}`);
}

async function main(bundleId: string, priceEur: number, nowEpochSeconds: number): Promise<void> {
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
  const point = await choosePricePoint(call, iapId, priceEur);
  const body = priceScheduleBody(iapId, point.id, BASE_TERRITORY);
  await call({ method: 'POST', path: '/v1/inAppPurchasePriceSchedules', body });
  console.error(
    `Premium ${iapId}: EUR ${String(point.customerPrice)}; next: availability, screenshot`,
  );
}

const priceFlag = process.argv.indexOf('--price');
const priceEur = priceFlag > 0 ? Number(process.argv[priceFlag + 1]) : TARGET_EUR;
await main(process.argv[2] ?? '', priceEur, nowEpochSeconds());
