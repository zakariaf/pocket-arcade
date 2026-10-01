// packages/shell/src/ui/option-card.tsx
import { StyleSheet, View } from 'react-native';

import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { directionOf } from '@e07/shell/i18n/languages.ts';
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
  // The row centres its parts (CSS align-items: center); the sticker is top-aligned on its own.
  badge: { alignSelf: 'center' },
  block: { alignSelf: 'stretch' },
});

/** A raised choice row (S2 languages): pushed in, accent and checked when chosen. */
export function OptionCard(props: OptionCardProps): ReactNode {
  const theme = useTheme();
  const layoutDirection = useDirection();
  // S2 sets each autonym in its own direction: فارسی on an English screen (and English on a
  // Persian one) sits at the end of its row, next to the mark.
  const isOtherDirection =
    props.language !== undefined && directionOf(props.language) !== layoutDirection;
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
          align={isOtherDirection ? 'end' : 'start'}
          testID={`${props.testID}.label`}
          {...(props.language === undefined ? {} : { language: props.language })}
        />
      </View>
      {props.badge === undefined || props.badge === null ? null : (
        <View style={styles.badge}>{props.badge}</View>
      )}
      <RadioMark isSelected={props.isSelected} testID={`${props.testID}.radio`} />
    </RaisedSurface>
  );
}
