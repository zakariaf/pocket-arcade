// packages/shell/src/ui/option-card.tsx
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { RadioMark } from './radio-mark.tsx';
import { RaisedSurface } from './raised-surface.tsx';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ReactNode } from 'react';

const CARD = COMPONENT_SPECS.optionCard;

export type OptionCardProps = {
  /** The option's name; for languages the autonym ("Deutsch", "فارسی"). */
  readonly label: string;
  /** The label's own language, so it gets its own script font and direction. */
  readonly language?: Language;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  /** Optional sticker after the label (the small "Phone language" sticker, tilt +3). */
  readonly badge?: ReactNode;
};

const styles = StyleSheet.create({
  face: {
    minHeight: CARD.minHeight,
    paddingBlock: CARD.paddingBlock,
    paddingInline: CARD.paddingInline,
    gap: CARD.gap,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  label: { flex: 1 },
  block: { alignSelf: 'stretch' },
});

/** A raised choice row (S2 languages): pushed in, accent and checked when chosen. */
export function OptionCard(props: OptionCardProps): ReactNode {
  const theme = useTheme();
  return (
    <RaisedSurface
      label={props.label}
      onPress={props.onSelect}
      testID={props.testID}
      accessibilityRole="radio"
      isSelected={props.isSelected}
      isPushedIn={props.isSelected}
      elevation={CARD.elevation}
      radius={CARD.radius}
      fill={props.isSelected ? theme.colors.primary : theme.colors.surface}
      isReducedMotion={props.isReducedMotion}
      faceStyle={styles.face}
      layoutStyle={styles.block}
    >
      <View style={styles.label}>
        <AppText
          text={props.label}
          variant="optionNameChoice"
          tone={props.isSelected ? 'onPrimary' : 'default'}
          testID={`${props.testID}.label`}
          {...(props.language === undefined ? {} : { language: props.language })}
        />
      </View>
      {props.badge}
      <RadioMark isSelected={props.isSelected} testID={`${props.testID}.radio`} />
    </RaisedSurface>
  );
}
