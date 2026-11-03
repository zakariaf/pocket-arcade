// packages/shell/src/screens/settings/privacy/use-privacy-policy-model.test.tsx
import { renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { usePrivacyPolicyModel } from './use-privacy-policy-model.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';

type TestGameExtraModule = {
  readonly TEST_GAME_EXTRA: GameExtra;
  readonly testExpoConstantsWith: (game: Partial<GameExtra>) => {
    readonly default: { readonly expoConfig: object };
  };
};

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
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

  // The design draws support@example.com; a game's G3 step gives it its own address, which S11c
  // shows to players and the parity capture must not compare against the design.
  it("names the design's support address in a parity capture and the game's own otherwise", async () => {
    mockGame.supportEmail = 'help@game.example';
    try {
      const shell = createHostWrapper();
      const { result: normal } = await renderHook(() => usePrivacyPolicyModel(), {
        wrapper: shell.wrapper,
      });
      expect(normal.current.emailText).toBe('help@game.example');

      startParitySession({
        frame: 's11c-privacy-policy',
        plan: PARITY_PLANS['s11c-privacy-policy'],
        theme: 'light',
        lang: 'en',
        game: 'scrapShove',
        date: '2026-09-27',
        scrollY: 0,
      });
      const { result: capture } = await renderHook(() => usePrivacyPolicyModel(), {
        wrapper: shell.wrapper,
      });
      expect(capture.current.emailText).toBe('support@example.com');
    } finally {
      endParitySession();
      mockGame.supportEmail = 'support@example.com';
    }
  });
});
