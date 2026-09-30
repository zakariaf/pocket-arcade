import { BoardCanvas } from './board-canvas.tsx';
import { BoardDirectionView } from './board-direction-view.tsx';

import type { ReactNode } from 'react';

export function BoardArea({ isMirroredInRtl, label }: { readonly isMirroredInRtl: boolean; readonly label: string }): ReactNode {
  return (
    <BoardDirectionView isMirroredInRtl={isMirroredInRtl} testID="game.board-area">
      <BoardCanvas accessibilityLabel={label} style={{ transform: [{ scaleX: -1 }] }} />
    </BoardDirectionView>
  );
}
