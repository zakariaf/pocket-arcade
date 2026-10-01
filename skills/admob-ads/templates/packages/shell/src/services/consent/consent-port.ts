// packages/shell/src/services/consent/consent-port.ts
export type ConsentInfo = {
  readonly canRequestAds: boolean;
  readonly isPrivacyOptionsRequired: boolean; // show the "Ad privacy choices" row (S11)
};

/**
 * Apple's App Tracking Transparency answer (guideline 5.1.2(i)). Only 'authorized' lets Google's
 * SDK read the IDFA; every other status still serves ads, without it. 'unavailable': not iOS, ads
 * off, or the status could not be read.
 */
export type TrackingStatus =
  'authorized' | 'denied' | 'restricted' | 'not-determined' | 'unavailable';

export type ConsentPort = {
  // Every launch (not Premium, ads enabled). Offline: returns the last session's answer.
  readonly refresh: () => Promise<ConsentInfo>;
  // Screen S3: shows Google's form only where required. Offline: returns cached info.
  readonly showFormIfRequired: () => Promise<ConsentInfo>;
  // Settings > Ad privacy choices.
  readonly showPrivacyOptions: () => Promise<ConsentInfo>;
  // After Google's form, before the first ad request: the system ATT prompt, only while the status
  // is not-determined and the app is active; otherwise the status. Never rejects.
  readonly requestTracking: () => Promise<TrackingStatus>;
};
