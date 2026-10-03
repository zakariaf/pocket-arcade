// packages/shell/src/services/consent/consent-factory.test.ts — an ADS_MODE=off build never asks
// Google's UMP (a network request) nor Apple's tracking prompt; test and live builds use the real
// consent adapter.
import { createConsentPort } from './consent-factory.ts';

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly loadAndShowConsentFormIfRequired: jest.Mock<Promise<unknown>>;
  };
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');
const tracking = jest.requireMock<{
  readonly getTrackingPermissionsAsync: jest.Mock;
  readonly requestTrackingPermissionsAsync: jest.Mock;
}>('expo-tracking-transparency');

const NO_ADS = { canRequestAds: false, isPrivacyOptionsRequired: false };

describe('createConsentPort', () => {
  it('makes no consent request to Google in an ADS_MODE=off build', async () => {
    const consent = createConsentPort('off', { onError: jest.fn() });

    await expect(consent.refresh()).resolves.toStrictEqual(NO_ADS);
    await expect(consent.showFormIfRequired()).resolves.toStrictEqual(NO_ADS);
    expect(AdsConsent.requestInfoUpdate).not.toHaveBeenCalled();
    expect(AdsConsent.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
  });

  it('shows no tracking prompt in an ADS_MODE=off build (every E2E build)', async () => {
    const consent = createConsentPort('off', { onError: jest.fn() });

    await expect(consent.requestTracking()).resolves.toBe('unavailable');
    expect(tracking.getTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(tracking.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each(['test', 'live'] as const)('asks Google in an ADS_MODE=%s build', async (adsMode) => {
    await createConsentPort(adsMode, { onError: jest.fn() }).refresh();

    expect(AdsConsent.requestInfoUpdate).toHaveBeenCalledTimes(1);
  });
});
