// packages/shell/src/screens/settings/about/use-about-model.test.tsx
import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useAboutModel } from './use-about-model.ts';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

describe('useAboutModel', () => {
  it("shows the game's identity, the version and the support address", async () => {
    const shell = createHostWrapper();
    const { result } = await renderHook(() => useAboutModel(), { wrapper: shell.wrapper });

    expect(result.current).toMatchObject({
      gameName: 'Tally',
      tagline: 'Count to the target.',
      versionText: '1.0.0 (8)',
      emailText: 'support@example.com',
      logo: shell.host.logo,
    });
  });

  it('hands Contact to the mail app and opens Licences', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const shell = createHostWrapper();
    const { result } = await renderHook(() => useAboutModel(), { wrapper: shell.wrapper });

    result.current.onContact();
    result.current.onOpenLicences();
    expect(openUrl).toHaveBeenCalledWith(
      'mailto:support@example.com?subject=Support%201.0.0%20(8)',
    );
    expect(mockNavigate).toHaveBeenCalledWith('Licences');
  });
});
