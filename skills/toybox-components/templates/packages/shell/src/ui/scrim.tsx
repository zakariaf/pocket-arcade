// packages/shell/src/ui/scrim.tsx
import { StyleSheet, View } from 'react-native';

import { ParityLaunchMarker } from '@e07/shell/app/parity-launch-marker.tsx';
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
 * capture read) still lists the scrim's own testID, which a modal child would hide. Its first child is
 * the parity launch marker (nothing outside a parity capture): a modal layer hides the parity root's
 * own marker, so a capture of a dialog frame proves its launch through this one.
 */
export function Scrim({ testID, children }: ScrimProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.scrim} testID={testID} accessibilityViewIsModal>
      <ParityLaunchMarker />
      {children}
    </View>
  );
}
