// packages/shell/src/config/external-links.ts
// The ONE app file allowed to hold URL literals: OS hand-off links only (the App Store's review
// and product pages, Google Play's page of the game, the privacy policy and a licence's public text
// in the browser, the phone's mail app). The no-URL lint rule and the
// network audit exempt exactly this path (privacy-and-network-audit); nothing here fetches.
import type { GameExtra } from '@e07/shell/config/game-extra.ts';

/** The published privacy policy (the stores and AdMob need its address; S11c shows it offline). */
export function privacyPolicyUrl(links: GameExtra['links']): string {
  return `https://${links.privacyPolicy.host}${links.privacyPolicy.path}`;
}

/** The App Store's write-review page; null until the game has an App Store id. */
export function storeReviewUrl(appStoreId: string | undefined): string | null {
  return appStoreId === undefined
    ? null
    : `https://apps.apple.com/app/id${appStoreId}?action=write-review`;
}

/** The game's App Store page (S14 "please update" for a save from a newer version); null without an id. */
export function storePageUrl(appStoreId: string | undefined): string | null {
  return appStoreId === undefined ? null : `https://apps.apple.com/app/id${appStoreId}`;
}

/**
 * Google Play's page of the game, where the player rates it or updates it (Play has no write-review
 * link): first in the Play Store app (market:), then on the web for a phone without the Play Store
 * (an emulator's google_apis image). Null until the build knows its Android package.
 */
export function playStoreUrls(androidPackage: string | undefined): readonly string[] | null {
  if (androidPackage === undefined) return null;
  const query = `?id=${encodeURIComponent(androidPackage)}`;
  return [`market://details${query}`, `https://play.google.com/store/apps/details${query}`];
}

/** The two stores a build can hand its links to, and what each knows the game by. */
export type StoreIds = {
  /** `Platform.OS`: 'android' opens Google Play, anything else the App Store. */
  readonly os: string;
  readonly appStoreId: string | undefined;
  /** The Android package (`expo.android.package`), Google Play's id for the game. */
  readonly androidPackage: string | undefined;
};

/** The links to the game's store, tried in order: Google Play's page on Android, else `appStore`'s. */
function storeUrlsOf(
  ids: StoreIds,
  appStore: (appStoreId: string | undefined) => string | null,
): readonly string[] | null {
  if (ids.os === 'android') return playStoreUrls(ids.androidPackage);
  const url = appStore(ids.appStoreId);
  return url === null ? null : [url];
}

/** S11's Rate, tried in order: the App Store's review page on iOS, Google Play's page on Android. */
export function storeReviewUrlsOf(ids: StoreIds): readonly string[] | null {
  return storeUrlsOf(ids, storeReviewUrl);
}

/** S14's "please update", tried in order: the App Store page on iOS, Google Play's page on Android. */
export function storeUpdateUrlsOf(ids: StoreIds): readonly string[] | null {
  return storeUrlsOf(ids, storePageUrl);
}

/** The phone's mail app with the support address, and the version in the subject. */
export function supportMailUrl(supportEmail: string, versionText: string): string {
  return `mailto:${supportEmail}?subject=${encodeURIComponent(`Support ${versionText}`)}`;
}

/** The licence names S11d shows that are not SPDX ids themselves. */
const SPDX_ID_OF: Readonly<Record<string, string>> = {
  'SIL Open Font License 1.1': 'OFL-1.1',
  'Apache License 2.0': 'Apache-2.0',
};

/** Terms that have a publisher page instead of an SPDX entry (host and path, no scheme). */
const TERMS_PAGE_OF: Readonly<Record<string, string>> = {
  'Google Mobile Ads SDK Terms': 'developers.google.com/admob/terms',
};

const SPDX_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

/**
 * The public text of a licence for S11d's "Show licence text": the SPDX page of an SPDX id (or of
 * a name mapped above), the publisher's page for SDK terms, null for anything else (the game's
 * own sounds, a LicenseRef- entry): that row then opens nothing.
 */
export function licenceTextUrl(licence: string): string | null {
  const terms = TERMS_PAGE_OF[licence];
  if (terms !== undefined) return `https://${terms}`;
  const id = SPDX_ID_OF[licence] ?? licence;
  if (!SPDX_ID.test(id) || id.startsWith('LicenseRef-')) return null;
  return `https://spdx.org/licenses/${id}.html`;
}
