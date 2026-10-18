// packages/shell/src/game-host/board-direction-view.tsx
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

export type BoardDirectionViewProps = {
  /** The game module's isMirroredInRtl declaration (default in every game: false). */
  readonly isMirroredInRtl: boolean;
  readonly testID: string;
  readonly children: ReactNode;
};

const styles = StyleSheet.create({
  board: { flex: 1 },
  // A physical board keeps its left and right while the Shell around it mirrors in fa/ckb.
  boardLtr: { flex: 1, direction: 'ltr' },
});

/** Wraps the board area of the Game screen. A mirrored board flips in its BoardLayout, never here. */
export function BoardDirectionView(props: BoardDirectionViewProps): ReactNode {
  const { isMirroredInRtl, testID, children } = props;
  return (
    <View style={isMirroredInRtl ? styles.board : styles.boardLtr} testID={testID}>
      {children}
    </View>
  );
}
