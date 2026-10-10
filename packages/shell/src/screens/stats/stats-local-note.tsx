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
  bare: { alignSelf: 'flex-start' },
});

export type StatsLocalNoteProps = {
  /** The panels page: a 24 pt padlock row. The empty page: the caption alone. */
  readonly hasIcon?: boolean;
};

/** S10 "Stored only on this phone.": a padlock row under the panels, a bare caption when empty. */
export function StatsLocalNote({ hasIcon = false }: StatsLocalNoteProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  if (!hasIcon) {
    return (
      <View style={styles.bare}>
        <AppText
          text={t('stats.local-note')}
          variant="caption"
          tone="muted"
          testID="stats.local-note"
        />
      </View>
    );
  }
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
