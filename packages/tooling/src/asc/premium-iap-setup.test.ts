// packages/tooling/src/asc/premium-iap-setup.test.ts
// The Premium product script on a fake App Store Connect: no test reaches the network.
import { createPremiumIap, PREMIUM_IAP_USAGE } from './premium-iap-setup.ts';

import type { AscRequest, AscResponse } from './asc-client.ts';

const APPS = [
  {
    type: 'apps',
    id: 'app-two',
    attributes: { name: 'Line Siege Two', bundleId: 'io.applander.linesiege2' },
  },
  {
    type: 'apps',
    id: 'app-one',
    attributes: { name: 'Line Siege', bundleId: 'io.applander.linesiege' },
  },
];

/** Answers each request by its path; records every request in order. */
function fakeAsc(): {
  readonly requests: AscRequest[];
  readonly request: (token: string, request: AscRequest) => Promise<AscResponse>;
} {
  const requests: AscRequest[] = [];
  const answer = (path: string): unknown => {
    if (path.startsWith('/v1/apps?')) return { data: APPS };
    if (path.includes('/inAppPurchasesV2?')) return { data: [] };
    if (path === '/v2/inAppPurchases') return { data: { id: 'iap-1' } };
    if (path.endsWith('/pricePoints?filter[territory]=DEU&limit=8000')) {
      return {
        data: [
          { id: 'point-299', attributes: { customerPrice: '2.99' } },
          { id: 'point-199', attributes: { customerPrice: '1.99' } },
        ],
      };
    }
    return { data: [] };
  };
  return {
    requests,
    request: (_token, request) => {
      requests.push(request);
      return Promise.resolve({ ok: true, status: 200, json: answer(request.path) });
    },
  };
}

function depsWith(asc: ReturnType<typeof fakeAsc>, lines: string[]) {
  return {
    token: jest.fn(() => 'token'),
    request: asc.request,
    targetEur: 1.99,
    log: (line: string) => {
      lines.push(line);
    },
  };
}

describe('createPremiumIap (spec N7, owner decisions O2, O3 and O4)', () => {
  it.each([[[]], [['com.example.linesiege']], [['io.applander.line-siege']], [['', 'x']]])(
    'refuses %j with its usage and exit 2, before it reads the key or asks Apple',
    async (argv) => {
      const asc = fakeAsc();
      const lines: string[] = [];
      const deps = depsWith(asc, lines);
      await expect(createPremiumIap(argv, deps)).resolves.toBe(2);
      expect(lines).toStrictEqual([PREMIUM_IAP_USAGE]);
      expect([deps.token.mock.calls.length, asc.requests.length]).toStrictEqual([0, 0]);
    },
  );

  it("creates the paid product on the app whose bundle id is exactly the game's", async () => {
    const asc = fakeAsc();
    const lines: string[] = [];
    await expect(createPremiumIap(['io.applander.linesiege'], depsWith(asc, lines))).resolves.toBe(
      0,
    );
    const paths = asc.requests.map((request) => `${request.method} ${request.path}`);
    expect(paths.slice(0, 3)).toStrictEqual([
      'GET /v1/apps?filter[bundleId]=io.applander.linesiege&fields[apps]=name,bundleId',
      'GET /v1/apps/app-one/inAppPurchasesV2?filter[productId]=io.applander.linesiege.premium',
      'POST /v2/inAppPurchases',
    ]);
    expect(JSON.stringify(asc.requests[2]?.body)).toContain(
      '"app":{"data":{"type":"apps","id":"app-one"}}',
    );
    expect(paths.at(-1)).toBe('POST /v1/inAppPurchasePriceSchedules');
    expect(JSON.stringify(asc.requests.at(-1)?.body)).toContain('point-199');
    expect(lines).toStrictEqual(['Premium iap-1: EUR 1.99; next: availability, screenshot']);
  });

  it('stops before creating anything when no app record has the bundle id (owner step G2)', async () => {
    const asc = fakeAsc();
    const only = (token: string, request: AscRequest): Promise<AscResponse> =>
      request.path.startsWith('/v1/apps?')
        ? Promise.resolve({ ok: true, status: 200, json: { data: [APPS[0]] } })
        : asc.request(token, request);
    const deps = { ...depsWith(asc, []), request: only };
    await expect(createPremiumIap(['io.applander.linesiege'], deps)).rejects.toThrow(
      'no app record for io.applander.linesiege: human step G2',
    );
    expect(asc.requests).toStrictEqual([]);
  });
});
