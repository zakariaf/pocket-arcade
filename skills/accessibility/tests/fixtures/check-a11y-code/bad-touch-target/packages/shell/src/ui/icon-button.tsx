// packages/shell/src/ui/icon-button.tsx
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { Icon } from './icons/icon.tsx';

import type { IconName } from './icons/icon-paths.ts';
import type { ReactNode } from 'react';

export type IconButtonProps = {
  readonly icon: IconName;
  /** Required: an icon-only button has no visible text for VoiceOver to read. */
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
};

const styles = StyleSheet.create({
  // The touch box itself is 44 x 44 pt; the 24 pt glyph sits in the middle. No hitSlop.
  box: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});

export function IconButton({ icon, label, onPress, testID }: IconButtonProps): ReactNode {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => [styles.box, state.pressed && styles.pressed]}
      testID={testID}
    >
      <Icon name={icon} color={theme.colors.icon} />
    </Pressable>
  );
}
