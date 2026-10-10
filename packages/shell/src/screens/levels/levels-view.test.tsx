// packages/shell/src/screens/levels/levels-view.test.tsx
import { screen, userEvent } from '@testing-library/react-native';

import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { LevelsView } from './levels-view.tsx';

import type { LevelPackModel, LevelsModel, LevelTileModel } from './levels-model.ts';
import type { TestInstance } from 'test-renderer';

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

  it("names the pack's current level for a locked tile further down, not the tile before it", async () => {
    const pack = { ...OPEN_PACK, tiles: [...OPEN_PACK.tiles, tile(5, { kind: 'locked' })] };
    await renderWithShell(<LevelsView model={modelWith({ packs: [pack], focusedLevel: 5 })} />);

    expect(screen.getByTestId('levels.locked-toast')).toHaveTextContent(
      'Unlock this one by finishing level 3.',
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('lets taps through the toast to the tiles it covers while it stays up', async () => {
    const model = modelWith({ focusedLevel: 4 });
    const user = userEvent.setup();
    await renderWithShell(<LevelsView model={model} />);

    expect(screen.getByTestId('levels.locked-toast').parent?.props['pointerEvents']).toBe('none');
    await user.press(screen.getByRole('button', { name: 'Level 3: no stars yet' }));
    expect(model.onPlayLevel).toHaveBeenCalledWith(3);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  describe("with the design's player (28 / 90 stars, level 12 current)", () => {
    const DESIGN_STARS = [3, 3, 2, 3, 1, 3, 3, 2, 3, 2, 3] as const;

    function designTiles(formatNumber: (value: number) => string): LevelTileModel[] {
      return Array.from({ length: 30 }, (_unused, index) => {
        const level = index + 1;
        const stars = DESIGN_STARS[index];
        let state: LevelTileModel['state'] = { kind: 'locked' };
        if (stars !== undefined) state = { kind: 'completed', stars };
        else if (level === 12) state = { kind: 'current' };
        return { level, numberText: formatNumber(level), state };
      });
    }

    function designModel(
      overrides: Partial<LevelsModel> = {},
      formatNumber: (value: number) => string = String,
    ): LevelsModel {
      const first: LevelPackModel = {
        ...OPEN_PACK,
        levelsCount: 30,
        earnedStars: 28,
        totalStars: 90,
        progress: 28 / 90,
        tiles: designTiles(formatNumber),
      };
      return modelWith({ packs: [first, LOCKED_PACK], ...overrides });
    }

    it('reads the pack heading, level count, star progress and requirement (spec S8)', async () => {
      await renderWithShell(<LevelsView model={designModel()} />);

      expect(screen.getByTestId('levels.pack.1.heading')).toHaveTextContent(
        /^Pack 1 – .?First wave.?$/,
      );
      expect(screen.getByTestId('levels.pack.1.count')).toHaveTextContent('30 levels');
      expect(screen.getByTestId('levels.pack.1.progress-label')).toHaveTextContent('28 / 90 stars');
      expect(screen.getByTestId('levels.pack.2.requirement')).toHaveTextContent(
        'Unlocks at 45 stars',
      );
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    });

    it('keeps a locked tile pressable and draws its toast only while it is focused', async () => {
      const model = designModel();
      const user = userEvent.setup();
      const view = await renderWithShell(<LevelsView model={model} />);

      expect(screen.queryByTestId('levels.locked-toast')).not.toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Level 13, locked' }));
      expect(model.onTapLockedLevel).toHaveBeenCalledWith(13);

      await view.rerender(<LevelsView model={designModel({ focusedLevel: 13 })} />);
      expect(screen.getByTestId('levels.locked-toast')).toHaveTextContent(
        'Unlock this one by finishing level 12.',
      );
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    });

    it('closes the scrolling grid with the banner, and leaves it out when not allowed (8.8)', async () => {
      const view = await renderWithShell(<LevelsView model={designModel()} />);
      const grid = screen.getByTestId('levels.grid');
      const wrapper = screen.getByTestId('levels.banner-ad').parent;
      const column = wrapper?.parent;

      expect(column?.children.at(-1)).toBe(wrapper);
      expect(column?.children).toContain(screen.getByTestId('levels.pack.1'));
      expect(grid.queryAll((node) => node === column)).toHaveLength(1);

      await view.rerender(
        <LevelsView
          model={designModel({ banner: { renderBanner: () => null, isAllowed: false } })}
        />,
      );
      expect(screen.queryByTestId('levels.banner-ad')).not.toBeOnTheScreen();
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    });

    it('runs the tiles 1 to 30 in a plain wrapping row, with Persian digits in fa (spec 7.5)', async () => {
      const persian = createNumberFormatter(localeTagFor('fa', 'automatic'));
      await renderWithShell(<LevelsView model={designModel({}, persian)} />, {
        language: 'fa',
        direction: 'rtl',
      });
      const tiles = screen.getByTestId('levels.pack.1.tiles');
      const order = tiles
        .queryAll((node: TestInstance) =>
          /^levels\.level-tile\.\d+$/.test(String(node.props['testID'])),
        )
        .map((node) => String(node.props['testID']));

      // allow-style-assertion: a plain row (never row-reverse) is what mirrors the grid in RTL.
      expect(tiles).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
      expect(order).toStrictEqual(
        Array.from({ length: 30 }, (_unused, index) => `levels.level-tile.${String(index + 1)}`),
      );
      expect(
        screen.getByTestId('levels.level-tile.12.number', { includeHiddenElements: true }),
      ).toHaveTextContent('۱۲');
      expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
    });
  });
});
