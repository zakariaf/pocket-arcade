// packages/shell/src/screens/game/game-layout.tsx
import { StyleSheet, View } from 'react-native';

import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';

import type { ReactNode } from 'react';

export type GameLayoutProps = {
  /** `<GameTopBar {...topBarPropsOf(...)} />` (game-host/game-top-bar.tsx). */
  readonly topBar: ReactNode;
  /** The game's board host; the game draws and handles input inside it. */
  readonly board: ReactNode;
  /** The Pause or Result overlay, drawn over the board so the board stays mounted. */
  readonly overlay: ReactNode;
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  board: { flex: 1, marginTop: 4, marginInline: 14 },
});

/**
 * S5 frame: the game top bar, then the board area (the game's). No banner and no stickers
 * over the board, ever. GameScreen (navigation-and-routing) renders this in place of a bare View.
 * The overlay is a sibling of the safe-area frame, so Pause's scrim and Result's own ScreenFrame
 * cover the whole screen (status bar and home indicator too) and are inset once, not twice.
 */
export function GameLayout({ topBar, board, overlay }: GameLayoutProps): ReactNode {
  return (
    <View style={styles.fill}>
      <ScreenFrame testID="game.screen">
        {topBar}
        <View style={styles.board} testID="game.board">
          {board}
        </View>
      </ScreenFrame>
      {overlay}
    </View>
  );
}
