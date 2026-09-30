// packages/shell/src/game-host/board-direction-view.test.tsx
// allow-style-assertion: an un-mirrored board keeps direction ltr in Persian; only the style shows it.
import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { BoardDirectionView } from './board-direction-view.tsx';

describe('BoardDirectionView', () => {
  it('keeps an un-mirrored board left to right in Persian', async () => {
    await renderWithShell(
      <BoardDirectionView isMirroredInRtl={false}>
        <View />
      </BoardDirectionView>,
      { language: 'fa', direction: 'rtl' },
    );

    expect(screen.getByTestId('game.board-area')).toHaveStyle({ direction: 'ltr' });
  });
});
