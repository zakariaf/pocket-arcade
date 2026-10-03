// packages/shell/src/ui/dialog-button-row.tsx
import { StyleSheet, View } from 'react-native';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const DIALOG = COMPONENT_SPECS.dialog;

export type DialogButtonRowProps = {
  /** Buttons with isInRow, the safe choice first (Cancel / Later, then the action). */
  readonly children: ReactNode;
  /** `<dialog>.buttons`. */
  readonly testID: string;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DIALOG.buttonRowGap,
    marginTop: DIALOG.buttonRowMarginTop,
  },
});

/** The dialog's button row: wraps at 200 % text; start to end mirrors in RTL. */
export function DialogButtonRow({ children, testID }: DialogButtonRowProps): ReactNode {
  return (
    <View style={styles.row} testID={testID}>
      {children}
    </View>
  );
}
