// packages/shell/src/stores/settings-reducer.test.ts
import fc from 'fast-check';

import { DEFAULT_SETTINGS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import { settingsReducer } from './settings-reducer.ts';

import type { SettingsState } from './settings-reducer.ts';

const FRESH: SettingsState = {
  settings: DEFAULT_SETTINGS,
  firstRun: { languageChosen: false, tutorialDone: false },
};

describe('settingsReducer', () => {
  it('stores the chosen language and marks the choice as made', () => {
    const next = settingsReducer(FRESH, { type: 'set-language', language: 'fa' });
    expect(next.settings.language).toBe('fa');
    expect(next.firstRun.languageChosen).toBe(true);
  });

  it('keeps "System" as a null language', () => {
    const chosen = settingsReducer(FRESH, { type: 'set-language', language: 'de' });
    expect(
      settingsReducer(chosen, { type: 'set-language', language: null }).settings.language,
    ).toBeNull();
  });

  it('sets digits, theme, colour-blind, reduce motion, vibration and hints', () => {
    let state = settingsReducer(FRESH, { type: 'set-digits', digits: 'latin' });
    state = settingsReducer(state, { type: 'set-theme', theme: 'dark' });
    state = settingsReducer(state, { type: 'set-color-blind', enabled: true });
    state = settingsReducer(state, { type: 'set-reduce-motion', reduceMotion: 'on' });
    state = settingsReducer(state, { type: 'set-vibration', enabled: false });
    state = settingsReducer(state, { type: 'set-hints-during-play', enabled: false });
    expect(state.settings).toStrictEqual({
      ...DEFAULT_SETTINGS,
      digits: 'latin',
      theme: 'dark',
      colorBlind: true,
      reduceMotion: 'on',
      vibrationEnabled: false,
      hintsDuringPlay: false,
    });
  });

  it('sets sound and music with their volumes', () => {
    const sound = settingsReducer(FRESH, { type: 'set-sound', enabled: false, volume: 30 });
    const music = settingsReducer(sound, { type: 'set-music', enabled: true, volume: 45 });
    expect(music.settings).toMatchObject({
      soundEnabled: false,
      soundVolume: 30,
      musicEnabled: true,
      musicVolume: 45,
    });
  });

  it('keeps every volume an integer between 0 and 100', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (volume) => {
        const next = settingsReducer(FRESH, { type: 'set-music', enabled: true, volume });
        const stored = next.settings.musicVolume;
        return Number.isInteger(stored) && stored >= 0 && stored <= 100;
      }),
    );
  });

  it('finishes the tutorial idempotently', () => {
    const once = settingsReducer(FRESH, { type: 'finish-tutorial' });
    const twice = settingsReducer(once, { type: 'finish-tutorial' });
    expect(twice).toStrictEqual(once);
    expect(once.firstRun.tutorialDone).toBe(true);
  });

  it('leaves the received state untouched', () => {
    const frozen = Object.freeze({ ...FRESH, settings: Object.freeze({ ...DEFAULT_SETTINGS }) });
    expect(() => settingsReducer(frozen, { type: 'set-theme', theme: 'light' })).not.toThrow();
    expect(frozen.settings.theme).toBe('system');
  });
});
