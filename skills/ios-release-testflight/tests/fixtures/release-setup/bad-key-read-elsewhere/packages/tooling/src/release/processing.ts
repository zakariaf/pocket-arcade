// packages/tooling/src/release/processing.ts
// Reading Apple's answers after an upload: the delivery ID in altool's JSON (its field name is
// recorded on the first real upload, so it is searched for), the processing state from the REST
// builds endpoint, release-tag comparison, and the REST query for one build.

export type ProcessingState = 'PROCESSING' | 'VALID' | 'INVALID' | 'FAILED';
const STATES: readonly ProcessingState[] = ['PROCESSING', 'VALID', 'INVALID', 'FAILED'];

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

/** Depth-first search for the first string under a key like deliveryUuid / delivery-id / DeliveryID. */
export function findDeliveryId(json: unknown): string | null {
  if (Array.isArray(json)) {
    return json.map(findDeliveryId).find((found) => found !== null) ?? null;
  }
  if (typeof json !== 'object' || json === null) {
    return null;
  }
  for (const [key, value] of Object.entries(json)) {
    if (/^delivery[-_ ]?(uuid|id)$/i.test(key) && typeof value === 'string' && value !== '') {
      return value;
    }
    const nested = findDeliveryId(value);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

/** GET /v1/builds?filter[app]=...: attributes.processingState of the first build, if any. */
export function processingStateOf(json: unknown): ProcessingState | null {
  const data = field(json, 'data');
  const first: unknown = Array.isArray(data) ? data[0] : undefined;
  const state = field(field(first, 'attributes'), 'processingState');
  return STATES.find((candidate) => candidate === state) ?? null;
}

export function buildsPath(appleAppId: string, buildNumber: number, version: string): string {
  const query = [
    `filter[app]=${encodeURIComponent(appleAppId)}`,
    `filter[version]=${String(buildNumber)}`,
    `filter[preReleaseVersion.version]=${encodeURIComponent(version)}`,
  ];
  return `/v1/builds?${query.join('&')}`;
}

function semverParts(version: string): readonly number[] {
  return version.split('.').map(Number);
}

function compareVersions(a: string, b: string): number {
  const [x, y] = [semverParts(a), semverParts(b)];
  for (let index = 0; index < 3; index += 1) {
    const diff = (x[index] ?? 0) - (y[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** Release tags are <slug>/vX.Y.Z; build tags (<slug>/vX.Y.Z+N) do not count. */
export function lastReleaseVersion(tags: readonly string[], slug: string): string | null {
  const releases = tags
    .filter((tag) => tag.startsWith(`${slug}/v`) && !tag.includes('+'))
    .map((tag) => tag.slice(`${slug}/v`.length))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort(compareVersions);
  return releases.at(-1) ?? null;
}

/** A store submission needs a version above the last release (Apple rejects it: ITMS-90062). */
export function isVersionAboveLastRelease(
  version: string,
  tags: readonly string[],
  slug: string,
): boolean {
  const last = lastReleaseVersion(tags, slug);
  return last === null || compareVersions(version, last) > 0;
}
