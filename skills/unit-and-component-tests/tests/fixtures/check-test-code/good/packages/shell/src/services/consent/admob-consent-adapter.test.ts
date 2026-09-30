import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: { readonly requestInfoUpdate: jest.Mock<Promise<unknown>> };
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

describe('createAdmobConsentAdapter', () => {
  it('falls back to the cached answer offline', async () => {
    const onError = jest.fn();
    AdsConsent.requestInfoUpdate.mockRejectedValueOnce(new Error('offline'));
    await expect(createAdmobConsentAdapter({ onError }).refresh()).resolves.toStrictEqual({ canRequestAds: true, isPrivacyOptionsRequired: false });
  });
});
