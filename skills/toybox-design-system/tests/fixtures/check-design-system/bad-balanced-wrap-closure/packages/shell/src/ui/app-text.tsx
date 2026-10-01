// packages/shell/src/ui/app-text.tsx
import { Text, View } from 'react-native';

import { isolate } from '@e07/shell/i18n/bidi.ts';
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { useBalancedWrap } from './use-balanced-wrap.ts';

import type { BalancedWrap } from './use-balanced-wrap.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type {
  LocalizedTextOptions,
  TextAlignToken,
} from '@e07/shell/i18n/use-localized-text-style.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { TypeStyle } from '@e07/shell/theme/tokens.ts';
import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';
import type { ReactNode } from 'react';
import type { TextProps, TextStyle } from 'react-native';

/**
 * default = ink, muted = inkSoft, onPrimary / onPop = text on accent / pop paint,
 * toyInk = printed parts (stickers on gold, accent or pop paper), onInk = white on the ink sticker,
 * toast = text on the inverted toast chip, success / danger = semantic (danger only on surface).
 */
export type TextTone =
  'default' | 'muted' | 'onPrimary' | 'onPop' | 'danger' | 'success' | 'toyInk' | 'onInk' | 'toast';

export type AppTextProps = {
  /** Always the output of t(), a formatter, or an autonym. Never a literal. */
  readonly text: string;
  /** A Toybox type role (display, title, number, heading, body, label, caption) or component style. */
  readonly variant?: TypeVariant;
  readonly tone?: TextTone;
  readonly align?: TextAlignToken;
  /** Only for text in another language than the UI (the language list). */
  readonly language?: Language;
  readonly numberOfLines?: number;
  readonly isHeader?: boolean;
  readonly testID?: string;
  /** Called after each text layout with its line count (NotePanel fits a one-line note to its text). */
  readonly onLineCount?: (lines: number) => void;
};

const UNDERLINE = { textDecorationLine: 'underline' } as const;
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

function toneColor(theme: Theme, tone: TextTone): string {
  const shell = SHELL_COLORS[theme.scheme];
  switch (tone) {
    case 'default':
      return theme.colors.text;
    case 'muted':
      return theme.colors.textMuted;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'onPop':
      return theme.colors.onPop;
    case 'danger':
      return theme.colors.danger;
    case 'success':
      return shell.success;
    case 'toyInk':
      return shell.toyInk;
    case 'onInk':
      // White, the same paint as the die-cut ring: printed parts never change with the scheme.
      return shell.cut;
    case 'toast':
      return shell.toastText;
  }
}

function localizedOptions(style: TypeStyle, props: AppTextProps): LocalizedTextOptions {
  return {
    fontSize: style.fontSize,
    weight: style.weight,
    face: style.face,
    lineHeight: style.lineHeight,
    align: props.align ?? 'start',
    ...(style.letterSpacingEm === undefined ? {} : { letterSpacingEm: style.letterSpacingEm }),
    ...(props.language === undefined ? {} : { language: props.language }),
  };
}

function textProps(props: AppTextProps): TextProps {
  return {
    ...(props.language === undefined ? {} : { accessibilityLanguage: props.language }),
    ...(props.numberOfLines === undefined ? {} : { numberOfLines: props.numberOfLines }),
    ...(props.isHeader === true ? { accessibilityRole: 'header' as const } : {}),
    ...(props.testID === undefined ? {} : { testID: props.testID }),
  };
}

/**
 * Vazirmatn's content box is its rounded hhea ascent plus descent (2100 + 1100 of 2048 per em: 47
 * pt at 30 pt in Chrome's layout), taller than most Toybox Arabic-script lines. Chrome centres the
 * overflow on the line box (half above, half below); iOS puts all of it above the line and clips
 * the Text at its frame. So Persian digits on the tight number lines lost their tops (S10: 17.7
 * pt of ink for 20.7) and every Arabic-script text sat half its overflow higher than the design
 * (S12's 38 pt title: 3 pt). From MIN_SHIFT on, the text gets pads that move the line down by half
 * the overflow and make the frame hold the ink, cancelled by negative margins, inside a wrapper
 * that keeps the design's line box and carries the testID.
 */
const VAZIRMATN_EM = { ascent: 2100 / 2048, descent: 1100 / 2048 } as const;
const MIN_SHIFT = 1.5;

type OverflowGuard = {
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly marginVertical: number;
};

/** Chrome's content box of a Vazirmatn line: the rounded ascent plus the rounded descent. */
export function vazirmatnContentHeight(fontSize: number): number {
  return Math.round(VAZIRMATN_EM.ascent * fontSize) + Math.round(VAZIRMATN_EM.descent * fontSize);
}

function overflowGuardOf(style: TextStyle): OverflowGuard | null {
  const size = style.fontSize ?? 0;
  const line = style.lineHeight ?? 0;
  const isArabicFace = (style.fontFamily ?? '').startsWith('Vazirmatn');
  if (!isArabicFace || size === 0) return null;
  const half = (vazirmatnContentHeight(size) - line) / 2;
  if (half < MIN_SHIFT) return null;
  const margin = Math.ceil(half);
  return { paddingTop: margin + half, paddingBottom: margin - half, marginVertical: -margin };
}

function layoutProps(balance: BalancedWrap, onLineCount?: (lines: number) => void): TextProps {
  const onTextLayout: TextProps['onTextLayout'] =
    onLineCount === undefined
      ? balance.onTextLayout
      : (event) => {
          balance.onTextLayout?.(event);
          onLineCount(event.nativeEvent.lines.length);
        };
  return {
    ...(balance.onLayout === undefined ? {} : { onLayout: balance.onLayout }),
    ...(onTextLayout === undefined ? {} : { onTextLayout }),
  };
}

/** The only component that renders text: role or style, script font, direction, 200% cap. */
export function AppText(props: AppTextProps): ReactNode {
  const theme = useTheme();
  const style = typeStyleOf(props.variant ?? 'body');
  const localized = useLocalizedTextStyle(localizedOptions(style, props));
  // Display text wraps balanced, as the design's .d (text-wrap: balance).
  const balance = useBalancedWrap(style.face === 'display', props.text, props.align ?? 'start');
  const decoration = style.isUnderlined === true ? UNDERLINE : null;
  const figures = style.isTabular === true ? TABULAR : null;
  // Game names are Latin brand names: isolate them so an RTL sentence cannot reorder them.
  const shown = style.face === 'brand' ? isolate(props.text) : props.text;
  const guard = overflowGuardOf(localized);
  const color = { color: toneColor(theme, props.tone ?? 'default') };
  const { testID, ...rest } = props;
  const text = (
    <Text
      style={[localized, decoration, figures, color, balance.style, guard]}
      maxFontSizeMultiplier={2}
      {...textProps(guard === null ? props : rest)}
      {...layoutProps(balance, props.onLineCount)}
    >
      {shown}
    </Text>
  );
  if (guard === null) return text;
  return <View {...(testID === undefined ? {} : { testID })}>{text}</View>;
}
