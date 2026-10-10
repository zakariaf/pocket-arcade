// packages/shell/src/screens/stats/stats-local-caption.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

const styles = StyleSheet.create({ bare: { alignSelf: 'flex-start' } });

/** S10 "Stored only on this phone." on the empty page: the caption alone, no padlock. */
export function StatsLocalCaption(): ReactNode {
  const t = useT();
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
