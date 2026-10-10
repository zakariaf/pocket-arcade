// packages/shell/src/screens/game/game-moves-probe.tsx
// Test builds only, and only while the debug link set boardLayout=1 (the same switch as the board
// layout probe): `game.moves-label`, the run's move count as one small text, so an E2E flow can
// prove a board tap made a move and that the move survived a kill. The design draws the game's
// progress line instead (the screen map lists game.moves-label as not drawn).
import { StyleSheet, View } from 'react-native';

import { useOptionalDebugServices } from '@e07/shell/app/debug-services-context.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import type { ReactNode } from 'react';

export type GameMovesProbeProps = { readonly moveCount: number | null };

const styles = StyleSheet.create({
  probe: { position: 'absolute', insetBlockEnd: 0, insetInlineEnd: 0 },
});

export function GameMovesProbe({ moveCount }: GameMovesProbeProps): ReactNode {
  const isOn = useOptionalDebugServices()?.isBoardLayoutOn() === true;
  if (!isOn || moveCount === null) return null;
  return (
    <View style={styles.probe} pointerEvents="none">
      <AppText text={String(moveCount)} variant="caption" testID="game.moves-label" />
    </View>
  );
}
