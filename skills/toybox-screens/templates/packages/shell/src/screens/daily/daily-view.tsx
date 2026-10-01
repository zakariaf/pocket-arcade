// packages/shell/src/screens/daily/daily-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';
import { usePairLayout } from '@e07/shell/ui/use-pair-layout.ts';

import { DailyTodayCard } from './daily-today-card.tsx';
import { DailyWeekCard } from './daily-week-card.tsx';
import { StreakCard } from './streak-card.tsx';

import type { DailyModel } from './daily-model.ts';
import type { ReactNode } from 'react';

export type DailyViewProps = { readonly model: DailyModel };

const styles = StyleSheet.create({
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { flex: 1 },
});

/**
 * S9 Daily challenge: today panel, the hero Play (after play: a secondary Replay and its note),
 * the two streak panels, the streak rule, the last-seven-days panel. No banner.
 */
export function DailyView({ model }: DailyViewProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  const pair = usePairLayout(12);
  const { isReducedMotion } = model;
  return (
    <ScreenFrame testID="daily.screen">
      <TopBar
        testID="daily.top-bar"
        title={t('daily.title')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={isReducedMotion}
      />
      <ScreenBody>
        <DailyTodayCard model={model} />
        {model.todayResult === null ? (
          <Button
            testID="daily.play-button"
            label={t('daily.today.play-button')}
            onPress={model.onPlay}
            kind="primary"
            size="hero"
            cap="play"
            isBlock
            isReducedMotion={isReducedMotion}
          />
        ) : (
          <>
            <Button
              testID="daily.replay-button"
              label={t('daily.today.replay-button')}
              onPress={model.onReplay}
              icon="restore"
              isBlock
              isReducedMotion={isReducedMotion}
            />
            <AppText
              text={t('daily.replay-note')}
              variant="caption"
              tone="muted"
              testID="daily.replay-note"
            />
          </>
        )}
        <View style={pair.row}>
          <StreakCard kind="current" days={model.currentStreak} layoutStyle={pair.item} />
          <StreakCard kind="best" days={model.bestStreak} layoutStyle={pair.item} />
        </View>
        {/* The rule element is the whole line, icon included (the design's box). */}
        <View style={styles.rule} testID="daily.streak-rule">
          <Icon
            name="chain"
            color={theme.colors.textMuted}
            size={20}
            testID="daily.streak-rule.icon"
          />
          <View style={styles.ruleText}>
            <AppText text={t('daily.streak.rule')} variant="rule" tone="muted" />
          </View>
        </View>
        <DailyWeekCard week={model.week} />
      </ScreenBody>
    </ScreenFrame>
  );
}
