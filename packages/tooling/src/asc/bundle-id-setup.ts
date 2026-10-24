// packages/tooling/src/asc/bundle-id-setup.ts
// What create-bundle-ids.ts does, on injected App Store Connect calls (tests pass a fake): checks
// every game id first (anything else stops with the usage before the key is read), then for each
// game registers io.applander.<game id without hyphens> (owner decision O4) as an explicit iOS
// bundle id named after the game, or keeps the one already registered. Apple's
// filter[identifier] is not an exact match, so the answer is filtered here by the identifier it
// carries. The app record itself (owner step G2) is the owner's: the API cannot create one.
import { isGameId } from '@e07/tooling/build/game-id.ts';
import { appIdOf } from '@e07/tooling/release/store-gate.ts';

import { ascField } from './asc-client.ts';

import type { AscRequest, AscResponse } from './asc-client.ts';

const EXIT_USAGE = 2;
/** Where App Store Connect's links.next points; a next page anywhere else is refused. */
export const ASC_ORIGIN = 'https://api.appstoreconnect.apple.com';
const BUNDLE_IDS = 'bundleIds';

export const BUNDLE_ID_USAGE =
  'usage: create-bundle-ids.ts --app <game-id> [--app <game-id> ...] (needs ASC_KEY_ID and ASC_ISSUER_ID)';

export type BundleIdDeps = {
  /** The team key's JWT, made only once every game id is valid. */
  readonly token: () => string;
  /** ascRequest; tests pass a fake. */
  readonly request: (token: string, request: AscRequest) => Promise<AscResponse>;
  readonly log: (line: string) => void;
};

/** flock-tilt -> "Flock Tilt": the bundle id's name in the developer portal. */
export function bundleIdNameOf(gameId: string): string {
  return gameId
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

/** The game ids after each --app, or the first bad argument: a flag that is not --app, or the id. */
function gamesOf(argv: readonly string[]): { games: string[] } | { bad: string } {
  const games: string[] = [];
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index] ?? '';
    const value = argv[index + 1];
    if (flag !== '--app') return { bad: flag };
    if (value === undefined) return { bad: 'nothing after --app' };
    if (!isGameId(value)) return { bad: value };
    games.push(value);
  }
  return games.length === 0 ? { bad: 'no --app' } : { games };
}

function okJson(response: AscResponse, bundleId: string): unknown {
  if (!response.ok) {
    const errors = response.errors.map((error) => `${error.code}: ${error.detail}`).join(', ');
    throw new Error(
      `App Store Connect answered ${String(response.status)} (${errors}) for ${bundleId}`,
    );
  }
  return response.json;
}

/** The path of an answer's links.next (an absolute App Store Connect URL), or null on the last page. */
function nextPathOf(json: unknown): string | null {
  const next = ascField(ascField(json, 'links'), 'next');
  if (typeof next !== 'string') return null;
  const url = new URL(next);
  if (url.origin !== ASC_ORIGIN) throw new Error(`links.next leaves App Store Connect: ${next}`);
  return `${url.pathname}${url.search}`;
}

/** The registered bundle id's id, read page by page (200 a page, following links.next). */
async function registeredId(
  call: (request: AscRequest) => Promise<AscResponse>,
  bundleId: string,
): Promise<string | null> {
  let path: string | null =
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&fields[bundleIds]=identifier&limit=200`;
  while (path !== null) {
    const json = okJson(await call({ method: 'GET', path }), bundleId);
    const data = ascField(json, 'data');
    const list: readonly unknown[] = Array.isArray(data) ? data : [];
    const match = list.find(
      (item) => ascField(ascField(item, 'attributes'), 'identifier') === bundleId,
    );
    const id = ascField(match, 'id');
    if (typeof id === 'string') return id;
    path = nextPathOf(json);
  }
  return null;
}

/** Registers or keeps each game's bundle id; resolves the exit code (2: usage, key never read). */
export async function createBundleIds(
  argv: readonly string[],
  deps: BundleIdDeps,
): Promise<number> {
  const parsed = gamesOf(argv);
  if ('bad' in parsed) {
    deps.log(`${BUNDLE_ID_USAGE} (got ${parsed.bad})`);
    return EXIT_USAGE;
  }
  const token = deps.token();
  const call = (request: AscRequest): Promise<AscResponse> => deps.request(token, request);
  for (const game of parsed.games) {
    const bundleId = appIdOf(game);
    const existing = await registeredId(call, bundleId);
    if (existing !== null) {
      deps.log(`exists ${bundleId} (${existing})`);
      continue;
    }
    const attributes = { identifier: bundleId, name: bundleIdNameOf(game), platform: 'IOS' };
    const body = { data: { type: BUNDLE_IDS, attributes } };
    const created = okJson(await call({ method: 'POST', path: '/v1/bundleIds', body }), bundleId);
    deps.log(`created ${bundleId} (${String(ascField(ascField(created, 'data'), 'id'))})`);
  }
  return 0;
}
