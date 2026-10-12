// packages/shell/src/ui/quiet-button.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePressFeedback } from '@e07/shell/app/press-feedback-context.tsx';
import { useDirection } from '@e07/shell/i18n/direction-context.tsx';
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { PRESS_SQUASH } from '@e07/shell/theme/motion.ts';
import { MIN_TOUCH, STROKE } from '@e07/shell/theme/tokens.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText, useTextScale } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Icon } from './icons/icon.tsx';

import type { TextLine } from './app-text.tsx';
import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';
import type { PressableStateCallbackType, ViewStyle } from 'react-native';

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
    // The label may shrink to the column, so a long nudge wraps inside the gutters (a row never
    // wraps a text whose box keeps its full width).
    label: { flexShrink: 1 },
    underline: { position: 'absolute', height: UNDERLINE_THICKNESS },
    squashed: { transform: [{ scale: PRESS_SQUASH.quietButtonScale }] },
  });
  return styles;
});

type UnderlineInput = {
  /** The label's laid-out lines, or null before the first text layout. */
  readonly lines: readonly TextLine[] | null;
  /** The label box's width: iOS reports each line's x from the physical left. */
  readonly boxWidth: number;
  readonly isRtl: boolean;
  /** quietUnderlineTop: the bar's offset under its line's top. */
  readonly top: number;
};

type UnderlineBar = { readonly key: string; readonly style: ViewStyle };

/**
 * One bar under each laid-out line, at that line's own width, as CSS underlines every line; before
 * the first text layout one bar spans the label.
 */
function underlineBarsOf({ lines, boxWidth, isRtl, top }: UnderlineInput): readonly UnderlineBar[] {
  if (lines === null) return [{ key: 'label', style: { start: 0, end: 0, top } }];
  return lines.map((line) => ({
    key: String(line.y),
    style: {
      start: isRtl ? boxWidth - line.x - line.width : line.x,
      width: line.width,
      top: line.y + top,
    },
  }));
}

/** A line list as text: iOS repeats a layout's report, and the same lines need no new render. */
function linesKey(lines: readonly TextLine[]): string {
  return lines
    .map(
      (line) => `${String(line.x)},${String(line.y)},${String(line.width)},${String(line.height)}`,
    )
    .join(';');
}

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
  // iOS draws the label at the text size (up to 200 %): its font and line grow, the bar's 5 pt
  // offset and 2 pt thickness do not (CSS px).
  const scale = useTextScale();
  const underlineTop = quietUnderlineTop(
    NUDGE.fontSize * scale,
    (text.lineHeight ?? NUDGE.fontSize) * scale,
    (text.fontFamily ?? '').startsWith('Vazirmatn'),
  );
  const isRtl = useDirection() === 'rtl';
  const [lines, setLines] = useState<readonly TextLine[] | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const bars = underlineBarsOf({ lines, boxWidth, isRtl, top: underlineTop });
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
      <View
        style={styles.label}
        onLayout={(event) => {
          setBoxWidth(event.nativeEvent.layout.width);
        }}
      >
        <AppText
          text={props.label}
          variant="nudge"
          tone={isDisabled ? 'muted' : 'default'}
          align="center"
          onTextLines={(next) => {
            setLines((previous) =>
              previous !== null && linesKey(previous) === linesKey(next) ? previous : next,
            );
          }}
        />
        {bars.map((bar) => (
          <View
            key={bar.key}
            style={[styles.underline, bar.style, { backgroundColor: underlineColor }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ))}
      </View>
      {props.iconEnd === undefined ? null : (
        <Icon name={props.iconEnd} color={color} size={NUDGE_ICON} />
      )}
    </Pressable>
  );
}
