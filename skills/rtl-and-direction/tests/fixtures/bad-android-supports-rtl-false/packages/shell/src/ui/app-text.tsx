import { Text } from 'react-native';

import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';

import type { ReactNode } from 'react';

export function AppText({ text }: { readonly text: string }): ReactNode {
  const style = useLocalizedTextStyle({ fontSize: 17, weight: 'regular', align: 'start' });
  return <Text style={style} maxFontSizeMultiplier={2}>{text}</Text>;
}
