// packages/shell/src/game-host/board-direction-view.test.tsx
import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { BoardDirectionView } from './board-direction-view.tsx';

describe('BoardDirectionView', () => {
  it('keeps a physical board left-to-right inside an RTL layout', async () => {
    await renderWithShell(
      <BoardDirectionView isMirroredInRtl={false} testID="game.board-area">
        <View />
      </BoardDirectionView>,
      { language: 'fa', direction: 'rtl' },
    );
    expect(screen.getByTestId('game.board-area')).toHaveStyle({ direction: 'ltr' });
  });

  it('lets a board that opted in to mirroring follow the layout', async () => {
    await renderWithShell(
      <BoardDirectionView isMirroredInRtl testID="game.board-area">
        <View />
      </BoardDirectionView>,
      { language: 'fa', direction: 'rtl' },
    );
    expect(screen.getByTestId('game.board-area')).not.toHaveStyle({ direction: 'ltr' });
  });
});
