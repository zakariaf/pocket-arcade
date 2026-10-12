// packages/tooling/src/asc/find-app.ts
import { ascField, ascRequest } from './asc-client.ts';

export type AppRecord = { readonly id: string; readonly name: string };

function toAppRecord(item: unknown): AppRecord | null {
  const id = ascField(item, 'id');
  const name = ascField(ascField(item, 'attributes'), 'name');
  return typeof id === 'string' && typeof name === 'string' ? { id, name } : null;
}

// Returns null when App Store Connect has no app record for the bundle ID (owner step G2). The
// bundle ID is always io.applander.<game id without hyphens> (owner decision O4).
export async function findAppByBundleId(
  token: string,
  bundleId: string,
): Promise<AppRecord | null> {
  const path = `/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&fields[apps]=name`;
  const response = await ascRequest(token, { method: 'GET', path });
  if (!response.ok) {
    const codes = response.errors.map((error) => error.code).join(', ');
    throw new Error(`App Store Connect answered ${String(response.status)} (${codes})`);
  }
  const data = ascField(response.json, 'data');
  return Array.isArray(data) ? toAppRecord(data[0]) : null;
}
