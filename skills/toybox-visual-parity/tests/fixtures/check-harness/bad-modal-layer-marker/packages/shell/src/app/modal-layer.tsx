// packages/shell/src/app/modal-layer.tsx
// Planted bug: the layer is modal but draws no parity launch marker, so a capture of the S3
// consent cover has no nonce in its hierarchy.
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

const styles = StyleSheet.create({ fill: { flex: 1 }, layer: StyleSheet.absoluteFill });

export function ModalLayer({ behind, layer }: { readonly behind: ReactNode; readonly layer: ReactNode }): ReactNode {
  return (
    <View style={styles.fill}>
      <View style={styles.fill} importantForAccessibility={layer === null ? 'auto' : 'no-hide-descendants'}>
        {behind}
      </View>
      {layer === null ? null : (
        <View style={styles.layer} accessibilityViewIsModal>
          {layer}
        </View>
      )}
    </View>
  );
}
