// packages/shell/src/app/parity/parity-error-view.tsx
// Test builds only (reached through test-only.ts). A malformed -parity argument shows only this:
// a silent fallback to Home would be compared with the wrong reference. It renders before any
// theme or i18n provider exists, so the error is the accessible label of one plain view (Maestro
// reads it as the element's text) on the system background.
import { PlatformColor, StyleSheet, View } from 'react-native';

import type { ComponentType, ReactNode } from 'react';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PlatformColor('systemBackground') },
});

/** The root component startShell registers instead of the app. */
export function createParityErrorRoot(message: string): ComponentType {
  return function ParityErrorView(): ReactNode {
    return (
      <View style={styles.root} testID="parity.error" accessible accessibilityLabel={message} />
    );
  };
}
