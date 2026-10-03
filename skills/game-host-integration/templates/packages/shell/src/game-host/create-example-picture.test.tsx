// packages/shell/src/game-host/create-example-picture.test.tsx
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';

import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createExamplePicture } from './create-example-picture.tsx';

/** The tally game with one S13 page and a board that counts how often its paths are built. */
function countingGame() {
  const buildPaths = jest.fn(() => ({}));
  const page = {
    titleId: 'tally.goal',
    bodyId: 'tally.how-to-play.step-1',
    example: { count: 1, target: 3 },
    pointer: { kind: 'none' },
  } as const;
  const game: typeof TALLY_GAME = {
    ...TALLY_GAME,
    presentation: {
      ...TALLY_GAME.presentation,
      board: { ...TALLY_GAME.presentation.board, buildPaths },
    },
    teaching: { ...TALLY_GAME.teaching, howToPlay: [page] },
  };
  return { game, buildPaths };
}

describe('createExamplePicture', () => {
  it('builds no board paths at boot, only when S13 first draws a picture (spec S13)', async () => {
    const { game, buildPaths } = countingGame();
    const picture = createExamplePicture()(game);
    expect(buildPaths).not.toHaveBeenCalled();
    await render(createElement(picture, { pageIndex: 0 }), {
      wrapper: createHostWrapper().wrapper,
    });
    expect(buildPaths).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('image')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('builds the paths once for every page and every later render', async () => {
    const { game, buildPaths } = countingGame();
    const picture = createExamplePicture()(game);
    await render(createElement(picture, { pageIndex: 0 }), {
      wrapper: createHostWrapper().wrapper,
    });
    await screen.unmount();
    await render(createElement(picture, { pageIndex: 0 }), {
      wrapper: createHostWrapper().wrapper,
    });
    expect(buildPaths).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
