// packages/shell/src/screens/daily/streak-card.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { RatingStar } from '@e07/shell/ui/rating-star.tsx';

import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

export type StreakCardProps = {
  readonly kind: 'current' | 'best';
  readonly days: number;
  readonly layoutStyle: ViewStyle;
};

const TEST_IDS = {
  current: 'daily.current-streak-card',
  best: 'daily.best-streak-card',
} as const;

/** Streak panels: 12 x 14 padding (Panel "compact"), 4 pt between the label line and the value. */
const STREAK_GAP = 4;
const STREAK_ICON = 18;

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

/** S9 streak panel: an 18 pt icon and label, then the day count (28). */
export function StreakCard({ kind, days, layoutStyle }: StreakCardProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  const testID = TEST_IDS[kind];
  return (
    <View style={layoutStyle}>
      <Panel testID={testID} padding="compact" gap={STREAK_GAP}>
        {/* The label element is the whole line, icon included (the design's label box). */}
        <View style={styles.label} testID={`${testID}.label`}>
          {kind === 'current' ? (
            <Icon
              name="chain"
              color={theme.colors.textMuted}
              size={STREAK_ICON}
              testID={`${testID}.icon`}
            />
          ) : (
            // RatingStar takes no testID: the map's `.icon` sits on this wrapper.
            <View testID={`${testID}.icon`}>
              <RatingStar isFilled size={STREAK_ICON} />
            </View>
          )}
          <AppText
            text={t(kind === 'current' ? 'daily.streak.current' : 'daily.streak.best')}
            variant="streakLabel"
            tone="muted"
          />
        </View>
        <AppText
          text={t('daily.streak.days', { daysCount: days })}
          variant="streakValue"
          testID={`${testID}.value`}
        />
      </Panel>
    </View>
  );
}
