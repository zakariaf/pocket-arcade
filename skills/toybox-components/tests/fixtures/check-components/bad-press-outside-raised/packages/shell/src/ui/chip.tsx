// packages/shell/src/ui/chip.tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';

import { AppText } from './app-text.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

const CHIP = COMPONENT_SPECS.chip;

export type ChipProps = {
  /** Translated ("Level 12", "Today", "Step 2 of 4", the version). */
  readonly text: string;
  readonly testID: string;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: CHIP.gap,
      paddingBlock: CHIP.paddingBlock,
      paddingInline: CHIP.paddingInline,
      borderRadius: CHIP.radius,
      borderWidth: CHIP.border,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  });
  return styles;
});

/** A small flat label (level chip, "Today", version, step counter). Not interactive, never tilted. */
export function Chip({ text, testID }: ChipProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.chip}>
      <AppText text={text} variant="chip" testID={testID} />
    </View>
  );
}
