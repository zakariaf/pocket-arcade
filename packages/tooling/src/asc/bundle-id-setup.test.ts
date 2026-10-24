// packages/tooling/src/asc/bundle-id-setup.test.ts
// App Store Connect is a fake here: no test reaches the network.
import { ASC_ORIGIN, BUNDLE_ID_USAGE, bundleIdNameOf, createBundleIds } from './bundle-id-setup.ts';

import type { AscRequest, AscResponse } from './asc-client.ts';
import type { BundleIdDeps } from './bundle-id-setup.ts';

const BUNDLE_IDS = 'bundleIds';
const FIRST_PAGE =
  '/v1/bundleIds?filter[identifier]=io.applander.flocktilt&fields[bundleIds]=identifier&limit=200';

type Registered = { readonly id: string; readonly identifier: string };

/** A fake App Store Connect that knows these bundle ids and registers new ones as it is asked. */
function fakeAsc(known: readonly Registered[]): {
  readonly requests: AscRequest[];
  readonly lines: string[];
  readonly deps: BundleIdDeps;
  readonly tokens: () => number;
} {
  const requests: AscRequest[] = [];
  const lines: string[] = [];
  let tokenCount = 0;
  const data = known.map(({ id, identifier }) => ({
    id,
    attributes: { identifier },
  }));
  const request = (_token: string, asked: AscRequest): Promise<AscResponse> => {
    requests.push(asked);
    if (asked.method === 'POST') {
      return Promise.resolve({ ok: true, status: 201, json: { data: { id: 'NEW1' } } });
    }
    return Promise.resolve({ ok: true, status: 200, json: { data } });
  };
  return {
    requests,
    lines,
    tokens: () => tokenCount,
    deps: {
      token: () => {
        tokenCount += 1;
        return 'token';
      },
      request,
      log: (line) => {
        lines.push(line);
      },
    },
  };
}

describe('bundleIdNameOf', () => {
  it("names the bundle id after the game's words", () => {
    expect(bundleIdNameOf('flock-tilt')).toBe('Flock Tilt');
    expect(bundleIdNameOf('stepstone')).toBe('Stepstone');
  });
});

describe('createBundleIds (owner decision O4: io.applander.<game id without hyphens>)', () => {
  it('registers an explicit iOS bundle id named after the game when none exists', async () => {
    const asc = fakeAsc([]);
    await expect(createBundleIds(['--app', 'flock-tilt'], asc.deps)).resolves.toBe(0);
    expect(asc.requests).toStrictEqual([
      {
        method: 'GET',
        path: FIRST_PAGE,
      },
      {
        method: 'POST',
        path: '/v1/bundleIds',
        body: {
          data: {
            type: BUNDLE_IDS,
            attributes: {
              identifier: 'io.applander.flocktilt',
              name: 'Flock Tilt',
              platform: 'IOS',
            },
          },
        },
      },
    ]);
    expect(asc.lines).toStrictEqual(['created io.applander.flocktilt (NEW1)']);
  });

  it('keeps a bundle id that is already registered (re-running is safe)', async () => {
    const asc = fakeAsc([{ id: 'OLD1', identifier: 'io.applander.flocktilt' }]);
    await expect(createBundleIds(['--app', 'flock-tilt'], asc.deps)).resolves.toBe(0);
    expect(asc.requests.map((asked) => asked.method)).toStrictEqual(['GET']);
    expect(asc.lines).toStrictEqual(['exists io.applander.flocktilt (OLD1)']);
  });

  it('asks for 200 a page and follows links.next to a bundle id on a later page', async () => {
    const asc = fakeAsc([]);
    const asked: string[] = [];
    const next = `${ASC_ORIGIN}/v1/bundleIds?cursor=Mg&limit=200`;
    const pages: Readonly<Record<string, unknown>> = {
      [FIRST_PAGE]: {
        data: [{ id: 'OTHER', attributes: { identifier: 'io.applander.flocktilt2' } }],
        links: { self: FIRST_PAGE, next },
      },
      '/v1/bundleIds?cursor=Mg&limit=200': {
        data: [{ id: 'OLD2', attributes: { identifier: 'io.applander.flocktilt' } }],
        links: { self: next },
      },
    };
    const deps: BundleIdDeps = {
      ...asc.deps,
      request: (_token, request) => {
        asked.push(`${request.method} ${request.path}`);
        return Promise.resolve({ ok: true, status: 200, json: pages[request.path] ?? null });
      },
    };
    await expect(createBundleIds(['--app', 'flock-tilt'], deps)).resolves.toBe(0);
    expect(asked).toStrictEqual([`GET ${FIRST_PAGE}`, 'GET /v1/bundleIds?cursor=Mg&limit=200']);
    expect(asc.lines).toStrictEqual(['exists io.applander.flocktilt (OLD2)']);
  });

  it('refuses a links.next that leaves App Store Connect', async () => {
    const asc = fakeAsc([]);
    const deps: BundleIdDeps = {
      ...asc.deps,
      request: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: { data: [], links: { next: `${ASC_ORIGIN}.example/v1/bundleIds?cursor=Mg` } },
        }),
    };
    await expect(createBundleIds(['--app', 'flock-tilt'], deps)).rejects.toThrow(
      'links.next leaves App Store Connect',
    );
  });

  it("does not take another bundle id that starts with the game's for the game's", async () => {
    const asc = fakeAsc([{ id: 'OTHER', identifier: 'io.applander.flocktilt2' }]);
    await createBundleIds(['--app', 'flock-tilt'], asc.deps);
    expect(asc.lines).toStrictEqual(['created io.applander.flocktilt (NEW1)']);
  });

  it('registers every game it is given, one token for all of them', async () => {
    const asc = fakeAsc([{ id: 'OLD1', identifier: 'io.applander.flocktilt' }]);
    await createBundleIds(['--app', 'flock-tilt', '--app', 'scrap-shove'], asc.deps);
    expect(asc.lines).toStrictEqual([
      'exists io.applander.flocktilt (OLD1)',
      'created io.applander.scrapshove (NEW1)',
    ]);
    expect(asc.tokens()).toBe(1);
  });

  it('stops with the usage before the key is read when a game id is not one', async () => {
    const asc = fakeAsc([]);
    await expect(
      createBundleIds(['--app', 'flock-tilt', '--app', 'Flock_Tilt'], asc.deps),
    ).resolves.toBe(2);
    expect(asc.lines).toStrictEqual([`${BUNDLE_ID_USAGE} (got Flock_Tilt)`]);
    expect(asc.tokens()).toBe(0);
    expect(asc.requests).toStrictEqual([]);
  });

  it('names a misspelt flag, not the value after it, in the usage', async () => {
    const asc = fakeAsc([]);
    await expect(createBundleIds(['--ap', 'line-siege'], asc.deps)).resolves.toBe(2);
    expect(asc.lines).toStrictEqual([`${BUNDLE_ID_USAGE} (got --ap)`]);
    expect(asc.tokens()).toBe(0);
  });

  it('names a missing game id after the last --app', async () => {
    const asc = fakeAsc([]);
    await expect(createBundleIds(['--app'], asc.deps)).resolves.toBe(2);
    expect(asc.lines).toStrictEqual([`${BUNDLE_ID_USAGE} (got nothing after --app)`]);
  });

  it('stops with the usage when no game is given', async () => {
    const asc = fakeAsc([]);
    await expect(createBundleIds([], asc.deps)).resolves.toBe(2);
    expect(asc.lines).toStrictEqual([`${BUNDLE_ID_USAGE} (got no --app)`]);
  });

  it("stops on App Store Connect's refusal and names it, registering nothing after it", async () => {
    const asc = fakeAsc([]);
    const deps: BundleIdDeps = {
      ...asc.deps,
      request: () =>
        Promise.resolve({
          ok: false,
          status: 409,
          errors: [{ code: 'ENTITY_ERROR.ATTRIBUTE.INVALID', detail: 'already in use' }],
        }),
    };
    await expect(
      createBundleIds(['--app', 'flock-tilt', '--app', 'scrap-shove'], deps),
    ).rejects.toThrow(
      'App Store Connect answered 409 (ENTITY_ERROR.ATTRIBUTE.INVALID: already in use) for io.applander.flocktilt',
    );
  });
});
