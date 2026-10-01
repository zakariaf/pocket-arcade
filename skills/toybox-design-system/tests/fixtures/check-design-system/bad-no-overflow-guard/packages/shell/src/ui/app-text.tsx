// packages/shell/src/ui/app-text.tsx
import { Text } from 'react-native';

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
  const color = { color: toneColor(theme, props.tone ?? 'default') };
  const text = (
    <Text
      style={[localized, decoration, figures, color, balance.style]}
      maxFontSizeMultiplier={2}
      {...textProps(props)}
      {...layoutProps(balance, props.onLineCount)}
    >
      {shown}
    </Text>
  );
  return text;
}
