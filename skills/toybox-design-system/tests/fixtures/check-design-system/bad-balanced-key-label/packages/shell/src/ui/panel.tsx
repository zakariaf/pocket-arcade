// packages/shell/src/ui/panel.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { RADII, STROKE } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    panel: {
      borderWidth: STROKE.bold,
      borderColor: theme.colors.border,
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
    },
  });
  return styles;
});

export function Panel({ children }: { readonly children: ReactNode }): ReactNode {
  const styles = useStyles();
  return <View style={styles.panel}>{children}</View>;
}
