// packages/shell/src/ui/level-tile.test.tsx — a Toybox component: its measurements are the design contract.
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LevelTile } from './level-tile.tsx';

describe('LevelTile', () => {
  it('draws the Toybox tile at 64 pt with a 16 pt radius', async () => {
    await renderWithShell(<LevelTile level={12} stars={3} onPress={jest.fn()} />);

    expect(screen.getByTestId('levels.level-tile.12')).toHaveStyle({ width: 64, borderRadius: 16 });
  });
});
