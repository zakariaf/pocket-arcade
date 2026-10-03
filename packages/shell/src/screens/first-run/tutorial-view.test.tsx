// packages/shell/src/screens/first-run/tutorial-view.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { TutorialView } from './tutorial-view.tsx';

import type { TutorialModel } from './use-tutorial-model.ts';
import type { BoardHostProps } from '@e07/shell/game-host/game-host.ts';
import type { ReactNode } from 'react';

const TARGET = { regionId: 'board', col: 0, row: 0 };

/** Stands in for the game's board host: shows how many cells the coach points at. */
function ProbeBoard({ testID, coachTargets = [] }: BoardHostProps): ReactNode {
  return <AppText testID={testID} text={`${String(coachTargets.length)} pointed`} />;
}

function modelWith(overrides: Partial<TutorialModel> = {}): TutorialModel {
  return {
    BoardHost: ProbeBoard,
    welcomeText: 'Welcome to Tally!',
    coachText: 'Tap the left column to add one.',
    coachTargets: [TARGET],
    continueKey: null,
    skipKey: null,
    isReducedMotion: true,
    ...overrides,
  };
}

describe('TutorialView', () => {
  it('shows the board with the pointed cells and one sentence, without Skip on the first step', async () => {
    await renderWithShell(<TutorialView model={modelWith()} />);
    expect(screen.getByTestId('tutorial.screen')).toBeOnTheScreen();
    expect(screen.getByTestId('game.board-canvas')).toHaveTextContent('1 pointed');
    expect(screen.getByTestId('tutorial.welcome')).toHaveTextContent('Welcome to Tally!');
    expect(screen.getByTestId('tutorial.coach-text')).toHaveTextContent(
      'Tap the left column to add one.',
    );
    expect(screen.queryByTestId('tutorial.skip-button')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('tutorial.continue-button')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('sends Skip and the continue key to the model', async () => {
    const skip = jest.fn();
    const next = jest.fn();
    const model = modelWith({
      welcomeText: null,
      skipKey: { label: 'Skip', onPress: skip },
      continueKey: { label: 'Tap to continue', onPress: next },
    });
    await renderWithShell(<TutorialView model={model} />);
    await fireEvent.press(screen.getByTestId('tutorial.skip-button'));
    await fireEvent.press(screen.getByTestId('tutorial.continue-button'));
    expect([skip.mock.calls.length, next.mock.calls.length]).toStrictEqual([1, 1]);
    expect(screen.queryByTestId('tutorial.welcome')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('offers the continue key even when no tutorial run could open', async () => {
    await renderWithShell(
      <TutorialView
        model={modelWith({ BoardHost: null, continueKey: { label: 'Go', onPress: jest.fn() } })}
      />,
    );
    expect(screen.queryByTestId('game.board-canvas')).not.toBeOnTheScreen();
    expect(screen.getByTestId('tutorial.continue-button')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
