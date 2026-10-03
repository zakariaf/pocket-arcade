// packages/shell/src/game-host/game-top-bar.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { GameLayout } from '@e07/shell/screens/game/game-layout.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameTopBar } from './game-top-bar.tsx';

import type { GameTopBarViewProps } from './game-top-bar.tsx';

function propsWith(overrides: Partial<GameTopBarViewProps> = {}): GameTopBarViewProps {
  return {
    hasHints: true,
    modeText: 'Level 12',
    progressText: 'Monsters 3 / 10',
    scoreText: '1,840',
    undo: { label: 'Undo', isAvailable: true, onPress: jest.fn() },
    hint: { label: 'Hint', isAvailable: false, onPress: jest.fn() },
    onPause: jest.fn(),
    isReducedMotion: false,
    ...overrides,
  };
}

describe('GameTopBar', () => {
  it('draws the S5 Shell parts inside the game layout', async () => {
    await renderWithShell(
      <GameLayout topBar={<GameTopBar {...propsWith()} />} board={null} overlay={null} />,
    );

    for (const testID of [
      'game.screen',
      'game.top-bar',
      'game.pause-button',
      'game.mode-label',
      'game.progress-label',
      'game.score',
      'game.undo-button',
      'game.hint-button',
      'game.board',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('leaves out the tools a game does not support', async () => {
    await renderWithShell(<GameTopBar {...propsWith({ undo: null, hint: null })} />);

    expect(screen.queryByTestId('game.undo-button')).toBeNull();
    expect(screen.queryByTestId('game.hint-button')).toBeNull();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws no hint key for a game without solver hints, whatever the perk offer says', async () => {
    // Line Siege: hasHints false. The offer below would draw an enabled key for a solver game.
    const hint = { label: 'Hint', isAvailable: true, onPress: jest.fn() };
    await renderWithShell(<GameTopBar {...propsWith({ hasHints: false, hint })} />);

    expect(screen.queryByTestId('game.hint-button')).toBeNull();
    expect(screen.getByTestId('game.undo-button')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws the hint key for a game with solver hints when the offer holds one', async () => {
    const hint = { label: 'Hint', isAvailable: true, onPress: jest.fn() };
    const user = userEvent.setup();
    await renderWithShell(<GameTopBar {...propsWith({ hasHints: true, hint })} />);

    await user.press(screen.getByRole('button', { name: 'Hint' }));
    expect(hint.onPress).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('pauses from the pause key', async () => {
    const props = propsWith();
    const user = userEvent.setup();
    await renderWithShell(<GameTopBar {...props} />);

    await user.press(screen.getByRole('button', { name: 'Pause' }));

    expect(props.onPause).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
