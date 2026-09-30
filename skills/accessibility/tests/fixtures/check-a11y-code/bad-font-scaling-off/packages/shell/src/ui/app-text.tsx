// packages/shell/src/ui/app-text.tsx
import { Text } from 'react-native';

import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { TYPE_SCALE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { TextAlignToken } from '@e07/shell/i18n/use-localized-text-style.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { TypeRole } from '@e07/shell/theme/tokens.ts';
import type { ReactNode } from 'react';

export type TextTone = 'default' | 'muted' | 'onPrimary' | 'danger';

export type AppTextProps = {
  /** Always the output of t(), a formatter, or an autonym. Never a literal. */
  readonly text: string;
  readonly variant?: TypeRole;
  readonly tone?: TextTone;
  readonly align?: TextAlignToken;
  /** Only for text in another language than the UI (the language list, doc 10). */
  readonly language?: Language;
  readonly numberOfLines?: number;
  readonly isHeader?: boolean;
  readonly testID?: string;
};

function toneColor(theme: Theme, tone: TextTone): string {
  switch (tone) {
    case 'default':
      return theme.colors.text;
    case 'muted':
      return theme.colors.textMuted;
    case 'onPrimary':
      return theme.colors.onPrimary;
    case 'danger':
      return theme.colors.danger;
  }
}

/** The only component that renders text. Direction, alignment, font and line height: doc 10. */
export function AppText(props: AppTextProps): ReactNode {
  const { text, variant = 'body', tone = 'default', align = 'start', language } = props;
  const theme = useTheme();
  const { fontSize, weight } = TYPE_SCALE[variant];
  const localized = useLocalizedTextStyle({
    fontSize,
    weight,
    align,
    ...(language === undefined ? {} : { language }),
  });
  return (
    <Text
      style={[localized, { color: toneColor(theme, tone) }]}
      maxFontSizeMultiplier={2}
      allowFontScaling={false}
      {...(language === undefined ? {} : { accessibilityLanguage: language })}
      {...(props.numberOfLines === undefined ? {} : { numberOfLines: props.numberOfLines })}
      {...(props.isHeader === true ? { accessibilityRole: 'header' as const } : {})}
      {...(props.testID === undefined ? {} : { testID: props.testID })}
    >
      {text}
    </Text>
  );
}
