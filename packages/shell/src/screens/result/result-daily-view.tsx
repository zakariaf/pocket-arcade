// packages/shell/src/screens/result/result-daily-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { ScorePanel } from '@e07/shell/ui/score-panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { DailyResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultDailyViewProps = { readonly model: DailyResult };

// Chip and Sticker align themselves to the start (alignSelf): only a centred row centres them.
const styles = StyleSheet.create({
  centred: { flexDirection: 'row', justifyContent: 'center' },
  chip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  grow: { flexGrow: 1 },
});

/**
 * S7 daily result (Chosen; the design draws no frame): the win layout without stars, with the
 * streak sticker in the sub-sticker place, "come back tomorrow" and a hero Home key.
 */
export function ResultDailyView({ model }: ResultDailyViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="result.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      {/* Under the home indicator, ending with 34 pt: room for the last key's hard shadow. */}
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.chip}>
          <Chip testID="result.mode-chip" text={model.modeText} />
        </View>
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
          />
        </View>
        <ScorePanel
          testIDBase="result.score-card"
          label={t('common.score')}
          value={model.scoreText}
          {...(model.isNewBest ? { newBestText: t('result.win.new-best') } : {})}
          progressLine={model.progressText}
          isReducedMotion={model.isReducedMotion}
        />
        <AppText
          text={t('result.daily.come-back')}
          tone="muted"
          align="center"
          testID="result.come-back-note"
        />
        <View style={styles.grow} />
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
      </ScreenBody>
    </ScreenFrame>
  );
}
