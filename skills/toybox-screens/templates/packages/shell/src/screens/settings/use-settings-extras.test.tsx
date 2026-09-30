// packages/shell/src/screens/settings/use-settings-extras.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { restorePremium } from '@e07/shell/services/purchase/premium-service.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useSettingsExtras } from './use-settings-extras.ts';

import type { DialogRequest } from '@e07/shell/screens/dialogs/dialog-request.ts';
import type { ConsentPort } from '@e07/shell/services/consent/consent-port.ts';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenDialog = jest.fn<undefined, [DialogRequest]>();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('@e07/shell/app/dialog-context.tsx', () => ({ useOpenDialog: () => mockOpenDialog }));
jest.mock('@e07/shell/app/premium-screen-deps-context.tsx', () => ({
  usePremiumScreenDeps: () => ({ service: { onError: jest.fn() }, gameName: { id: 'tally.name' } }),
}));
jest.mock('@e07/shell/services/purchase/premium-service.ts', () => ({
  restorePremium: jest.fn(() => Promise.resolve()),
}));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const INFO = { canRequestAds: true, isPrivacyOptionsRequired: true };

async function settingsExtras() {
  const consent: ConsentPort = {
    refresh: () => Promise.resolve(INFO),
    showFormIfRequired: () => Promise.resolve(INFO),
    showPrivacyOptions: jest.fn(() => Promise.resolve(INFO)),
  };
  const shell = createHostWrapper({ services: { consent } });
  const { result } = await renderHook(() => useSettingsExtras(), { wrapper: shell.wrapper });
  return { extras: result.current, consent, shell };
}

describe('useSettingsExtras', () => {
  it('shows the version with its build number, and no price before the store answers', async () => {
    const { extras } = await settingsExtras();
    expect([extras.versionText, extras.removeAdsPriceText]).toStrictEqual(['1.0.0 (8)', null]);
  });

  it('opens every sub-screen through navigation, the route table way', async () => {
    const { extras } = await settingsExtras();
    extras.onOpenLanguage();
    extras.onOpenAbout();
    extras.onOpenPrivacyPolicy();
    extras.onOpenLicences();
    extras.onOpenPremium();
    extras.onBack();

    expect(mockNavigate.mock.calls).toStrictEqual([
      ['SettingsLanguage'],
      ['About'],
      ['PrivacyPolicy'],
      ['Licences'],
      ['Premium'],
    ]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('restores the purchase and reopens the consent choices', async () => {
    const { extras, consent } = await settingsExtras();
    extras.onRestorePurchase();
    extras.onOpenAdPrivacy();
    expect(jest.mocked(restorePremium)).toHaveBeenCalledTimes(1);
    expect(consent.showPrivacyOptions).toHaveBeenCalledTimes(1);
  });

  it('asks before each reset, and the reset reaches the stores', async () => {
    const { extras, shell } = await settingsExtras();
    extras.onResetStats();
    extras.onResetProgress();
    const kinds = mockOpenDialog.mock.calls.map(([request]) => request.kind);
    expect(kinds).toStrictEqual(['reset-stats', 'reset-progress']);

    const [progressRequest] = mockOpenDialog.mock.calls[1] ?? [];
    if (progressRequest?.kind !== 'reset-progress') throw new Error('no reset-progress dialog');
    await act(() => {
      progressRequest.onConfirm();
    });
    expect(shell.stores.progress.getState().progress.levels).toStrictEqual({});
  });

  it("opens Reset all progress with the hold frozen at 46 % in the design's held frame", async () => {
    mockOpenDialog.mockClear();
    startParitySession({
      frame: 's14-reset-all-progress',
      plan: PARITY_PLANS['s14-reset-all-progress'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      await settingsExtras();
      expect(mockOpenDialog.mock.calls).toStrictEqual([
        [{ kind: 'reset-progress', onConfirm: expect.any(Function), frozenProgress: 0.46 }],
      ]);
    } finally {
      endParitySession();
    }
  });
});
