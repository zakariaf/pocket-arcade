// packages/shell/src/ui/sub-row.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const ROW = COMPONENT_SPECS.row;

export type SubRowProps = {
  /** Translated ("Volume"). */
  readonly label: string;
  readonly testID: string;
  /** The control on the right of the label (a Slider). */
  readonly children: ReactNode;
};

const styles = StyleSheet.create({
  // No separator, no minimum height, no top padding; the label lines up with the row label above.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW.gap,
    paddingTop: 0,
    paddingBottom: ROW.paddingBlock,
    paddingStart: ROW.subRowPaddingStart,
    paddingEnd: ROW.paddingInline,
  },
});

/** The volume line under Sound effects and Music: a muted label and a slider. */
export function SubRow({ label, testID, children }: SubRowProps): ReactNode {
  return (
    <View style={styles.row} testID={testID}>
      <AppText text={label} variant="subRowLabel" tone="muted" testID={`${testID}.label`} />
      {children}
    </View>
  );
}
