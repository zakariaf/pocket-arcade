// packages/shell/src/ui/screen-frame.tsx
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles } from '@e07/shell/theme/make-styles.ts';
import { CONTENT_MAX_WIDTH } from '@e07/shell/theme/tokens.ts';

import type { ReactNode } from 'react';
import type { Edge } from 'react-native-safe-area-context';

export type ScreenFrameProps = {
  readonly children: ReactNode;
  /** `<scope>.screen`, the first testID of every screen. */
  readonly testID: string;
  /** Physical edges on purpose: the notch and home indicator do not mirror in RTL. */
  readonly edges?: readonly Edge[];
};

const ALL_EDGES: readonly Edge[] = ['top', 'bottom', 'left', 'right'];

const useStyles = makeStyles((theme) => {
  const styles = StyleSheet.create({
    // The ground fills the whole screen, behind the status bar and the home indicator too.
    root: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center' },
    // No padding here: the top bar (16) and the screen body (20) apply their own insets.
    column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  });
  return styles;
});

/** Every Shell screen's outermost view: safe areas, ground colour, centred max-width column. */
export function ScreenFrame({ children, testID, edges = ALL_EDGES }: ScreenFrameProps): ReactNode {
  const styles = useStyles();
  return (
    <SafeAreaView edges={edges} style={styles.root} testID={testID}>
      <View style={styles.column}>{children}</View>
    </SafeAreaView>
  );
}
