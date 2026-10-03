// packages/shell/src/config/external-links.test.ts
// no-shell-context: pure URL builders. The expected addresses are checked by their parts: URL
// literals are allowed only in external-links.ts itself.
import {
  licenceTextUrl,
  privacyPolicyUrl,
  storePageUrl,
  storeReviewUrl,
  supportMailUrl,
} from './external-links.ts';

function partsOf(url: string | null) {
  if (url === null) return null;
  const { protocol, host, pathname, search } = new URL(url);
  return { protocol, host, pathname, search };
}

describe('external links', () => {
  it('builds the privacy policy address from the game config', () => {
    const links = {
      privacyPolicy: { host: 'example.com', path: '/line-siege/privacy' },
      supportEmail: 'support@example.com',
    };
    expect(partsOf(privacyPolicyUrl(links))).toStrictEqual({
      protocol: 'https:',
      host: 'example.com',
      pathname: '/line-siege/privacy',
      search: '',
    });
  });

  it('opens the review page only once the game has an App Store id', () => {
    expect(storeReviewUrl(undefined)).toBeNull();
    expect(partsOf(storeReviewUrl('6740000001'))).toStrictEqual({
      protocol: 'https:',
      host: 'apps.apple.com',
      pathname: '/app/id6740000001',
      search: '?action=write-review',
    });
  });

  it("opens the game's App Store page for an update only once it has an App Store id", () => {
    expect(storePageUrl(undefined)).toBeNull();
    expect(partsOf(storePageUrl('6740000001'))).toStrictEqual({
      protocol: 'https:',
      host: 'apps.apple.com',
      pathname: '/app/id6740000001',
      search: '',
    });
  });

  it('fills in the support address and the version', () => {
    expect(supportMailUrl('support@example.com', '1.0.0 (8)')).toBe(
      'mailto:support@example.com?subject=Support%201.0.0%20(8)',
    );
  });

  it('finds the public text of SPDX licences and SDK terms, and nothing for other rows', () => {
    expect(partsOf(licenceTextUrl('SIL Open Font License 1.1'))?.pathname).toBe(
      '/licenses/OFL-1.1.html',
    );
    expect(partsOf(licenceTextUrl('MIT'))?.host).toBe('spdx.org');
    expect(partsOf(licenceTextUrl('Google Mobile Ads SDK Terms'))?.pathname).toBe('/admob/terms');
    expect(licenceTextUrl('LicenseRef-Public-Domain')).toBeNull();
    expect(licenceTextUrl('Made in code for this game')).toBeNull();
  });
});
