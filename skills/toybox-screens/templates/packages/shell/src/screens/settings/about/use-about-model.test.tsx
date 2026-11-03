// packages/shell/src/screens/settings/about/use-about-model.test.tsx
import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useAboutModel } from './use-about-model.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';

type TestGameExtraModule = {
  readonly TEST_GAME_EXTRA: GameExtra;
  readonly testExpoConstantsWith: (game: Partial<GameExtra>) => {
    readonly default: { readonly expoConfig: object };
  };
};

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
/** The game's own support address (its G3 step); the pilot's is the design's, support@example.com. */
const mockGame = { supportEmail: 'support@example.com' };
jest.mock('expo-constants', () => {
  const { TEST_GAME_EXTRA, testExpoConstantsWith } = jest.requireActual<TestGameExtraModule>(
    '@e07/shell/testing/test-game-extra.ts',
  );
  return {
    __esModule: true,
    default: {
      get expoConfig() {
        const links = { ...TEST_GAME_EXTRA.links, supportEmail: mockGame.supportEmail };
        return testExpoConstantsWith({ links }).default.expoConfig;
      },
    },
  };
});

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

  // The design draws support@example.com; a game's G3 step gives it its own address, which S11b
  // shows to players and the parity capture must not compare against the design.
  it("shows the design's support address in a parity capture and the game's own otherwise", async () => {
    mockGame.supportEmail = 'help@game.example';
    try {
      const shell = createHostWrapper();
      const { result: normal } = await renderHook(() => useAboutModel(), {
        wrapper: shell.wrapper,
      });
      expect(normal.current.emailText).toBe('help@game.example');

      startParitySession({
        frame: 's11b-about-and-credits',
        plan: PARITY_PLANS['s11b-about-and-credits'],
        theme: 'light',
        lang: 'en',
        game: 'scrapShove',
        date: '2026-09-27',
        scrollY: 0,
      });
      const { result: capture } = await renderHook(() => useAboutModel(), {
        wrapper: shell.wrapper,
      });
      expect(capture.current.emailText).toBe('support@example.com');
    } finally {
      endParitySession();
      mockGame.supportEmail = 'support@example.com';
    }
  });
});
