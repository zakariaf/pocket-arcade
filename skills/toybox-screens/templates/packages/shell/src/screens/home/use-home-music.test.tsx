// packages/shell/src/screens/home/use-home-music.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { hasMusicOf, musicSoundIdOf } from '@e07/shell/game-host/game-facts.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { useHomeMusic } from './use-home-music.ts';

import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

const mockIsFocused = { current: true };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  useIsFocused: () => mockIsFocused.current,
}));

/** The tally game with one looping music sound in its bank. */
const MUSIC_GAME: typeof TALLY_GAME = {
  ...TALLY_GAME,
  presentation: {
    ...TALLY_GAME.presentation,
    sounds: {
      ...TALLY_GAME.presentation.sounds,
      theme: { category: 'music', recipe: [], isLoop: true },
    },
  },
};

/** The host facts the real createGameHost derives from a module's sound bank. */
function musicFactsOf<T extends ShellGameTypes>(game: ShellGameModule<T>) {
  return { hasMusic: hasMusicOf(game), musicSoundId: musicSoundIdOf(game) };
}

async function renderHomeMusic(game: typeof TALLY_GAME, isMusicOn: boolean) {
  const audio = createFakeAudio();
  const shell = createHostWrapper({
    services: { audio },
    settings: { musicEnabled: isMusicOn },
    host: musicFactsOf(game),
  });
  const view = await renderHook(
    () => {
      useHomeMusic();
    },
    { wrapper: shell.wrapper },
  );
  const music = (): unknown[] => audio.calls.filter((call) => call.kind === 'music');
  const setMusic = async (isOn: boolean): Promise<void> => {
    await act(() => {
      shell.stores.settings.getState().dispatch({ type: 'set-music', enabled: isOn, volume: 60 });
    });
  };
  return { ...view, music, setMusic };
}

describe('useHomeMusic', () => {
  it("starts the game's music once on Home while the Music setting is on (spec S4, 8.7)", async () => {
    const { music } = await renderHomeMusic(MUSIC_GAME, true);

    expect(music()).toStrictEqual([{ kind: 'music', soundId: 'theme' }]);
  });

  it('starts nothing while the Music setting is off', async () => {
    const { music } = await renderHomeMusic(MUSIC_GAME, false);

    expect(music()).toStrictEqual([]);
  });

  it('starts nothing for a game whose sound bank has no music, like Line Siege', async () => {
    const { music, setMusic } = await renderHomeMusic(TALLY_GAME, true);
    await setMusic(false);
    await setMusic(true);

    expect(music()).toStrictEqual([]);
  });

  it('starts the music once when Music is switched on, and stops it at once when off', async () => {
    const { music, setMusic } = await renderHomeMusic(MUSIC_GAME, false);

    await setMusic(true);
    expect(music()).toStrictEqual([{ kind: 'music', soundId: 'theme' }]);

    await setMusic(false);
    expect(music()).toStrictEqual([
      { kind: 'music', soundId: 'theme' },
      { kind: 'music', soundId: null },
    ]);
  });

  it('starts no second voice when the player leaves Home for the Game route and comes back', async () => {
    const { music, rerender } = await renderHomeMusic(MUSIC_GAME, true);

    mockIsFocused.current = false;
    await rerender({});
    mockIsFocused.current = true;
    await rerender({});

    expect(music()).toStrictEqual([{ kind: 'music', soundId: 'theme' }]);
  });
});
