// packages/shell/src/ui/labelled-value.tsx
// Model for a presentational ui/ component: one named export per file, read-only props,
// strings arrive translated, theme-only styles, one testID with derived part testIDs,
// no store, screen or service imports, no logic beyond layout.
import { StyleSheet, View } from 'react-native';

import { SPACING } from '@e07/shell/theme/tokens.ts';

import { AppText } from './app-text.tsx';

import type { ReactNode } from 'react';

export type LabelledValueProps = {
  /** Already translated by the screen (t()). */
  readonly label: string;
  /** Already formatted in the chosen digits (a formatter or t() with {x, number}). */
  readonly value: string;
  /** The root testID; parts append a segment: `<testID>.label`, `<testID>.value`. */
  readonly testID: string;
  /** Slot instead of a variant flag: an icon or a sticker placed after the value. */
  readonly accessory?: ReactNode;
};

const styles = StyleSheet.create({
  root: { gap: SPACING.xxs },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});

export function LabelledValue({ label, value, testID, accessory }: LabelledValueProps): ReactNode {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.valueRow}>
        <AppText text={value} variant="title" testID={`${testID}.value`} />
        {accessory}
      </View>
      <AppText text={label} variant="caption" tone="muted" testID={`${testID}.label`} />
    </View>
  );
}
