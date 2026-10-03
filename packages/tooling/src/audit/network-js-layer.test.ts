// packages/tooling/src/audit/network-js-layer.test.ts
import { packageOf } from './bundle-modules.ts';
import { jsNetworkFindings } from './network-js-layer.ts';

describe('jsNetworkFindings (layer B)', () => {
  it('groups third-party findings by package', () => {
    const { findings, firstParty } = jsNetworkFindings([
      { source: '../../node_modules/whatwg-fetch/dist/fetch.umd.js', content: 'fetch(url)' },
      { source: '../../node_modules/@iabtcf/core/lib/GVL.js', content: 'new XMLHttpRequest()' },
    ]);
    expect([...findings.keys()]).toStrictEqual(['whatwg-fetch', '@iabtcf/core']);
    expect(firstParty).toStrictEqual([]);
  });

  it('reports first-party network code directly', () => {
    const { firstParty } = jsNetworkFindings([
      {
        source: '../../packages/shell/src/app/boot.ts',
        content: "const u = 'https://example.com/x';",
      },
    ]);
    expect(firstParty).toStrictEqual(['../../packages/shell/src/app/boot.ts: remoteUrl']);
  });

  it('exempts exactly the external-links file, and only for its URLs', () => {
    const links = "export const PRIVACY_POLICY_URL = 'https://example.com/privacy';";
    const { firstParty } = jsNetworkFindings([
      { source: '../../packages/shell/src/config/external-links.ts', content: links },
      { source: '../../packages/shell/src/config/external-links-copy.ts', content: links },
      {
        source: 'packages/shell/src/config/external-links.ts',
        content: 'fetch(PRIVACY_POLICY_URL)',
      },
      { source: '../../apps/game/src/config/external-links.ts', content: links },
    ]);
    expect(firstParty).toStrictEqual([
      '../../packages/shell/src/config/external-links-copy.ts: remoteUrl',
      'packages/shell/src/config/external-links.ts: fetch',
      '../../apps/game/src/config/external-links.ts: remoteUrl',
    ]);
  });

  it('ignores localhost URLs', () => {
    const { firstParty } = jsNetworkFindings([
      { source: 'src/dev.ts', content: "const metro = 'http://localhost:8081';" },
    ]);
    expect(firstParty).toStrictEqual([]);
  });

  it('names scoped and plain packages', () => {
    expect(packageOf('node_modules/@scope/name/index.js')).toBe('@scope/name');
    expect(packageOf('packages/shell/src/app.ts')).toBeNull();
  });
});
