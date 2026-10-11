// packages/shell/src/ui/toast-stack.tsx
import { Children } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type ToastStackProps = {
  /** Toasts, newest last; each one announces itself. */
  readonly children: ReactNode;
  readonly testID: string;
  /** Where the stack sits in its screen (S12 docks it 14 pt over the body's bottom); never paint. */
  readonly layoutStyle?: StyleProp<ViewStyle>;
};

const styles = StyleSheet.create({ stack: { gap: COMPONENT_SPECS.toast.stackGap } });

/**
 * Toasts at once (S12 restore results), 10 pt apart. Several toasts lie on the ground, as the
 * design's restore card draws them: the page under the stack never shows through the gaps. A
 * single toast gets no backdrop: it would show as a block while the toast drops in.
 */
export function ToastStack({ children, testID, layoutStyle }: ToastStackProps): ReactNode {
  const { colors } = useTheme();
  const isStacked = Children.count(children) > 1;
  return (
    <View
      style={[layoutStyle, styles.stack, isStacked && { backgroundColor: colors.background }]}
      testID={testID}
    >
      {children}
    </View>
  );
}
