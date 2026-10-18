// packages/shell/src/app/modal-layer.tsx
// The one primitive for a layer drawn over the app (S14 dialogs over the navigator, S6 Pause and
// S7 Result over the Game frame, the S3 consent cover over everything). VoiceOver and TalkBack keep
// a layer to themselves in different ways: accessibilityViewIsModal on the layer is iOS-only, and on
// Android only what lies behind can be hidden (importantForAccessibility hides a View's own subtree,
// never a sibling). The system back is Android's only: a layer above the navigator takes it, or the
// press reaches the navigator underneath and leaves the screen behind the layer. While a layer is up,
// what lies behind it is covered for the system back too (HardwareBackCoverContext), so the top layer
// answers whatever subscribed last: the S3 cover over an open dialog keeps the back on S3.
import { use } from 'react';
import { StyleSheet, View } from 'react-native';

import { ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';
import {
  HardwareBackCoverContext,
  useHardwareBack,
} from '@e07/shell/navigation/use-hardware-back.ts';

import type { ReactNode } from 'react';

export type ModalLayerProps = {
  /** What the layer covers: hidden from TalkBack while the layer is up, and never remounted. */
  readonly behind: ReactNode;
  /** The layer, or null (undefined, false) while nothing covers what lies behind. */
  readonly layer: ReactNode;
  /**
   * The system back while the layer is up. Left out, the press goes on to the navigator: Pause and
   * Result, where Game's own Back opens Pause or resumes (usePreventRemove).
   */
  readonly onBack?: (() => void) | null;
};

const styles = StyleSheet.create({ fill: { flex: 1 }, layer: StyleSheet.absoluteFill });

/** Whether a layer node draws something: null, undefined and false draw nothing. */
function isUpOf(layer: ReactNode): boolean {
  return layer !== null && layer !== undefined && layer !== false;
}

/**
 * Draws `behind`, and `layer` over it while there is one. The layer's View is modal (iOS) and draws
 * the parity launch marker first (nothing outside a parity capture: a modal layer hides the parity
 * root's own marker from the hierarchy a capture reads); the View holding `behind` hides it from
 * TalkBack, and its HardwareBackCoverContext keeps the system back from the handlers in it. That
 * View stays and only its value changes, so what lies behind never remounts.
 */
export function ModalLayer({ behind, layer, onBack = null }: ModalLayerProps): ReactNode {
  const isUp = isUpOf(layer);
  const isCovered = use(HardwareBackCoverContext);
  useHardwareBack(isUp ? onBack : null);
  return (
    <View style={styles.fill}>
      <View style={styles.fill} importantForAccessibility={isUp ? 'no-hide-descendants' : 'auto'}>
        <HardwareBackCoverContext value={isCovered || isUp}>{behind}</HardwareBackCoverContext>
      </View>
      {isUp ? (
        <View style={styles.layer} accessibilityViewIsModal>
          <ParityLaunchMarker />
          {layer}
        </View>
      ) : null}
    </View>
  );
}
