// packages/shell/src/screens/stats/stats-local-note.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';

import type { ReactNode } from 'react';

const NOTE_ICON = 18;

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1 },
});

/** S10 "Statistics are stored only on this phone." with an 18 pt padlock (both variants). */
export function StatsLocalNote(): ReactNode {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={styles.note}>
      <Icon
        name="lock"
        color={theme.colors.textMuted}
        size={NOTE_ICON}
        testID="stats.local-note.icon"
      />
      <View style={styles.text}>
        <AppText
          text={t('stats.local-note')}
          variant="caption"
          tone="muted"
          testID="stats.local-note"
        />
      </View>
    </View>
  );
}
