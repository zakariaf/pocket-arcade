// packages/shell/src/screens/home/home-daily-card.tsx
// Planted bug: the Play key is drawn inside the opener, so a tap on it may open S9 and VoiceOver
// finds the key only inside the card.
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { SPACING } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { COMPONENT_SPECS } from '@e07/shell/ui/component-specs.ts';
import { IconTile } from '@e07/shell/ui/icon-tile.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { RaisedSurface } from '@e07/shell/ui/raised-surface.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import type { HomeDaily } from './home-model.ts';
import type { ReactNode } from 'react';
import type { AccessibilityActionEvent } from 'react-native';

export type HomeDailyCardProps = {
  readonly daily: HomeDaily;
  /** The card's body: opens S9 Daily challenge (also once today is done). */
  readonly onOpenDaily: () => void;
  /** The Play key: starts today's run. */
  readonly onPlayDaily: () => void;
  readonly isReducedMotion: boolean;
};

const PANEL = COMPONENT_SPECS.panel;
/** The daily panel lies flat: its surface neither sinks (elevation 0) nor squashes when pressed. */
const FLAT = { x: 0, y: 0 } as const;
/** VoiceOver's double tap opens S9 through this action, wherever the card's centre falls. */
const OPEN_ACTIONS = [{ name: 'activate' }] as const;

const styles = StyleSheet.create({
  // The Panel's daily box (padding 14 / 14 / 16, gap 12). The panel's edge is drawn by the surface
  // underneath, so the padding keeps the edge width: every part sits where the Panel put it.
  card: {
    alignSelf: 'stretch',
    gap: SPACING.md,
    paddingTop: PANEL.border + PANEL.paddingBlock,
    paddingInline: PANEL.border + PANEL.paddingBlock,
    paddingBottom: PANEL.border + PANEL.paddingInline,
  },
  // The bottom layer fills the whole card, edge included (the card View has no border of its own).
  surface: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1, gap: 1 },
  streak: { marginTop: 2 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

/**
 * The parts drawn above the surface: VoiceOver hears them in the surface's label, and a touch on
 * them falls through to the surface (pointerEvents none), so the whole body opens S9.
 */
const DECORATION = {
  pointerEvents: 'none',
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * S4 daily panel, drawn exactly as the flat Panel (padding 14 / 14 / 16, gap 12): calendar icon
 * tile, title and date, the streak sticker, then "Play today's challenge", or the done line once
 * today is played. The card body is one button that opens S9 (`home.daily-card`: a flat surface
 * filling the card, labelled with the title, date and streak); the Play key is a separate button
 * above it (`home.daily-card.play-button`), never nested inside the opener.
 */
export function HomeDailyCard({
  daily,
  onOpenDaily,
  onPlayDaily,
  isReducedMotion,
}: HomeDailyCardProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  const title = t('daily.title');
  const streak = t('daily.streak.count', { daysCount: daily.streakDays });
  const doneText = t('daily.today.done');
  const openLabel = [title, daily.dateText, streak, ...(daily.isDoneToday ? [doneText] : [])].join(
    ', ',
  );
  const handleOpenAction = (event: AccessibilityActionEvent): void => {
    if (event.nativeEvent.actionName === 'activate') onOpenDaily();
  };
  return (
    <View style={styles.card}>
      <RaisedSurface
        testID="home.daily-card"
        label={openLabel}
        onPress={onOpenDaily}
        accessibilityActions={OPEN_ACTIONS}
        onAccessibilityAction={handleOpenAction}
        elevation={0}
        radius={PANEL.radius}
        edgeWidth={PANEL.border}
        fill={theme.colors.surface}
        squash={FLAT}
        isStretched
        layoutStyle={styles.surface}
        isReducedMotion={isReducedMotion}
      >
        {daily.isDoneToday ? (
          <View style={styles.done} {...DECORATION}>
            <Icon name="check" color={SHELL_COLORS[theme.scheme].success} size={20} />
            <AppText text={doneText} testID="home.daily-card.done" />
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
      </RaisedSurface>
      <View style={styles.header} {...DECORATION}>
        <IconTile testID="home.daily-card.icon" icon="calendar" paint="pop" />
        <View style={styles.text}>
          <AppText text={title} variant="heading" isHeader testID="home.daily-card.title" />
          <AppText text={daily.dateText} tone="muted" testID="home.daily-card.date" />
        </View>
        <View style={styles.streak}>
          <Sticker
            testID="home.daily-card.streak"
            text={streak}
            size="sm"
            icon="chain"
            tiltDeg={4}
          />
        </View>
      </View>
    </View>
  );
}
