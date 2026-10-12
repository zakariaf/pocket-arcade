// packages/tooling/src/asc/find-app.test.ts
// App Store Connect is a fake here: no test reaches the network.
import { findAppByBundleId } from './find-app.ts';

import type { AscRequest, AscResponse } from './asc-client.ts';

type App = { readonly id: string; readonly name: string; readonly bundleId: string };

const LINE_SIEGE: App = {
  id: '6700000001',
  name: 'Line Siege',
  bundleId: 'io.applander.linesiege',
};
const LINE_SIEGE_TWO: App = {
  id: '6700000002',
  name: 'Line Siege Two',
  bundleId: 'io.applander.linesiege2',
};

/** A fake ascRequest answering every GET with these apps; it records the paths it was asked. */
function answering(apps: readonly App[]): {
  readonly paths: string[];
  readonly request: (token: string, request: AscRequest) => Promise<AscResponse>;
} {
  const paths: string[] = [];
  const data = apps.map(({ id, name, bundleId }) => ({
    type: 'apps',
    id,
    attributes: { name, bundleId },
  }));
  return {
    paths,
    request: (_token, request) => {
      paths.push(request.path);
      return Promise.resolve({ ok: true, status: 200, json: { data } });
    },
  };
}

describe('findAppByBundleId (owner decision O4: io.applander.<game id without hyphens>)', () => {
  it('asks for the app records of the bundle id with their names and bundle ids', async () => {
    const asc = answering([LINE_SIEGE]);
    await findAppByBundleId('token', 'io.applander.linesiege', asc.request);
    expect(asc.paths).toStrictEqual([
      '/v1/apps?filter[bundleId]=io.applander.linesiege&fields[apps]=name,bundleId',
    ]);
  });

  it('returns only the record whose bundle id is exactly the one asked for', async () => {
    const asc = answering([LINE_SIEGE_TWO, LINE_SIEGE]);
    await expect(
      findAppByBundleId('token', 'io.applander.linesiege', asc.request),
    ).resolves.toStrictEqual({ id: '6700000001', name: 'Line Siege' });
  });

  it('finds no record when only another bundle id answers (owner step G2)', async () => {
    const asc = answering([LINE_SIEGE_TWO]);
    await expect(
      findAppByBundleId('token', 'io.applander.linesiege', asc.request),
    ).resolves.toBeNull();
  });

  it('stops when two records carry the same bundle id', async () => {
    const asc = answering([LINE_SIEGE, { ...LINE_SIEGE, id: '6700000003' }]);
    await expect(findAppByBundleId('token', 'io.applander.linesiege', asc.request)).rejects.toThrow(
      'App Store Connect has 2 app records for io.applander.linesiege (6700000001, 6700000003): ask the owner which one is the game',
    );
  });

  it("names App Store Connect's answer when the request fails", async () => {
    const request = (): Promise<AscResponse> =>
      Promise.resolve({ ok: false, status: 401, errors: [{ code: 'NOT_AUTHORIZED', detail: '' }] });
    await expect(findAppByBundleId('token', 'io.applander.linesiege', request)).rejects.toThrow(
      'App Store Connect answered 401 (NOT_AUTHORIZED)',
    );
  });
});
