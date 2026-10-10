// packages/shell/src/screens/settings/language/use-settings-language-model.ts
// S11a's model hook. A row saves the language at once (the text switches with the store);
// planLanguageChange and restartDirectionOf (settings-and-preferences, the rule S2 shares) say
// when the layout direction flips, and then
// the S14 "Restart to apply" dialog opens: Restart disposes audio and reloads in the new
// direction, Later keeps the old layout until the next launch. A parity capture of
// s14-restart-to-apply (test builds) opens the same dialog over S11a, with no language saved.
// System resolves against the phone's languages the composition root read (useDeviceLocales).
import { useNavigation } from '@react-navigation/native';

import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { useDirectionRestart } from '@e07/shell/app/use-direction-restart.ts';
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useDeviceLocales } from '@e07/shell/i18n/device-locales-context.tsx';
import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { selectDispatch, selectLanguage } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { planLanguageChange, restartDirectionOf } from './language-change.ts';

import type { SettingsLanguageModel } from './language-view.tsx';
import type { Direction } from '@e07/shell/i18n/languages.ts';

/** Opens "Restart to apply" for a move to `direction` (Restart reloads the layout that way). */
function useRestartDialog(): (direction: Direction) => void {
  const openDialog = useOpenDialog();
  const restart = useDirectionRestart();
  const openRestart = (direction: Direction): void => {
    openDialog({
      kind: 'restart-to-apply',
      onRestart: () => {
        restart(direction);
      },
    });
  };
  useParityOpener('restart-dialog', () => {
    openRestart(readLayoutDirection() === 'rtl' ? 'ltr' : 'rtl');
  });
  return openRestart;
}

export function useSettingsLanguageModel(): SettingsLanguageModel {
  const navigation = useNavigation();
  const selected = useSettingsStore(selectLanguage);
  const dispatch = useSettingsStore(selectDispatch);
  const openRestart = useRestartDialog();
  const deviceLocales = useDeviceLocales();
  return {
    selected,
    systemLanguage: resolveLanguage(null, deviceLocales),
    onSelect: (next) => {
      const change = planLanguageChange({
        next,
        deviceLocales,
        layoutDirection: readLayoutDirection(),
      });
      dispatch(change.action);
      const direction = restartDirectionOf(change);
      if (direction !== null) openRestart(direction);
    },
    onBack: () => {
      navigation.goBack();
    },
    isReducedMotion: useReduceMotion(),
  };
}
