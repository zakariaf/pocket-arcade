// packages/shell/src/app/parity-marker.tsx
// The parity capture's invisible markers (the launch's nonce, a body's measured scroll) are one view:
// reached in every build through the launch marker, drawn only inside a parity capture.
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

/**
 * In the middle of its parent, never at its top corner: Android marks a node that lies under a
 * system bar's window (the status bar with the cutout, the navigation bar) not visible to the user,
 * and Maestro's dump then drops it (verified on the API 35 parity emulator, E18-T20).
 */
const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    top: '50%',
    start: '50%',
    width: 1,
    height: 1,
    pointerEvents: 'none',
  },
});

export type ParityMarkerProps = { readonly testID: string; readonly label: string };

/**
 * An invisible 1 x 1 pt accessible element a parity capture reads from the hierarchy: the launch's
 * nonce (parity-launch-marker.tsx) or the scroll a body reached (app/parity/parity-scroll-marker.tsx).
 */
export function ParityMarker({ testID, label }: ParityMarkerProps): ReactNode {
  return <View testID={testID} accessible accessibilityLabel={label} style={styles.marker} />;
}
