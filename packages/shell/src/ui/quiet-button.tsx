// packages/shell/src/ui/quiet-button.tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { PRESS_SQUASH } from '@e07/shell/theme/motion.ts';
import { MIN_TOUCH, STROKE } from '@e07/shell/theme/tokens.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';
import type { PressableStateCallbackType } from 'react-native';

const SPEC = COMPONENT_SPECS.quietButton;
const GAP = COMPONENT_SPECS.button.gap;
const NUDGE_ICON = 20;
const NUDGE = typeStyleOf('nudge');

/**
 * The design's underline (.quiet: text-decoration-thickness 2px, text-underline-offset 5px) where
 * Chrome draws it: the offset under the rounded ascent, from the top of the text's content box
 * (rounded ascent plus rounded descent, centred in the line). Measured on the S12 and S13
 * references: the 2 pt line starts 19 pt under the content top of Rubik 15. iOS draws its own 1 pt
 * line deeper and RN has no style for either, so the button draws it.
 */
const UNDERLINE_THICKNESS = 2;
const UNDERLINE_OFFSET = 5;
/** hhea ascent and descent per em: Rubik 935 / 250 of 1000, Vazirmatn 2100 / 1100 of 2048. */
const FONT_EM = {
  latin: { ascent: 0.935, descent: 0.25 },
  arabic: { ascent: 2100 / 2048, descent: 1100 / 2048 },
} as const;

export function quietUnderlineTop(fontSize: number, lineHeight: number, isArabic: boolean): number {
  const em = isArabic ? FONT_EM.arabic : FONT_EM.latin;
  const ascent = Math.round(em.ascent * fontSize);
  const content = ascent + Math.round(em.descent * fontSize);
  return (lineHeight - content) / 2 + ascent + UNDERLINE_OFFSET;
}

export type QuietButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly isReducedMotion: boolean;
  readonly icon?: IconName;
  readonly iconEnd?: IconName;
  readonly isDisabled?: boolean;
  readonly hint?: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // The design keeps a transparent 3 pt edge so quiet buttons line up with raised ones:
    // here the edge is folded into the padding. No edge and no shadow, ever.
    face: {
      minHeight: SPEC.minHeight,
      minWidth: MIN_TOUCH,
      paddingBlock: SPEC.paddingBlock + STROKE.bold,
      paddingInline: SPEC.paddingInline + STROKE.bold,
      borderRadius: COMPONENT_SPECS.button.radius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      gap: GAP,
    },
    pressed: { backgroundColor: theme.colors.sunken },
    underline: {
      position: 'absolute',
      start: 0,
      end: 0,
      height: UNDERLINE_THICKNESS,
    },
    squashed: { transform: [{ scale: PRESS_SQUASH.quietButtonScale }] },
  });
  return styles;
});

/** A quiet nudge ("Restore purchase", "Home"): underlined text, pressed = sunken tint, tap feedback. */
export function QuietButton(props: QuietButtonProps): ReactNode {
  const styles = useStyles();
  const theme = useTheme();
  const onPressFeedback = usePressFeedback();
  const isDisabled = props.isDisabled === true;
  const color = isDisabled ? theme.colors.textMuted : theme.colors.icon;
  // The underline is the label's own colour (CSS currentColor).
  const underlineColor = isDisabled ? theme.colors.textMuted : theme.colors.text;
  const text = useLocalizedTextStyle({
    fontSize: NUDGE.fontSize,
    weight: NUDGE.weight,
    face: NUDGE.face,
    lineHeight: NUDGE.lineHeight,
    align: 'center',
  });
  const underlineTop = quietUnderlineTop(
    NUDGE.fontSize,
    text.lineHeight ?? NUDGE.fontSize,
    (text.fontFamily ?? '').startsWith('Vazirmatn'),
  );
  const pressedStyle = (state: PressableStateCallbackType): (object | false)[] => [
    styles.face,
    state.pressed && !isDisabled && styles.pressed,
    state.pressed && !isDisabled && !props.isReducedMotion && styles.squashed,
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        onPressFeedback();
        props.onPress();
      }}
      style={pressedStyle}
      testID={props.testID}
    >
      {props.icon === undefined ? null : <Icon name={props.icon} color={color} size={NUDGE_ICON} />}
      <View>
        <AppText
          text={props.label}
          variant="nudge"
          tone={isDisabled ? 'muted' : 'default'}
          align="center"
        />
        <View
          style={[styles.underline, { top: underlineTop, backgroundColor: underlineColor }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
      {props.iconEnd === undefined ? null : (
        <Icon name={props.iconEnd} color={color} size={NUDGE_ICON} />
      )}
    </Pressable>
  );
}
