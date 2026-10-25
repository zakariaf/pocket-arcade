// apps/stepstone/src/board/stepstone-board.test.ts
// Spec 7.5: a board is a physical space and never mirrors in fa and ckb. Spec 8.11: VoiceOver hears
// a short summary of the board.
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import { BOARD_PALETTES } from './board-palettes.ts';
import { stepstoneBoard } from './stepstone-board.ts';
import { toView } from './to-view.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

const STATE: StepstoneState = {
  ...pondFromText(['..r..', '.....', '..K.F', '..RK.', '.....'].join('\n')),
  moves: 0,
  par: 3,
  kindsUsed: ['rook'],
};

describe('stepstoneBoard', () => {
  it('keeps the pond unmirrored in right-to-left languages', () => {
    expect(stepstoneBoard.isMirroredInRtl).toBe(false);
  });

  it("describes the pond, the frog's hop and the stones in reach for VoiceOver", () => {
    expect(stepstoneBoard.describe(toView(STATE, { formatNumber: String }))).toStrictEqual({
      id: 'stepstone.board.summary',
      values: { side: 5, hop: 'rook', reachCount: 2 },
    });
  });

  it('names no hop once the frog stands on the flag', () => {
    const home = { ...STATE, cells: STATE.cells.map((cell, i) => (i === 2 ? 'flag' : cell)) };
    const view = toView(
      { ...home, cells: home.cells.map((cell, i) => (i === 14 ? 'water' : cell)) },
      {
        formatNumber: String,
      },
    );
    expect(stepstoneBoard.describe(view).values).toMatchObject({ hop: 'none', reachCount: 0 });
  });

  it('points the hint ring at the stone a hop lands on', () => {
    expect(stepstoneBoard.targetsOfMove?.(STATE, { kind: 'hop', to: 17 })).toStrictEqual([
      { regionId: 'board', col: 2, row: 3 },
    ]);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
