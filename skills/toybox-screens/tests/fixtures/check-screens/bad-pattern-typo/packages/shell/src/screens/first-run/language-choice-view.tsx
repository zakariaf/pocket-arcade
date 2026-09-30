// packages/shell/src/screens/first-run/language-choice-view.tsx
import { StyleSheet, View } from 'react-native';

import { LANGUAGE_AUTONYMS, LANGUAGES } from '@e07/shell/i18n/languages.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ArtTile } from '@e07/shell/ui/art-tile.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { OptionCard } from '@e07/shell/ui/option-card.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ReactNode } from 'react';

export type LanguageChoiceModel = {
  /** Pre-selected: the phone's language when it is one of the four, else English. */
  readonly selected: Language;
  /** The phone's own language, which carries the "Phone language" sticker; null if not one of the four. */
  readonly phoneLanguage: Language | null;
  /** t() in the selected language: spec S2 shows Continue in the language being chosen. */
  readonly tSelected: TFunction;
  readonly isReducedMotion: boolean;
  readonly onSelect: (language: Language) => void;
  /** Dispatches set-language; the FirstRun group then opens the tutorial (never navigate). */
  readonly onContinue: () => void;
};

export type LanguageChoiceViewProps = { readonly model: LanguageChoiceModel };

const styles = StyleSheet.create({
  header: { gap: 10, paddingTop: 18, alignItems: 'flex-start' },
  options: { gap: 12, marginTop: 10 },
  grow: { flexGrow: 1 },
});

/** S2 first-run language choice: four autonyms, each in its own script; one hero Continue. */
export function LanguageChoiceView({ model }: LanguageChoiceViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="language-choice.screen">
      <ScreenBody>
        <View style={styles.header}>
          <ArtTile testID="language-choice.art" icon="globe" paint="pop" />
          <AppText
            text={t('language-choice.title')}
            variant="title"
            isHeader
            testID="language-choice.title"
          />
          <AppText
            text={t('language-choice.subtitle')}
            tone="muted"
            testID="language-choice.subtitle"
          />
        </View>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {LANGUAGES.map((language) => (
            <OptionCard
              key={language}
              testID={`language-choice.langauge-row.${language}`}
              label={LANGUAGE_AUTONYMS[language]}
              language={language}
              isSelected={language === model.selected}
              onSelect={() => {
                model.onSelect(language);
              }}
              isReducedMotion={model.isReducedMotion}
              badge={
                language === model.phoneLanguage ? (
                  <Sticker
                    testID="language-choice.phone-badge"
                    text={t('language-choice.phone-badge')}
                    size="sm"
                    tiltDeg={3}
                  />
                ) : null
              }
            />
          ))}
        </View>
        <View style={styles.grow} />
        <Button
          testID="language-choice.continue-button"
          label={model.tSelected('language-choice.continue-button')}
          onPress={model.onContinue}
          kind="primary"
          size="hero"
          iconEnd="forward"
          isBlock
          isReducedMotion={model.isReducedMotion}
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
