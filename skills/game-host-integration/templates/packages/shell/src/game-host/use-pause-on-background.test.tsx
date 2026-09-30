// packages/shell/src/game-host/use-pause-on-background.test.tsx
// no-shell-context: the hook takes the run status and the pause callback as arguments.
import { renderHook } from '@testing-library/react-native';

import { shouldPauseRun, usePauseOnBackground } from './use-pause-on-background.ts';

import type { SessionStatus } from './game-session-types.ts';

/** What AppState and React Navigation report (jest.mock factories may only read `mock*`). */
const mockScreen = { isAppActive: true, isFocused: true };
jest.mock('@e07/shell/app/use-is-app-active.ts', () => ({
  useIsAppActive: () => mockScreen.isAppActive,
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockScreen.isFocused }));

type Props = { readonly status: SessionStatus };

async function mountPlaying(pause: () => void): Promise<(props: Props) => Promise<void>> {
  const { rerender } = await renderHook(
    ({ status }: Props) => {
      usePauseOnBackground(status, pause);
    },
    { initialProps: { status: 'playing' } },
  );
  return async (props) => {
    await rerender(props);
  };
}

describe('shouldPauseRun', () => {
  it('pauses a playing run only at the moment it goes away', () => {
    expect(shouldPauseRun({ status: 'playing', wasAway: false, isAway: true })).toBe(true);
    expect(shouldPauseRun({ status: 'playing', wasAway: true, isAway: true })).toBe(false);
    expect(shouldPauseRun({ status: 'playing', wasAway: true, isAway: false })).toBe(false);
    expect(shouldPauseRun({ status: 'won', wasAway: false, isAway: true })).toBe(false);
  });
});

describe('usePauseOnBackground', () => {
  beforeEach(() => {
    mockScreen.isAppActive = true;
    mockScreen.isFocused = true;
  });

  it('pauses a playing run once when the app goes to the background', async () => {
    const pause = jest.fn();
    const rerender = await mountPlaying(pause);
    expect(pause).not.toHaveBeenCalled();
    mockScreen.isAppActive = false;
    await rerender({ status: 'playing' });
    await rerender({ status: 'paused' });
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('pauses the run when the Game screen loses focus', async () => {
    const pause = jest.fn();
    const rerender = await mountPlaying(pause);
    mockScreen.isFocused = false;
    await rerender({ status: 'playing' });
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('leaves a run alone in the state it opened in, and never pauses a finished run', async () => {
    mockScreen.isAppActive = false;
    const pause = jest.fn();
    const rerender = await mountPlaying(pause);
    mockScreen.isAppActive = true;
    await rerender({ status: 'won' });
    mockScreen.isAppActive = false;
    await rerender({ status: 'won' });
    expect(pause).not.toHaveBeenCalled();
  });
});
