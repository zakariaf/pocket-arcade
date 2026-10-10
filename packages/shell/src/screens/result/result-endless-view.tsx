// packages/shell/src/screens/result/result-endless-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { ScorePanel } from '@e07/shell/ui/score-panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';

import type { EndlessResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultEndlessViewProps = { readonly model: EndlessResult };

// Chip and Sticker align themselves to the start (alignSelf): only a centred row centres them.
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  grow: { flexGrow: 1 },
});

/**
 * S7 endless result (Chosen; not drawn): chip, "Run over", the score panel with the best score,
 * then Try again (hero with a restore cap) and a secondary Home.
 */
export function ResultEndlessView({ model }: ResultEndlessViewProps): ReactNode {
  const t = useT();
  const { actions, isReducedMotion } = model;
  return (
    <ScreenFrame testID="result.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      {/* Under the home indicator, ending with 34 pt: room for the last key's hard shadow. */}
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.chip}>
          <Chip testID="result.mode-chip" text={model.modeText} />
        </View>
        <AppText
          text={t('result.endless.title')}
          variant="display"
          align="center"
          isHeader
          testID="result.endless-title"
        />
        <ScorePanel
          testIDBase="result.score-card"
          label={t('common.score')}
          value={model.scoreText}
          {...(model.isNewBest ? { newBestText: t('result.win.new-best') } : {})}
          progressLine={t('common.best-score', { bestScore: model.bestScore })}
          isReducedMotion={isReducedMotion}
        />
        <View style={styles.grow} />
        <Button
          testID="result.try-again-button"
          label={t('common.try-again')}
          onPress={actions.onTryAgain}
          kind="primary"
          size="hero"
          cap="restore"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="result.home-button"
          label={t('common.home')}
          onPress={actions.onHome}
          icon="home"
          isBlock
          isReducedMotion={isReducedMotion}
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
