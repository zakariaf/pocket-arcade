// packages/shell/src/ui/toast-stack.tsx
import { StyleSheet, View } from 'react-native';

import { COMPONENT_SPECS } from './component-specs.ts';

import type { ReactNode } from 'react';

export type ToastStackProps = {
  /** Toasts, newest last; each one announces itself. */
  readonly children: ReactNode;
  readonly testID: string;
};

const styles = StyleSheet.create({ stack: { gap: COMPONENT_SPECS.toast.stackGap } });

/** Several toasts at once (S12 restore results), 10 pt apart. */
export function ToastStack({ children, testID }: ToastStackProps): ReactNode {
  return (
    <View style={styles.stack} testID={testID}>
      {children}
    </View>
  );
}
