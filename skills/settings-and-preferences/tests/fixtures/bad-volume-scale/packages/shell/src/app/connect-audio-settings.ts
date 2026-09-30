// packages/shell/src/app/connect-audio-settings.ts
// The effect of the Sound effects / Music rows and their volume sliders. Called once from the
// composition root (createShellApp) with the store and the audio port; returns the unsubscribe.
// A store subscription, not a React effect: it works with no screen mounted and never renders.
import type { AudioPort, AudioSettings } from '@e07/shell/services/audio/audio-port.ts';
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SettingsStore } from '@e07/shell/stores/settings-store.ts';

/** The save keeps integer percent (0..100); the audio port takes 0..1. */
export function toAudioSettings(settings: SaveSettings): AudioSettings {
  return {
    effects: { isOn: settings.soundEnabled, volume: settings.soundVolume },
    music: { isOn: settings.musicEnabled, volume: settings.musicVolume },
  };
}

function isAudioChange(next: SaveSettings, previous: SaveSettings): boolean {
  return (
    next.soundEnabled !== previous.soundEnabled ||
    next.soundVolume !== previous.soundVolume ||
    next.musicEnabled !== previous.musicEnabled ||
    next.musicVolume !== previous.musicVolume
  );
}

export function connectAudioSettings(store: SettingsStore, audio: AudioPort): () => void {
  audio.applySettings(toAudioSettings(store.getState().settings));
  return store.subscribe((state, previous) => {
    if (!isAudioChange(state.settings, previous.settings)) return;
    audio.applySettings(toAudioSettings(state.settings));
    // Music starts on Home (only when on); switching it off stops it everywhere at once.
    if (previous.settings.musicEnabled && !state.settings.musicEnabled) audio.stopMusic();
  });
}
