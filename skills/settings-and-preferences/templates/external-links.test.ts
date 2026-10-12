// packages/shell/src/config/external-links.test.ts
// no-shell-context: pure URL builders. The expected addresses are checked by their parts: URL
// literals are allowed only in external-links.ts itself.
import {
  licenceTextUrl,
  playStoreUrls,
  privacyPolicyUrl,
  storePageUrl,
  storeReviewUrl,
  storeReviewUrlsOf,
  storeUpdateUrlsOf,
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

  it("opens the game's Google Play page in the Play Store app, then on the web (spec S11, N3)", () => {
    // Spec S11: "Rate this game: opens the store page. The store app handles this; the game itself
    // makes no request." market: needs the Play Store app; the https page is the fallback.
    expect(playStoreUrls(undefined)).toBeNull();
    expect(playStoreUrls('io.applander.linesiege')?.map(partsOf)).toStrictEqual([
      { protocol: 'market:', host: 'details', pathname: '', search: '?id=io.applander.linesiege' },
      {
        protocol: 'https:',
        host: 'play.google.com',
        pathname: '/store/apps/details',
        search: '?id=io.applander.linesiege',
      },
    ]);
  });

  it('picks the store by platform: the App Store on iOS, Google Play on Android', () => {
    const ids = { appStoreId: '6740000001', androidPackage: 'io.applander.linesiege' };
    expect(storeReviewUrlsOf({ os: 'ios', ...ids })).toStrictEqual([storeReviewUrl('6740000001')]);
    expect(storeUpdateUrlsOf({ os: 'ios', ...ids })).toStrictEqual([storePageUrl('6740000001')]);
    expect(storeReviewUrlsOf({ os: 'android', ...ids })).toStrictEqual(
      playStoreUrls('io.applander.linesiege'),
    );
    expect(storeUpdateUrlsOf({ os: 'android', ...ids })).toStrictEqual(
      playStoreUrls('io.applander.linesiege'),
    );
  });

  it('opens nothing before the store knows the game', () => {
    const none = { appStoreId: undefined, androidPackage: undefined };
    expect(storeReviewUrlsOf({ os: 'ios', ...none })).toBeNull();
    expect(storeUpdateUrlsOf({ os: 'ios', ...none })).toBeNull();
    expect(storeReviewUrlsOf({ os: 'android', ...none })).toBeNull();
    expect(storeUpdateUrlsOf({ os: 'android', ...none })).toBeNull();
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
