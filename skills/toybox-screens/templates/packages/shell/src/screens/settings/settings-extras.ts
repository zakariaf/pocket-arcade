// packages/shell/src/screens/settings/settings-extras.ts
// What S11 needs beyond SettingsModel (settings-and-preferences): navigation, the store price,
// the version, and the one-off actions. use-settings-extras.ts builds it (the Music rows come
// from SettingsContext.hasMusic = useGameHost().hasMusic, in use-settings-context.ts).

export type SettingsExtras = {
  /** The store price ("€1.99"); null offline or before the store answers. */
  readonly removeAdsPriceText: string | null;
  /** "1.0.0 (8)". */
  readonly versionText: string;
  readonly onBack: () => void;
  readonly onOpenLanguage: () => void;
  readonly onOpenPremium: () => void;
  readonly onRestorePurchase: () => void;
  /** Reopens Google's consent form (the row shows only where privacy options are required). */
  readonly onOpenAdPrivacy: () => void;
  readonly onOpenPrivacyPolicy: () => void;
  /** Open the S14 reset-statistics and reset-progress dialogs. */
  readonly onResetStats: () => void;
  readonly onResetProgress: () => void;
  readonly onOpenAbout: () => void;
  readonly onOpenLicences: () => void;
  /** The store app handles rating; the game makes no request. */
  readonly onRate: () => void;
  /** The phone's mail app with the address and version filled in. */
  readonly onContact: () => void;
};
