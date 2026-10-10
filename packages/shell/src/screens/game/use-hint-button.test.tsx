// packages/shell/src/screens/game/use-hint-button.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import { useHintButton } from './use-hint-button.ts';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { HostWrapperOptions } from '@e07/shell/testing/create-host-wrapper.tsx';

type TestGameExtraModule = {
  readonly testExpoConstantsWith: (game: Partial<GameExtra>) => {
    readonly default: { readonly expoConfig: object };
  };
};

const mockHints = { freePerDay: 1 };
jest.mock('expo-constants', () => {
  const { testExpoConstantsWith } = jest.requireActual<TestGameExtraModule>(
    '@e07/shell/testing/test-game-extra.ts',
  );
  return {
    __esModule: true,
    default: {
      get expoConfig() {
        return testExpoConstantsWith({ hints: mockHints }).default.expoConfig;
      },
    },
  };
});

async function hintButton(freePerDay: number, options: HostWrapperOptions = {}) {
  mockHints.freePerDay = freePerDay;
  const shell = createHostWrapper(options);
  const view = await renderHook(() => useHintButton(), { wrapper: shell.wrapper });
  return { ...view, shell };
}

describe('useHintButton', () => {
  it('gives Premium owners unlimited hints (spec 8.5)', async () => {
    const { result } = await hintButton(1, { isPremium: true });
    expect(result.current.source).toBe('premium');
  });

  it("offers the game's free hint while today's allowance lasts, then a rewarded ad", async () => {
    const { result } = await hintButton(1);
    expect([result.current.source, result.current.freeLeft]).toStrictEqual(['free', 1]);

    await act(() => {
      result.current.spendFreeHint();
    });
    expect([result.current.source, result.current.freeLeft]).toStrictEqual(['ad', 0]);
  });

  it("offers a rewarded ad at once for Line Siege's freePerDay 0", async () => {
    const { result } = await hintButton(0);
    expect([result.current.source, result.current.freeLeft]).toStrictEqual(['ad', 0]);
  });

  it('dispatches nothing while rendering, and one use-free-hint for today when spent', async () => {
    const { result, rerender, shell } = await hintButton(1);
    const dispatched = jest.spyOn(shell.stores.progress.getState(), 'dispatch');
    await rerender({});
    expect(dispatched).not.toHaveBeenCalled();
    const before = shell.save.doc().hints;

    await act(() => {
      result.current.spendFreeHint();
    });
    expect(dispatched.mock.calls).toStrictEqual([
      [{ type: 'use-free-hint', today: TEST_CLOCK.today(), freePerDay: 1 }],
    ]);
    expect(shell.save.doc().hints).not.toStrictEqual(before);
  });
});
