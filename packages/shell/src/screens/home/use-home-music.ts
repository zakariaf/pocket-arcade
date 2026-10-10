// packages/shell/src/screens/home/use-home-music.ts
// Spec S4 and 8.7: a game's background music starts on Home, only while the Music setting is on,
// and switching Music off stops it at once. The hook only drives the audio port: no state, no
// navigation. Home stays mounted under the Game route, so playing never starts a second voice.
import { useEffect } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

export function useHomeMusic(): void {
  const { audio } = useServices();
  // null exactly when the game has no music (GameHost.hasMusic false, Line Siege).
  const { musicSoundId } = useGameHost();
  const isMusicOn = useSettingsStore((state) => state.settings.musicEnabled);
  useEffect(() => {
    if (musicSoundId === null || !isMusicOn) return undefined;
    audio.startMusic(musicSoundId);
    return () => {
      audio.stopMusic();
    };
  }, [audio, musicSoundId, isMusicOn]);
}
