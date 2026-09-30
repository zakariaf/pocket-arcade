// packages/shell/src/services/consent/consent-port.ts
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

export type ConsentPort = {
  // Every launch (not Premium, ads enabled). Offline: returns the last session's answer.
  readonly refresh: () => Promise<ConsentInfo>;
  // Screen S3: shows Google's form only where required. Offline: returns cached info.
  readonly showFormIfRequired: () => Promise<ConsentInfo>;
  // Settings > Ad privacy choices.
  readonly showPrivacyOptions: () => Promise<ConsentInfo>;
};
