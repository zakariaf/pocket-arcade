import { PauseDialog } from '@e07/shell/screens/pause/pause-dialog.tsx';

import { GameLayout } from './game-layout.tsx';

import type { ReactNode } from 'react';

// Pause is handed to the layout as its overlay: the layout holds the Android focus trap.
export function GameScreen({ isPaused, board }: { readonly isPaused: boolean; readonly board: ReactNode }): ReactNode {
  return <GameLayout board={board} overlay={isPaused ? <PauseDialog>{null}</PauseDialog> : null} />;
}
