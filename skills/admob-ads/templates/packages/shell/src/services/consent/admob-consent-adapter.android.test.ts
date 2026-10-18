// packages/shell/src/services/consent/admob-consent-adapter.android.test.ts — the consent adapter
// where Platform.OS is 'android' (the unit-android Jest project). Google's UMP works as on iOS;
// Apple's App Tracking Transparency does not exist, so requestTracking answers 'unavailable' at
// once and never touches expo-tracking-transparency (L14). The mocks are read as in the iOS test.
import { AppState, Platform } from 'react-native';

import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly loadAndShowConsentFormIfRequired: jest.Mock<Promise<unknown>>;
    readonly showPrivacyOptionsForm: jest.Mock<Promise<unknown>>;
    readonly getConsentInfo: jest.Mock<Promise<unknown>>;
  };
};
type MockedTracking = {
  readonly getTrackingPermissionsAsync: jest.Mock<Promise<unknown>>;
  readonly requestTrackingPermissionsAsync: jest.Mock<Promise<unknown>>;
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');
const tracking = jest.requireMock<MockedTracking>('expo-tracking-transparency');

const REQUIRED = {
  status: 'REQUIRED',
  canRequestAds: false,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};
const OBTAINED = {
  status: 'OBTAINED',
  canRequestAds: true,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};

// Spec 4.2 point 2: Google's consent form where it is required; L14: no tracking prompt off iOS.
describe('createAdmobConsentAdapter on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('answers unavailable at once, without touching the tracking module', async () => {
    const onError = jest.fn();

    await expect(createAdmobConsentAdapter({ onError }).requestTracking()).resolves.toBe(
      'unavailable',
    );
    expect(tracking.getTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(tracking.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('answers without waiting for the app to become active (no prompt to wait for)', async () => {
    const listen = jest.spyOn(AppState, 'addEventListener');

    await expect(createAdmobConsentAdapter({ onError: jest.fn() }).requestTracking()).resolves.toBe(
      'unavailable',
    );
    expect(listen).not.toHaveBeenCalled();
  });

  it("refreshes Google's consent answer as on iOS", async () => {
    AdsConsent.requestInfoUpdate.mockResolvedValueOnce(REQUIRED);

    await expect(
      createAdmobConsentAdapter({ onError: jest.fn() }).refresh(),
    ).resolves.toStrictEqual({
      canRequestAds: false,
      isPrivacyOptionsRequired: true,
    });
    expect(AdsConsent.requestInfoUpdate).toHaveBeenCalledWith({});
  });

  it("shows Google's form and the privacy options as on iOS", async () => {
    AdsConsent.loadAndShowConsentFormIfRequired.mockResolvedValueOnce(OBTAINED);
    AdsConsent.showPrivacyOptionsForm.mockResolvedValueOnce(OBTAINED);
    const consent = createAdmobConsentAdapter({ onError: jest.fn() });

    const granted = { canRequestAds: true, isPrivacyOptionsRequired: true };
    await expect(consent.showFormIfRequired()).resolves.toStrictEqual(granted);
    await expect(consent.showPrivacyOptions()).resolves.toStrictEqual(granted);
  });

  it("falls back to the last session's answer when the update fails offline", async () => {
    const onError = jest.fn();
    const offline = new Error('offline');
    AdsConsent.requestInfoUpdate.mockRejectedValueOnce(offline);

    await expect(createAdmobConsentAdapter({ onError }).refresh()).resolves.toStrictEqual({
      canRequestAds: true,
      isPrivacyOptionsRequired: false,
    });
    expect(onError).toHaveBeenCalledWith(offline);
  });
});
