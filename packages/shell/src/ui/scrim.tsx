// packages/shell/src/ui/scrim.tsx
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import type { ReactNode } from 'react';

/** The overlay centres its dialog 28 pt from the top and bottom and 20 pt from the sides. */
const OVERLAY_PADDING_BLOCK = 28;
const OVERLAY_PADDING_INLINE = 20;

export type ScrimProps = {
  /** `<dialog>.scrim` or `pause.scrim`. */
  readonly testID: string;
  /** The DialogCard (or the pause dialog), centred on the dimmed screen. */
  readonly children?: ReactNode;
};

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    scrim: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      start: 0,
      end: 0,
      justifyContent: 'center',
      paddingBlock: OVERLAY_PADDING_BLOCK,
      paddingInline: OVERLAY_PADDING_INLINE,
      backgroundColor: SHELL_COLORS[theme.scheme].scrim,
    },
  });
  return styles;
});

/**
 * Dims the whole screen (the only translucent paint) and centres the dialog on it. The scrim is the
 * modal root: VoiceOver stays inside it, and the accessibility tree (what Maestro and the parity
 * capture read) still lists the scrim's own testID, which a modal child would hide. It draws no parity
 * launch marker: it is always drawn inside a ModalLayer (the dialog host's, the Game layout's), whose
 * layer draws the one marker per layer (on Android the modal flag is ignored, so a second marker here
 * was a duplicate element in the hierarchy). The modal flag is
 * iOS-only; on Android the component that draws the scrim beside the screen (the dialog host, the
 * Game layout) hides that screen with importantForAccessibility="no-hide-descendants" while the
 * scrim is up, since no prop here can hide a sibling.
 */
export function Scrim({ testID, children }: ScrimProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.scrim} testID={testID} accessibilityViewIsModal>
      {children}
    </View>
  );
}
