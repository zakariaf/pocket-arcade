// packages/shell/src/ui/list.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const LIST = COMPONENT_SPECS.list;

export type ListProps = {
  readonly children: ReactNode;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // A flat panel that clips its rows; no shadow (rows and lists are never raised).
    list: {
      borderWidth: LIST.border,
      borderColor: theme.colors.border,
      borderRadius: LIST.radius,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
  });
  return styles;
});

/** The frame around ListRows (and SubRows). The first row passes isFirst: no separator on top. */
export function List({ children, testID }: ListProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.list} testID={testID}>
      {children}
    </View>
  );
}
