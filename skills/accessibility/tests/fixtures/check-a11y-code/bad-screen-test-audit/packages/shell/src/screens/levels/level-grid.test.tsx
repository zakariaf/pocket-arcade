// packages/shell/src/screens/levels/level-grid.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LevelGrid } from './level-grid.tsx';

import type { PackView } from './level-grid.tsx';

const PACKS: readonly PackView[] = [
  {
    id: 'pack-1',
    title: 'Pack 1',
    progressLabel: '4 / 90',
    tiles: [
      { level: 1, numberText: '1', stars: 3, isLocked: false },
      { level: 2, numberText: '2', stars: 1, isLocked: false },
      { level: 3, numberText: '3', stars: 0, isLocked: true },
    ],
  },
];

describe('LevelGrid', () => {
  it('names every tile for screen readers and opens the tapped level', async () => {
    const onSelectLevel = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(<LevelGrid packs={PACKS} onSelectLevel={onSelectLevel} />);

    await user.press(screen.getByRole('button', { name: 'Level 2: 1 star' }));

    expect(onSelectLevel).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Level 3, locked' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Pack 1' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
