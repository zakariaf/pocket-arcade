// packages/shell/src/screens/settings/privacy/use-privacy-policy-model.test.tsx
import { renderHook } from '@testing-library/react-native';

import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { usePrivacyPolicyModel } from './use-privacy-policy-model.ts';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('usePrivacyPolicyModel', () => {
  it('fills the policy with the game, the support address and the date it last changed', async () => {
    const shell = createHostWrapper();
    const { result } = await renderHook(() => usePrivacyPolicyModel(), { wrapper: shell.wrapper });

    expect(result.current.gameName).toBe('Tally');
    expect(result.current.emailText).toBe('support@example.com');
    expect(stripIsolates(result.current.updatedDateText)).toBe('27 Sep 2026');
    result.current.onBack();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('writes the date in the chosen digits', async () => {
    const shell = createHostWrapper({ language: 'fa' });
    const { result } = await renderHook(() => usePrivacyPolicyModel(), { wrapper: shell.wrapper });
    expect(result.current.updatedDateText).toContain('۲۰۲۶');
  });

  it('keeps the date free of isolates, so the sentence isolate takes the month direction', async () => {
    // An isolated month inside the isolated date left the outer isolate with no strong letter:
    // it resolved left to right and the fa date read "۲۰۲۶ سپتامبر ۲۷".
    const shell = createHostWrapper({ language: 'fa' });
    const { result } = await renderHook(() => usePrivacyPolicyModel(), { wrapper: shell.wrapper });
    expect(result.current.updatedDateText).toBe(stripIsolates(result.current.updatedDateText));
  });
});
