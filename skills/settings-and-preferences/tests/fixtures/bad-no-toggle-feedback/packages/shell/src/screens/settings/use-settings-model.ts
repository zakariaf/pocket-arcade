// packages/shell/src/screens/settings/use-settings-model.ts
// The S11 screen's data: current values, visible rows, display strings the rows need, and the
// preference handlers. The Settings screen (layout and testIDs) renders exactly this.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { LANGUAGE_AUTONYMS } from '@e07/shell/i18n/languages.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectDispatch, selectSettings } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { createPreferenceActions } from './settings-preference-actions.ts';
import { settingsGroupsFor } from './settings-rows.ts';

import type { PreferenceActions } from './settings-preference-actions.ts';
import type { SettingsContext, SettingsGroup } from './settings-rows.ts';
import type { DigitStyle } from '@e07/shell/i18n/digits.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

export type SettingsModel = {
  readonly settings: SaveSettings;
  /** What the Reduce motion toggle shows (the explicit choice, or the phone's switch). */
  readonly isReduceMotionOn: boolean;
  readonly groups: readonly SettingsGroup[];
  /** Language row value: "System (English)" while following the phone, else the autonym. */
  readonly languageValue: string;
  /** Numbers row previews: 123 formatted with each digit style in the current language. */
  readonly digitPreviews: Readonly<Record<DigitStyle, string>>;
  readonly actions: PreferenceActions;
};

const PREVIEW_NUMBER = 123;

function previewsFor(language: Language): Readonly<Record<DigitStyle, string>> {
  const preview = (style: DigitStyle): string =>
    createNumberFormatter(localeTagFor(language, style))(PREVIEW_NUMBER);
  return { automatic: preview('automatic'), latin: preview('latin'), local: preview('local') };
}

export function useSettingsModel(context: SettingsContext): SettingsModel {
  const t = useT();
  const language = useLanguage();
  const settings = useSettingsStore(selectSettings);
  const dispatch = useSettingsStore(selectDispatch);
  const isReduceMotionOn = useReduceMotion();
  const services = useServices();
  const languageValue =
    settings.language === null
      ? t('settings.language.system', { languageName: LANGUAGE_AUTONYMS[language] })
      : LANGUAGE_AUTONYMS[settings.language];
  return {
    settings,
    isReduceMotionOn,
    groups: settingsGroupsFor(context),
    languageValue,
    digitPreviews: previewsFor(language),
    actions: createPreferenceActions({
      settings,
      isReduceMotionOn,
      dispatch,
      // Every switch row (and Pause's toggle keys) plays ui.toggle with the selection pulse.
      onToggled: () => {
        services.audio.play('ui.toggle');
      },
    }),
  };
}
