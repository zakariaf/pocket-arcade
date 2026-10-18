// packages/shell/src/app/parity-launch-marker.tsx
// The parity capture's proof that a Maestro hierarchy dump came from this launch. Reached in every
// build (modal roots render it), yet it draws nothing unless the test-only parity root provides a
// nonce: store builds never provide one. With a nonce it renders an invisible 1 x 1 pt accessible
// element whose testID is parity.launch.<nonce>; capture-app.mjs refuses a dump without it
// ("hierarchy from another simulator"). A modal layer hides everything outside it from the
// accessibility tree, so the Scrim, the Result overlay and the ModalLayer (the consent cover and
// every other layer) each render one inside their modal root, and the parity root renders one for
// every other frame.
import { createContext, use } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

/** This launch's nonce (from the -parity launch argument), or null outside a parity capture. */
export const ParityLaunchContext = createContext<string | null>(null);

/** The marker's testID for a nonce: parity.launch.<nonce>. */
export function parityLaunchTestID(nonce: string): string {
  return `parity.launch.${nonce}`;
}

/**
 * In the middle of the root, never at its top corner: Android marks a node that lies under a system
 * bar's window (the status bar with the cutout, the navigation bar) not visible to the user, and
 * Maestro's dump then drops it (verified on the API 35 parity emulator, E18-T20).
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

/** Renders the invisible nonce marker in a parity capture, and nothing otherwise. */
export function ParityLaunchMarker(): ReactNode {
  const nonce = use(ParityLaunchContext);
  if (nonce === null) return null;
  return (
    <View
      testID={parityLaunchTestID(nonce)}
      accessible
      accessibilityLabel={nonce}
      style={styles.marker}
    />
  );
}
