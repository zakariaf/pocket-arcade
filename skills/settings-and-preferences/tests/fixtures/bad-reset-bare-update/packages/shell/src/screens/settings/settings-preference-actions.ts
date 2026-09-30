// packages/shell/src/screens/settings/settings-preference-actions.ts
// Pure: the handlers of every S11 row that changes a preference. Each one dispatches exactly
// one settings action; the store persists it before the screen sees it (no Save button). A
// switch then plays the toggle feedback (after the dispatch, so "Sound off" is already silent).
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';

export type PreferenceInput = {
  readonly settings: SaveSettings;
  /** What the Reduce motion toggle shows: the explicit choice, or the phone's switch. */
  readonly isReduceMotionOn: boolean;
  readonly dispatch: (action: SettingsAction) => void;
  /** Runs after every switch flip: use-settings-model passes () => { playUiFeedback(services, 'toggle'); }. */
  readonly onToggled: () => void;
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
function createSoundActions({ settings, dispatch, onToggled }: PreferenceInput): SoundActions {
  const { soundEnabled: isSoundOn, soundVolume, musicEnabled: isMusicOn, musicVolume } = settings;
  const flip = (action: SettingsAction): void => {
    dispatch(action);
    onToggled();
  };
  return {
    onToggleSound: () => {
      flip({ type: 'set-sound', enabled: !isSoundOn, volume: soundVolume });
    },
    onChangeSoundVolume: (volume) => {
      dispatch({ type: 'set-sound', enabled: isSoundOn, volume });
    },
    onToggleMusic: () => {
      flip({ type: 'set-music', enabled: !isMusicOn, volume: musicVolume });
    },
    onChangeMusicVolume: (volume) => {
      dispatch({ type: 'set-music', enabled: isMusicOn, volume });
    },
    onToggleVibration: () => {
      flip({ type: 'set-vibration', enabled: !settings.vibrationEnabled });
    },
  };
}

/** Reduce motion is stored as 'system' | 'on' | 'off'; the toggle writes the opposite of what it shows. */
function createDisplayActions(input: PreferenceInput): DisplayActions {
  const { settings, isReduceMotionOn, dispatch, onToggled } = input;
  const flip = (action: SettingsAction): void => {
    dispatch(action);
    onToggled();
  };
  return {
    // Segments are RaisedSurface keys: their press already plays the tap feedback.
    onSelectDigits: (digits) => {
      dispatch({ type: 'set-digits', digits });
    },
    onSelectTheme: (theme) => {
      dispatch({ type: 'set-theme', theme });
    },
    onToggleColorBlind: () => {
      flip({ type: 'set-color-blind', enabled: !settings.colorBlind });
    },
    onToggleReduceMotion: () => {
      flip({ type: 'set-reduce-motion', reduceMotion: isReduceMotionOn ? 'off' : 'on' });
    },
    onToggleHints: () => {
      flip({ type: 'set-hints-during-play', enabled: !settings.hintsDuringPlay });
    },
  };
}

export function createPreferenceActions(input: PreferenceInput): PreferenceActions {
  return { ...createSoundActions(input), ...createDisplayActions(input) };
}
