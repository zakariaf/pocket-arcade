// packages/shell/src/screens/levels/levels-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LevelsView } from './levels-view.tsx';

import type { LevelPackModel, LevelsModel, LevelTileModel } from './levels-model.ts';

function tile(level: number, state: LevelTileModel['state']): LevelTileModel {
  return { level, numberText: String(level), state };
}

const OPEN_PACK: LevelPackModel = {
  number: 1,
  name: 'First wave',
  levelsCount: 3,
  earnedStars: 5,
  totalStars: 9,
  progress: 5 / 9,
  isLocked: false,
  unlockStars: 0,
  missingStars: 0,
  tiles: [
    tile(1, { kind: 'completed', stars: 3 }),
    tile(2, { kind: 'completed', stars: 2 }),
    tile(3, { kind: 'current' }),
    tile(4, { kind: 'locked' }),
  ],
};

const LOCKED_PACK: LevelPackModel = {
  ...OPEN_PACK,
  number: 2,
  name: 'Second wave',
  isLocked: true,
  unlockStars: 45,
  missingStars: 17,
  tiles: [],
};

function modelWith(overrides: Partial<LevelsModel> = {}): LevelsModel {
  return {
    packs: [OPEN_PACK, LOCKED_PACK],
    focusedLevel: null,
    isReducedMotion: false,
    banner: { renderBanner: () => null, isAllowed: true },
    onBack: jest.fn(),
    onPlayLevel: jest.fn(),
    onTapLockedLevel: jest.fn(),
    ...overrides,
  };
}

describe('LevelsView', () => {
  it('draws the S8 packs, tiles and locked pack with their design testIDs', async () => {
    await renderWithShell(<LevelsView model={modelWith()} />);

    for (const testID of [
      'levels.screen',
      'levels.top-bar',
      'levels.top-bar.back-button',
      'levels.top-bar.title',
      'levels.grid',
      'levels.pack.1',
      'levels.pack.1.heading',
      'levels.pack.1.count',
      'levels.pack.1.progress',
      'levels.pack.1.progress-star',
      'levels.pack.1.progress-label',
      'levels.pack.1.progress-bar',
      'levels.pack.1.tiles',
      'levels.level-tile.1.number',
      'levels.level-tile.1.stars-3',
      'levels.level-tile.2.stars-2',
      'levels.level-tile.3.flag',
      'levels.level-tile.4.number',
      'levels.pack.2',
      'levels.pack.2.icon',
      'levels.pack.2.heading',
      'levels.pack.2.locked-badge',
      'levels.pack.2.requirement',
      'levels.pack.2.explanation',
      'levels.banner-ad',
    ]) {
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    // Free-text placeholders (…Name, …Text) arrive bidi-isolated, so match around the marks.
    expect(screen.getByTestId('levels.pack.1.heading')).toHaveTextContent(
      /^Pack 1 – .?First wave.?$/,
    );

    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('plays an open level and explains a locked one', async () => {
    const model = modelWith();
    const user = userEvent.setup();
    await renderWithShell(<LevelsView model={model} />);

    await user.press(screen.getByRole('button', { name: 'Level 3: no stars yet' }));
    await user.press(screen.getByRole('button', { name: 'Level 4, locked' }));

    expect(model.onPlayLevel).toHaveBeenCalledWith(3);
    expect(model.onTapLockedLevel).toHaveBeenCalledWith(4);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('shows the unlock toast for the tapped locked tile', async () => {
    await renderWithShell(<LevelsView model={modelWith({ focusedLevel: 4 })} />);

    expect(screen.getByTestId('levels.locked-toast')).toHaveTextContent(
      'Unlock this one by finishing level 3.',
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
