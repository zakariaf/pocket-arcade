// packages/shell/src/screens/pause/use-pause-model.ts
// S6's model hook: the mode line from the paused run's ref (the same text as the top bar), the
// three toggle keys from the settings store (settings-and-preferences' actions, so a key sounds
// and pulses once, like the Settings switch), Music only when useGameHost().hasMusic, Vibration
// only with haptics, Restart level (the S14 dialog once more than a few moves would be lost) and
// How to play (the run stays paused underneath).
import { useNavigation } from '@react-navigation/native';

import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { modeTextOf } from '@e07/shell/game-host/top-bar-model.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { createPreferenceActions } from '@e07/shell/screens/settings/settings-preference-actions.ts';
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';
import { selectDispatch, selectSettings } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { PauseModel, PauseSession } from './pause-model.ts';
import type { RunText } from '@e07/shell/game-host/top-bar-model.ts';

/** Chosen: up to this many moves, Restart level restarts at once; after them it asks first. */
export const RESTART_WITHOUT_ASKING_MOVES = 3;

function useRunText(): RunText {
  const t = useT();
  const digits = useSettingsStore((state) => state.settings.digits);
  const formatNumber = createNumberFormatter(localeTagFor(useLanguage(), digits));
  return { t, formatNumber, gameText: (message) => gameMessageText(t, message) };
}

function useRestart(session: PauseSession): () => void {
  const openDialog = useOpenDialog();
  return () => {
    const { view } = session;
    if (view === null) return;
    const restart = (): void => {
      session.startRun(view.ref);
    };
    if (view.moveCount > RESTART_WITHOUT_ASKING_MOVES)
      openDialog({ kind: 'restart-level', onRestart: restart });
    else restart();
  };
}

export function usePauseModel(session: PauseSession): PauseModel {
  const navigation = useNavigation();
  const services = useServices();
  const settings = useSettingsStore(selectSettings);
  const isReduceMotionOn = useReduceMotion();
  const dispatch = useSettingsStore(selectDispatch);
  const onToggled = (): void => {
    playUiFeedback(services, 'toggle');
  };
  const actions = createPreferenceActions({ settings, isReduceMotionOn, dispatch, onToggled });
  const text = useRunText();
  const { hasMusic } = useGameHost();
  return {
    modeText: session.view === null ? '' : modeTextOf(session.view.ref, text),
    sound: { isOn: settings.soundEnabled, onToggle: actions.onToggleSound },
    music: hasMusic ? { isOn: settings.musicEnabled, onToggle: actions.onToggleMusic } : null,
    vibration: services.haptics.isSupported
      ? { isOn: settings.vibrationEnabled, onToggle: actions.onToggleVibration }
      : null,
    onRestart: useRestart(session),
    onHowToPlay: () => {
      navigation.navigate('HowToPlay');
    },
    isReducedMotion: isReduceMotionOn,
  };
}
