// packages/shell/src/screens/result/result-endless-view.tsx
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { ScorePanel } from '@e07/shell/ui/score-panel.tsx';

import { newBestOf, ResultFrame } from './result-frame.tsx';

import type { EndlessResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultEndlessViewProps = { readonly model: EndlessResult };

/**
 * S7 endless result (Chosen; not drawn): chip, "Run over", the score panel with the best score,
 * then Try again (hero with a restore cap) and a secondary Home.
 */
export function ResultEndlessView({ model }: ResultEndlessViewProps): ReactNode {
  const t = useT();
  const { actions, isReducedMotion } = model;
  const keys = (
    <>
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
    </>
  );
  return (
    <ResultFrame modeText={model.modeText} keys={keys}>
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
        {...newBestOf(model.isNewBest, t)}
        progressLine={t('common.best-score', { bestScore: model.bestScore })}
        isReducedMotion={isReducedMotion}
      />
    </ResultFrame>
  );
}
