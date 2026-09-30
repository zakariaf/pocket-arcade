// packages/shell/src/services/consent/admob-consent-adapter.test.ts — drives the UMP consent adapter
// against the root __mocks__. Lint bans importing the SDK outside the adapters, so the test reads the mock
// with jest.requireMock, typed with only what the assertions need. The explicit jest.mock() is required:
// without it, requireMock returns a second instance, not the one the adapter imported (verified).
import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly getConsentInfo: jest.Mock<Promise<unknown>>;
  };
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

const REQUIRED = {
  status: 'REQUIRED',
  canRequestAds: false,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};

describe('createAdmobConsentAdapter', () => {
  it('shows the privacy-options row when UMP requires it', async () => {
    AdsConsent.requestInfoUpdate.mockResolvedValueOnce(REQUIRED);
    const consent = createAdmobConsentAdapter({ onError: jest.fn() });

    await expect(consent.refresh()).resolves.toStrictEqual({
      canRequestAds: false,
      isPrivacyOptionsRequired: true,
    });
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
    expect(AdsConsent.getConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('passes a debug geography only when the debug menu sets one', async () => {
    await createAdmobConsentAdapter({ onError: jest.fn() }).refresh();
    await createAdmobConsentAdapter({ debugGeography: 'eea', onError: jest.fn() }).refresh();

    expect(AdsConsent.requestInfoUpdate.mock.calls).toStrictEqual([[{}], [{ debugGeography: 1 }]]);
  });
});
