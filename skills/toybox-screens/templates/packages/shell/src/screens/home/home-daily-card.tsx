// packages/shell/src/screens/home/home-daily-card.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { IconTile } from '@e07/shell/ui/icon-tile.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { HomeDaily } from './home-model.ts';
import type { ReactNode } from 'react';

export type HomeDailyCardProps = {
  readonly daily: HomeDaily;
  readonly onPlayDaily: () => void;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1, gap: 1 },
  streak: { marginTop: 2 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

/**
 * S4 daily panel (flat, padding 14 / 14 / 16, gap 12): calendar icon tile, title and date,
 * the streak sticker, then "Play today's challenge", or the done line once today is played.
 */
export function HomeDailyCard({
  daily,
  onPlayDaily,
  isReducedMotion,
}: HomeDailyCardProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  return (
    <Panel testID="home.daily-card" padding="daily">
      <View style={styles.header}>
        <IconTile testID="home.daily-card.icon" icon="calendar" paint="pop" />
        <View style={styles.text}>
          <AppText
            text={t('daily.title')}
            variant="heading"
            isHeader
            testID="home.daily-card.title"
          />
          <AppText text={daily.dateText} tone="muted" testID="home.daily-card.date" />
        </View>
        <View style={styles.streak}>
          <Sticker
            testID="home.daily-card.streak"
            text={t('daily.streak.count', { daysCount: daily.streakDays })}
            size="sm"
            icon="chain"
            tiltDeg={4}
          />
        </View>
      </View>
      {daily.isDoneToday ? (
        <View style={styles.done}>
          <Icon name="check" color={SHELL_COLORS[theme.scheme].success} size={20} />
          <AppText text={t('daily.today.done')} testID="home.daily-card.done" />
        </View>
      ) : (
        <Button
          testID="home.daily-card.play-button"
          label={t('daily.today.play-button')}
          onPress={onPlayDaily}
          icon="play"
          isBlock
          isReducedMotion={isReducedMotion}
        />
      )}
    </Panel>
  );
}
