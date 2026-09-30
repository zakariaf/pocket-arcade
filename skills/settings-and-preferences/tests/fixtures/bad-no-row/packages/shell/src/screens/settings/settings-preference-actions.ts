// packages/shell/src/screens/settings/settings-preference-actions.ts
// Pure: the handlers of every S11 row that changes a preference. Each one dispatches exactly
// one settings action; the store persists it before the screen sees it (no Save button).
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';

export type PreferenceInput = {
  readonly settings: SaveSettings;
  /** What the Reduce motion toggle shows: the explicit choice, or the phone's switch. */
  readonly isReduceMotionOn: boolean;
  readonly dispatch: (action: SettingsAction) => void;
};

export type SoundActions = {
  readonly onToggleSound: () => void;
  readonly onChangeSoundVolume: (volume: number) => void;
  readonly onToggleMusic: () => void;
  readonly onChangeMusicVolume: (volume: number) => void;
  readonly onToggleVibration: () => void;
};

export type DisplayActions = {
  readonly onSelectDigits: (digits: SaveSettings['digits']) => void;
  readonly onSelectTheme: (theme: SaveSettings['theme']) => void;
  readonly onToggleColorBlind: () => void;
  readonly onToggleReduceMotion: () => void;
  readonly onToggleHints: () => void;
};

export type PreferenceActions = SoundActions & DisplayActions;

/** Toggles keep the volume; sliders keep the on/off state. Volumes are integer percent. */
function createSoundActions({ settings, dispatch }: PreferenceInput): SoundActions {
  const { soundEnabled: isSoundOn, soundVolume, musicEnabled: isMusicOn, musicVolume } = settings;
  return {
    onToggleSound: () => {
      dispatch({ type: 'set-sound', enabled: !isSoundOn, volume: soundVolume });
    },
    onChangeSoundVolume: (volume) => {
      dispatch({ type: 'set-sound', enabled: isSoundOn, volume });
    },
    onToggleMusic: () => {
      dispatch({ type: 'set-music', enabled: !isMusicOn, volume: musicVolume });
    },
    onChangeMusicVolume: (volume) => {
      dispatch({ type: 'set-music', enabled: isMusicOn, volume });
    },
    onToggleVibration: () => {
      dispatch({ type: 'set-vibration', enabled: !settings.vibrationEnabled });
    },
  };
}

/** Reduce motion is stored as 'system' | 'on' | 'off'; the toggle writes the opposite of what it shows. */
function createDisplayActions(input: PreferenceInput): DisplayActions {
  const { settings, isReduceMotionOn, dispatch } = input;
  return {
    onSelectDigits: (digits) => {
      dispatch({ type: 'set-digits', digits });
    },
    onSelectTheme: (theme) => {
      dispatch({ type: 'set-theme', theme });
    },
    onToggleColorBlind: () => {
      dispatch({ type: 'set-color-blind', enabled: !settings.colorBlind });
    },
    onToggleReduceMotion: () => {
      dispatch({ type: 'set-reduce-motion', reduceMotion: isReduceMotionOn ? 'off' : 'on' });
    },
    onToggleHints: () => {
      dispatch({ type: 'set-color-blind', enabled: !settings.hintsDuringPlay });
    },
  };
}

export function createPreferenceActions(input: PreferenceInput): PreferenceActions {
  return { ...createSoundActions(input), ...createDisplayActions(input) };
}
