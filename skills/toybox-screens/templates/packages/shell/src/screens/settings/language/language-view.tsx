// packages/shell/src/screens/settings/language/language-view.tsx
import { LANGUAGE_AUTONYMS, LANGUAGES } from '@e07/shell/i18n/languages.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { List } from '@e07/shell/ui/list.tsx';
import { NotePanel } from '@e07/shell/ui/note-panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ReactNode } from 'react';

export type SettingsLanguageModel = {
  /** The saved choice; null = System (follow the phone). */
  readonly selected: Language | null;
  /** What System resolves to now, shown as "System (English)". */
  readonly systemLanguage: Language;
  /** Dispatches set-language; a direction flip opens the S14 restart dialog (language-change.ts). */
  readonly onSelect: (language: Language | null) => void;
  readonly onBack: () => void;
  readonly isReducedMotion: boolean;
};

export type SettingsLanguageViewProps = { readonly model: SettingsLanguageModel };

/**
 * S11a Language: System first (with its description), then the four autonyms, each in its own
 * script and direction (18 Bold), a radio mark on the chosen one, and the right-to-left note.
 */
export function SettingsLanguageView({ model }: SettingsLanguageViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="settings-language.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="settings-language.top-bar"
        title={t('language.title')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody isUnderHomeIndicator>
        <List testID="settings-language.list">
          <ListRow
            testID="settings-language.language-row.system"
            label={t('settings.language.system', {
              languageName: LANGUAGE_AUTONYMS[model.systemLanguage],
            })}
            description={t('language.system.description')}
            end="radio"
            isSelected={model.selected === null}
            onPress={() => {
              model.onSelect(null);
            }}
            isFirst
            isReducedMotion={model.isReducedMotion}
          />
          {LANGUAGES.map((language) => (
            <ListRow
              key={language}
              testID={`settings-language.language-row.${language}`}
              label={LANGUAGE_AUTONYMS[language]}
              labelLanguage={language}
              end="radio"
              isSelected={model.selected === language}
              onPress={() => {
                model.onSelect(language);
              }}
              isReducedMotion={model.isReducedMotion}
            />
          ))}
        </List>
        <NotePanel
          testID="settings-language.direction-note"
          icon="globe"
          text={t('language.direction-note')}
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
