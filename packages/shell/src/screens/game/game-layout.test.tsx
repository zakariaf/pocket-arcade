// packages/shell/src/screens/game/game-layout.test.tsx
import { screen, within } from '@testing-library/react-native';
import { View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameLayout } from './game-layout.tsx';

describe('GameLayout', () => {
  it('keeps the top bar and the board inside the safe-area frame (spec S5)', async () => {
    await renderWithShell(
      <GameLayout
        topBar={<View testID="probe.top-bar" />}
        board={<View testID="probe.board" />}
        overlay={null}
      />,
    );
    const frame = within(screen.getByTestId('game.screen'));
    expect(frame.getByTestId('probe.top-bar')).toBeOnTheScreen();
    expect(within(frame.getByTestId('game.board')).getByTestId('probe.board')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Pause and Result over the whole screen, outside the safe-area frame (spec S6, S7)', async () => {
    // Result and Pause bring their own frame and scrim: inside game.screen's safe area they were
    // inset twice (the result sat 59 pt low and its bottom buttons were clipped on the device).
    await renderWithShell(
      <GameLayout topBar={null} board={null} overlay={<View testID="probe.overlay" />} />,
    );
    expect(screen.getByTestId('probe.overlay')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('game.screen')).queryByTestId('probe.overlay'),
    ).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
