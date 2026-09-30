// packages/shell/src/ui/tile-button.tsx
import { Pressable, StyleSheet } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { RADII } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';

export type TileButtonProps = {
  readonly label: string;
  readonly size: number;
  readonly onPress: () => void;
  readonly testID: string;
  readonly hint?: string;
  readonly children: ReactNode;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    tile: {
      borderRadius: RADII.md,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
  });
  return styles;
});

/** A square button whose visual content comes from the caller (composition). */
export function TileButton(props: TileButtonProps): ReactNode {
  const { label, size, onPress, testID, children } = props;
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(props.hint === undefined ? {} : { accessibilityHint: props.hint })}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width: size, height: size }, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}
