// packages/tooling/src/asc/find-app.ts
// The App Store Connect app record of one bundle id. Apple's filter[bundleId] is not an exact
// match, so the answer is filtered here by the bundle id it carries: release:ios, print-app-record
// and the Premium product script then act only on the game's own record.
import { ascField, ascRequest } from './asc-client.ts';

export type AppRecord = { readonly id: string; readonly name: string };

type AppEntry = AppRecord & { readonly bundleId: string };

function toAppEntry(item: unknown): AppEntry | null {
  const id = ascField(item, 'id');
  const attributes = ascField(item, 'attributes');
  const name = ascField(attributes, 'name');
  const bundleId = ascField(attributes, 'bundleId');
  return typeof id === 'string' && typeof name === 'string' && typeof bundleId === 'string'
    ? { id, name, bundleId }
    : null;
}

/**
 * Returns null when App Store Connect has no app record for exactly this bundle ID (owner step
 * G2), and stops when it has several. The bundle ID is always io.applander.<game id without
 * hyphens> (owner decision O4). `request` is ascRequest; tests pass a fake.
 */
export async function findAppByBundleId(
  token: string,
  bundleId: string,
  request = ascRequest,
): Promise<AppRecord | null> {
  const path = `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name,bundleId`;
  const response = await request(token, { method: 'GET', path });
  if (!response.ok) {
    const codes = response.errors.map((error) => error.code).join(', ');
    throw new Error(`App Store Connect answered ${String(response.status)} (${codes})`);
  }
  const data = ascField(response.json, 'data');
  const apps = (Array.isArray(data) ? data : [])
    .map(toAppEntry)
    .filter((app): app is AppEntry => app?.bundleId === bundleId);
  if (apps.length > 1) {
    const ids = apps.map((app) => app.id).join(', ');
    throw new Error(
      `App Store Connect has ${String(apps.length)} app records for ${bundleId} (${ids}): ask the owner which one is the game`,
    );
  }
  const [app] = apps;
  return app === undefined ? null : { id: app.id, name: app.name };
}
