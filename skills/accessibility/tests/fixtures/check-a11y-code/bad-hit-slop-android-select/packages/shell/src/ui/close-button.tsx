import { Platform, Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH } from '@e07/shell/theme/tokens.ts';

import { Icon } from './icons/icon.tsx';

import type { ReactNode } from 'react';

// Platform branches that keep the 44 pt box on both platforms: a larger Android box, and a
// shadow whose own width and height are not the box's size.
const styles = StyleSheet.create({
  box: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    shadowOffset: { width: 0, height: 2 },
    ...Platform.select({ android: { width: 48, height: 48 }, default: {} }),
  },
  ring: Platform.OS === 'android' ? { minWidth: 48, minHeight: 48 } : { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH },
});

export function CloseButton({ label, onPress }: { readonly label: string; readonly onPress: () => void }): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.box, styles.ring]}
      // Planted bug: a hitSlop that only Android gets, spread in from Platform.select.
      {...Platform.select({ android: { hitSlop: 8 }, default: {} })}
    >
      <Icon name="close" />
    </Pressable>
  );
}
