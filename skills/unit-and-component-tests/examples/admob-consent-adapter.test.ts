// packages/shell/src/services/consent/admob-consent-adapter.test.ts — drives the consent adapter
// against the root __mocks__. Lint bans importing the SDKs outside the adapters, so the test reads
// the mocks with jest.requireMock, typed with only what the assertions need. The explicit
// jest.mock() is required: without it, requireMock returns a second instance, not the one the
// adapter imported.
import { AppState, Platform } from 'react-native';

import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';

import type { AppStateStatus } from 'react-native';

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly getConsentInfo: jest.Mock<Promise<unknown>>;
  };
};
type Answer = { readonly status: 'granted' | 'denied' | 'undetermined' };
type MockedTracking = {
  readonly getTrackingPermissionsAsync: jest.Mock<Promise<Answer>>;
  readonly requestTrackingPermissionsAsync: jest.Mock<Promise<Answer>>;
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');
const tracking = jest.requireMock<MockedTracking>('expo-tracking-transparency');

const REQUIRED = {
  status: 'REQUIRED',
  canRequestAds: false,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};

// React Native's Jest setup mocks AppState.currentState as a function; each test that needs a
// state sets the string the device would report and puts the mock back afterwards.
const CURRENT_STATE = Object.getOwnPropertyDescriptor(AppState, 'currentState');

/** The adapter's AppState 'change' listener, and a state the test moves by hand. */
function scriptAppState(start: AppStateStatus): (next: AppStateStatus) => void {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: start });
  let listener: ((next: AppStateStatus) => void) | null = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler;
    return { remove: jest.fn() };
  });
  return (next) => {
    listener?.(next);
  };
}

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

describe('requestTracking (App Tracking Transparency)', () => {
  afterEach(() => {
    if (CURRENT_STATE !== undefined) Object.defineProperty(AppState, 'currentState', CURRENT_STATE);
  });

  it('asks the system once while not-determined and returns the answer', async () => {
    scriptAppState('active');
    const consent = createAdmobConsentAdapter({ onError: jest.fn() });

    await expect(consent.requestTracking()).resolves.toBe('denied');
    expect(tracking.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['granted', 'authorized'],
    ['denied', 'denied'], // Expo reports a restricted device as denied too
  ] as const)('asks nothing again once the answer is %s', async (status, expected) => {
    tracking.getTrackingPermissionsAsync.mockResolvedValueOnce({ status });

    await expect(createAdmobConsentAdapter({ onError: jest.fn() }).requestTracking()).resolves.toBe(
      expected,
    );
    expect(tracking.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('waits until the app is active: Apple shows no prompt in the background', async () => {
    const emit = scriptAppState('background');
    const pending = createAdmobConsentAdapter({ onError: jest.fn() }).requestTracking();
    await Promise.resolve();
    await Promise.resolve();
    expect(tracking.requestTrackingPermissionsAsync).not.toHaveBeenCalled();

    emit('active');

    await expect(pending).resolves.toBe('denied');
    expect(tracking.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('resolves unavailable when the read fails: logged, and ads go on without the IDFA', async () => {
    const onError = jest.fn();
    const broken = new Error('no native module');
    tracking.getTrackingPermissionsAsync.mockRejectedValueOnce(broken);

    await expect(createAdmobConsentAdapter({ onError }).requestTracking()).resolves.toBe(
      'unavailable',
    );
    expect(onError).toHaveBeenCalledWith(broken);
  });

  it('answers unavailable off iOS without touching the tracking module', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await expect(createAdmobConsentAdapter({ onError: jest.fn() }).requestTracking()).resolves.toBe(
      'unavailable',
    );
    expect(tracking.getTrackingPermissionsAsync).not.toHaveBeenCalled();
  });
});
