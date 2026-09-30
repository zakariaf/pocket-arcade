// packages/shell/src/config/game-config.ts
// Neutral file: read by Node (app.config.ts) and by the app program; types only.
import type { AdmobGameIds } from './ads-config.ts';

export type LanguageCode = 'en' | 'de' | 'fa' | 'ckb';

/** An ASC `ageRatingDeclarations` value; the API lists both the old and the new scale. */
export type AgeRatingLevel =
  'NONE' | 'INFREQUENT_OR_MILD' | 'FREQUENT_OR_INTENSE' | 'INFREQUENT' | 'FREQUENT';

/** App Store Connect age-rating answers, keyed by ASC attribute name (store step). */
export type AgeRatingAnswers = Readonly<Record<string, AgeRatingLevel | boolean>>;

/** Spec section 11: ONE file per game, apps/<game>/game.config.ts. */
export type GameConfig = {
  /** kebab-case; equals GameModule.identity.id and the apps/<id> folder. */
  readonly id: string;
  readonly appName: Readonly<Record<LanguageCode, string>>;
  /** Same id on iOS and Android: ^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$ */
  readonly bundleId: string;
  /** Numeric Apple ID of the App Store Connect record (rate link); null until created. */
  readonly appStoreId: string | null;
  /** Marketing version, semver. */
  readonly version: string;
  /** Monotonic integer; CFBundleVersion and versionCode. Bumped by release:ios. */
  readonly buildNumber: number;
  readonly premium: {
    readonly productId: string;
    /** Human note only; prices live in the store consoles. */
    readonly priceNote: string;
  };
  /** Spec 8.8 + 4.3: the ads master switch, frequency numbers and AdMob IDs. */
  readonly ads: {
    readonly isEnabled: boolean;
    readonly policy: {
      readonly minLevelsCompletedBeforeFirst: number;
      readonly minMsBetweenInterstitials: number;
      readonly minLevelsCompletedBetween: number;
    };
    readonly ids: AdmobGameIds;
  };
  readonly modes: { readonly daily: boolean; readonly endless: boolean };
  /** Must match GameModule.levels.packs (a contract test checks it). */
  readonly levels: { readonly packCount: number; readonly levelsPerPack: number };
  readonly hints: { readonly freePerDay: number };
  readonly isContinueAllowed: boolean;
  /** No URL literals in app code (N3 lint): external-links.ts builds https://<host><path>. */
  readonly links: {
    readonly privacyPolicy: { readonly host: string; readonly path: string };
    readonly supportEmail: string;
  };
  readonly store: {
    readonly audience: 'general' | 'children';
    readonly ageRating: AgeRatingAnswers;
  };
};
