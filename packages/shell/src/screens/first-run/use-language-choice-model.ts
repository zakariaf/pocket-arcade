// packages/shell/src/screens/first-run/use-language-choice-model.ts
// S2's model hook. The phone's languages come from the composition root (useDeviceLocales);
// tapping a row only previews it (Continue reads in that language); Continue saves the language
// and firstRun.languageChosen in one set-language action, and when the chosen language reads the
// other way it restarts in the new direction (the Continue tap is the one tap). The FirstRun
// group then opens the tutorial by itself: this hook never navigates.
import { useState } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useDirectionRestart } from '@e07/shell/app/use-direction-restart.ts';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { createLanguageT } from '@e07/shell/i18n/create-language-t.ts';
import { useDeviceLocales } from '@e07/shell/i18n/device-locales-context.tsx';
import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { phoneLanguageOf } from '@e07/shell/i18n/resolve-language.ts';
import { selectDigits, selectDispatch } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { LanguageChoiceModel } from './language-choice-view.tsx';
import type { Language } from '@e07/shell/i18n/languages.ts';

export function useLanguageChoiceModel(): LanguageChoiceModel {
  const phoneLanguage = phoneLanguageOf(useDeviceLocales());
  const [selected, setSelected] = useState<Language>(phoneLanguage ?? 'en');
  const digits = useSettingsStore(selectDigits);
  const dispatch = useSettingsStore(selectDispatch);
  const restart = useDirectionRestart();
  const { errorLog } = useServices();
  return {
    selected,
    phoneLanguage,
    tSelected: createLanguageT(selected, digits, (error) => {
      errorLog.record('i18n', error);
    }),
    isReducedMotion: useReduceMotion(),
    onSelect: setSelected,
    onContinue: () => {
      dispatch({ type: 'set-language', language: selected });
      const direction = directionOf(selected);
      if (direction !== readLayoutDirection()) restart(direction);
    },
  };
}
