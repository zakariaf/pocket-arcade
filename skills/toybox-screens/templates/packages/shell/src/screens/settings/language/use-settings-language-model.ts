// packages/shell/src/screens/settings/language/use-settings-language-model.ts
// S11a's model hook. A row saves the language at once (the text switches with the store);
// planLanguageChange (settings-and-preferences) says when the layout direction flips, and then
// the S14 "Restart to apply" dialog opens: Restart disposes audio and reloads in the new
// direction, Later keeps the old layout until the next launch. A parity capture of
// s14-restart-to-apply (test builds) opens the same dialog over S11a, with no language saved.
import { useNavigation } from '@react-navigation/native';
import { getLocales } from 'expo-localization';
import { useState } from 'react';

import { useOpenDialog } from '@e07/shell/app/dialog-context.tsx';
import { useDirectionRestart } from '@e07/shell/app/use-direction-restart.ts';
import { useParityOpener } from '@e07/shell/app/use-parity-opener.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { selectDispatch, selectLanguage } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { planLanguageChange } from './language-change.ts';

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
  const [deviceLocales] = useState(() => getLocales());
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
      if (change.needsRestart) openRestart(directionOf(change.resolved));
    },
    onBack: () => {
      navigation.goBack();
    },
    isReducedMotion: useReduceMotion(),
  };
}
