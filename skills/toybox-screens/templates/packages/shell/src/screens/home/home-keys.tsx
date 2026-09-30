// packages/shell/src/screens/home/home-keys.tsx
import { View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { KeyButton } from '@e07/shell/ui/key-button.tsx';
import { usePairLayout } from '@e07/shell/ui/use-pair-layout.ts';

import type { HomeActions } from './home-model.ts';
import type { ReactNode } from 'react';

export type HomeKeysProps = {
  readonly actions: HomeActions;
  readonly isReducedMotion: boolean;
};

/** S4 home keys: Levels, Statistics, How to play in three columns (gap 10), stacked at 200 % text. */
export function HomeKeys({ actions, isReducedMotion }: HomeKeysProps): ReactNode {
  const t = useT();
  const layout = usePairLayout(10);
  return (
    <View style={layout.row}>
      <View style={layout.item}>
        <KeyButton
          testID="home.levels-button"
          icon="grid"
          label={t('common.levels')}
          onPress={actions.onOpenLevels}
          isReducedMotion={isReducedMotion}
        />
      </View>
      <View style={layout.item}>
        <KeyButton
          testID="home.stats-button"
          icon="stats"
          label={t('common.statistics')}
          onPress={actions.onOpenStats}
          isReducedMotion={isReducedMotion}
        />
      </View>
      <View style={layout.item}>
        <KeyButton
          testID="home.how-to-play-button"
          icon="book"
          label={t('common.how-to-play')}
          onPress={actions.onOpenHowToPlay}
          isReducedMotion={isReducedMotion}
        />
      </View>
    </View>
  );
}
