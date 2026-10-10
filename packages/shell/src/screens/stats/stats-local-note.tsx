// packages/shell/src/screens/stats/stats-local-note.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';

import type { ReactNode } from 'react';

const NOTE_ICON = 24;

const styles = StyleSheet.create({
  // .cap-t in the design: a 24 pt padlock, 6 pt gap, centred.
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flex: 1 },
});

/** S10 "Stored only on this phone." under the panels: a 24 pt padlock row (the design's box). */
export function StatsLocalNote(): ReactNode {
  const t = useT();
  const theme = useTheme();
  // The note element is the whole row, padlock included (the design's box).
  return (
    <View style={styles.note} testID="stats.local-note">
      <Icon
        name="lock"
        color={theme.colors.textMuted}
        size={NOTE_ICON}
        testID="stats.local-note.icon"
      />
      <View style={styles.text}>
        <AppText text={t('stats.local-note')} variant="caption" tone="muted" />
      </View>
    </View>
  );
}
