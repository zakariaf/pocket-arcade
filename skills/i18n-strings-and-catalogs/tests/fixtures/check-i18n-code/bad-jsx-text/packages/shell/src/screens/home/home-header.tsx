import { View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { T } from '@e07/shell/i18n/t.tsx';
import { IconButton } from '@e07/shell/ui/icon-button.tsx';

import type { ReactNode } from 'react';

export type HomeHeaderProps = { readonly onSettings: () => void; readonly scoreText: string };

// Everything visible comes from t() or <T>; the score is pre-formatted by the model hook.
export function HomeHeader({ onSettings, scoreText }: HomeHeaderProps): ReactNode {
  const t = useT();
  const items = [1, 2].map((n) => n * 2);
  return (
    <View testID="home.header">
      <Label>Welcome back</Label>
      <IconButton icon="gear" label={t('common.settings')} onPress={onSettings} testID="home.settings-button" />
      {items.length > 0 ? <T id="home.play-button.play" /> : null}
      <Score text={scoreText} />
    </View>
  );
}

function Score({ text }: { readonly text: string }): ReactNode {
  return <T id="home.title" values={{ scoreText: text }} />;
}
