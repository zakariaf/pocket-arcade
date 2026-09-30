// test/integration/a11y/__GAME_ID__-palette.test.ts
// Every game proves its UI palette and its board colours are accessible (WCAG 2.2 AA, colour
// blindness). It imports a game and a Shell testing helper, so it lives in the root test/ folder.
// The piece and kind colours come from the board itself: board-contrast.json names the tokens that
// must stay apart ("distinct"), and board-palettes.json gives their colour-blind colours.
import boardContrast from '@e07/__GAME_ID__/board/board-contrast.json' with { type: 'json' };
import { BOARD_PALETTES } from '@e07/__GAME_ID__/board/board-palettes.ts';
import { PALETTE } from '@e07/__GAME_ID__/theme/palette.ts';
import { checkCategoricalColors, checkPaletteContrast } from '@e07/shell/testing/palette-checks.ts';

import type { BoardToken } from '@e07/__GAME_ID__/board/board-palettes.ts';

/** The board sets a player sees with the colour-blind switch on. */
const COLOR_BLIND_SETS = ['colorBlindLight', 'colorBlindDark'] as const;

function isBoardToken(name: string): name is BoardToken {
  return name in BOARD_PALETTES.light;
}

/** The named tokens of one "distinct" list as the set's colours; a misspelt token fails loudly. */
function colorsOf(set: (typeof COLOR_BLIND_SETS)[number], names: readonly string[]): string[] {
  return names.map((name) => {
    if (!isBoardToken(name)) throw new Error(`board-contrast.json names an unknown token: ${name}`);
    return BOARD_PALETTES[set][name];
  });
}

describe('__GAME_ID__ palette', () => {
  it('meets WCAG 2.2 AA in every mode and scheme', () => {
    expect(checkPaletteContrast(PALETTE)).toStrictEqual([]);
  });

  it('declares at least one set of board colours that must stay apart', () => {
    expect(boardContrast.distinct.length).toBeGreaterThan(0);
  });

  it.each(COLOR_BLIND_SETS)(
    'keeps the named board pieces apart for protan, deutan and tritan players (%s)',
    (set) => {
      const failures = boardContrast.distinct.flatMap((names) =>
        checkCategoricalColors(colorsOf(set, names)).map((failure) => `${names.join(', ')}: ${failure}`),
      );
      expect(failures).toStrictEqual([]);
    },
  );
});
