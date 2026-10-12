// packages/tooling/src/asc/premium-iap-setup.ts
// What create-premium-iap.ts does, on injected App Store Connect calls (tests pass a fake): checks
// the bundle id first (io.applander.<game id without hyphens>, owner decision O4; anything else
// stops with the usage before the key is read), finds the app record by its exact bundle id, then
// creates or reuses <bundle id>.premium (NON_CONSUMABLE, Family Sharing off: O3), adds the missing
// localizations and sets the price schedule at exactly the target price point (EUR 1.99: O2).
import { isAppId } from '@e07/tooling/build/game-id.ts';

import { findAppByBundleId } from './find-app.ts';
import {
  createIapBody,
  localizationBody,
  closestPricePoints,
  PREMIUM_LOCALIZATIONS,
  priceScheduleBody,
} from './premium-iap-payloads.ts';

import type { AscRequest, AscResponse } from './asc-client.ts';
import type { PricePoint } from './premium-iap-payloads.ts';

type Resource = { readonly id: string; readonly attributes?: Record<string, unknown> };
type Call = (request: AscRequest) => Promise<unknown>;

const BASE_TERRITORY = 'DEU';
const EXIT_USAGE = 2;

export const PREMIUM_IAP_USAGE =
  'usage: create-premium-iap.ts io.applander.<game id without hyphens> (needs ASC_KEY_ID and ASC_ISSUER_ID)';

export type PremiumIapDeps = {
  /** The team key's JWT, made only once the bundle id is valid. */
  readonly token: () => string;
  /** ascRequest; tests pass a fake. */
  readonly request: (token: string, request: AscRequest) => Promise<AscResponse>;
  /** The owner's price point in EUR (create-premium-iap.ts: TARGET_EUR). */
  readonly targetEur: number;
  readonly log: (line: string) => void;
};

function dataOf(json: unknown): Resource[] {
  const data: unknown = typeof json === 'object' && json !== null ? Reflect.get(json, 'data') : [];
  return (Array.isArray(data) ? data : [data]) as Resource[];
}

async function findOrCreate(call: Call, appId: string, productId: string): Promise<string> {
  const path = `/v1/apps/${encodeURIComponent(appId)}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(productId)}`;
  const existing = dataOf(await call({ method: 'GET', path }))[0];
  if (existing !== undefined) return existing.id;
  const body = createIapBody(appId, productId);
  const created = dataOf(await call({ method: 'POST', path: '/v2/inAppPurchases', body }))[0];
  if (created === undefined) throw new Error('create returned no data');
  return created.id;
}

async function addMissingLocalizations(call: Call, iapId: string): Promise<void> {
  const path = `/v2/inAppPurchases/${encodeURIComponent(iapId)}/inAppPurchaseLocalizations`;
  const existing = dataOf(await call({ method: 'GET', path })).map((l) => l.attributes?.['locale']);
  for (const [index, localization] of PREMIUM_LOCALIZATIONS.entries()) {
    if (existing.includes(localization.locale)) continue;
    const body = localizationBody(iapId, index);
    await call({ method: 'POST', path: '/v1/inAppPurchaseLocalizations', body });
  }
}

// limit=8000 is the endpoint's maximum: one page holds every DEU price point.
async function pricePoints(call: Call, iapId: string): Promise<PricePoint[]> {
  const path = `/v2/inAppPurchases/${encodeURIComponent(iapId)}/pricePoints?filter[territory]=${BASE_TERRITORY}&limit=8000`;
  return dataOf(await call({ method: 'GET', path })).map((point) => ({
    id: point.id,
    customerPrice: Number(point.attributes?.['customerPrice']),
  }));
}

// Exactly the owner's price point; the script stops only if Apple no longer offers it.
async function choosePricePoint(call: Call, iapId: string, target: number): Promise<PricePoint> {
  const ranked = closestPricePoints(await pricePoints(call, iapId), target);
  const best = ranked[0];
  if (best?.customerPrice === target) return best;
  const options = ranked
    .slice(0, 3)
    .map((p) => String(p.customerPrice))
    .join(', ');
  throw new Error(
    `EUR ${String(target)} is no longer an App Store price point (nearest: ${options}). Stop and ask the owner.`,
  );
}

/** Returns the exit code: 0 when Premium is set up, 2 (with the usage) for a bad command line. */
export async function createPremiumIap(
  argv: readonly string[],
  deps: PremiumIapDeps,
): Promise<number> {
  const [bundleId, ...rest] = argv;
  if (!isAppId(bundleId) || rest.length > 0) {
    deps.log(PREMIUM_IAP_USAGE);
    return EXIT_USAGE;
  }
  const token = deps.token();
  const call: Call = async (request) => {
    const response = await deps.request(token, request);
    if (!response.ok) throw new Error(`${request.path}: ${JSON.stringify(response.errors)}`);
    return response.json;
  };
  const app = await findAppByBundleId(token, bundleId, deps.request);
  if (app === null) throw new Error(`no app record for ${bundleId}: human step G2`);
  const iapId = await findOrCreate(call, app.id, `${bundleId}.premium`);
  await addMissingLocalizations(call, iapId);
  const point = await choosePricePoint(call, iapId, deps.targetEur);
  const body = priceScheduleBody(iapId, point.id, BASE_TERRITORY);
  await call({ method: 'POST', path: '/v1/inAppPurchasePriceSchedules', body });
  deps.log(`Premium ${iapId}: EUR ${String(point.customerPrice)}; next: availability, screenshot`);
  return 0;
}
