// packages/shell/src/screens/result/result-daily-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { ScorePanel } from '@e07/shell/ui/score-panel.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import { newBestOf, ResultFrame } from './result-frame.tsx';

import type { DailyResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultDailyViewProps = { readonly model: DailyResult };

// Sticker aligns itself to the start (alignSelf): only a centred row centres it.
const styles = StyleSheet.create({
  centred: { flexDirection: 'row', justifyContent: 'center' },
});

/**
 * S7 daily result (Chosen; the design draws no frame): the win layout without stars, with the
 * streak sticker in the sub-sticker place, "come back tomorrow" and a hero Home key.
 */
export function ResultDailyView({ model }: ResultDailyViewProps): ReactNode {
  const t = useT();
  const keys = (
    <Button
      testID="result.home-button"
      label={t('common.home')}
      onPress={model.actions.onHome}
      kind="primary"
      size="hero"
      cap="home"
      isBlock
      isReducedMotion={model.isReducedMotion}
    />
  );
  return (
    <ResultFrame modeText={model.modeText} keys={keys}>
      <AppText
        text={t('result.daily.title')}
        variant="display"
        align="center"
        isHeader
        testID="result.daily-title"
      />
      <View style={styles.centred}>
        <Sticker
          testID="result.streak-sticker"
          text={t('daily.streak.count', { daysCount: model.streakDays })}
          icon="chain"
          tiltDeg={-3}
          isReducedMotion={model.isReducedMotion}
        />
      </View>
      <ScorePanel
        testIDBase="result.score-card"
        label={t('common.score')}
        value={model.scoreText}
        {...newBestOf(model.isNewBest, t)}
        progressLine={model.progressText}
        isReducedMotion={model.isReducedMotion}
      />
      <AppText
        text={t('result.daily.come-back')}
        tone="muted"
        align="center"
        testID="result.come-back-note"
      />
    </ResultFrame>
  );
}
