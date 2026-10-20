// apps/flock-tilt/src/board/flock-tilt-board.test.ts
import { TILT_KEY_REGIONS } from './board-ids.ts';
import { BOARD_PALETTES } from './board-palettes.ts';
import { flockTiltBoard } from './flock-tilt-board.ts';

import type { FlockTiltView } from './to-view.ts';
import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

const VIEW: FlockTiltView = {
  cols: 7,
  rows: 7,
  rocks: [],
  pen: 29,
  sheep: [
    { id: 0, cell: 29, status: 'penned' },
    { id: 1, cell: 7, status: 'field' },
    { id: 2, cell: 9, status: 'field' },
  ],
  wolves: [
    { id: 0, cell: 42 },
    { id: 1, cell: 44 },
  ],
  pennedText: '1',
  pennedCount: 1,
};

describe('flockTiltBoard', () => {
  it('keeps the field unmirrored in fa and ckb: a board is a physical space (spec 7.5)', () => {
    expect(flockTiltBoard.isMirroredInRtl).toBe(false);
  });

  it('describes the field for VoiceOver with counted values (spec 8.11)', () => {
    expect(flockTiltBoard.describe(VIEW)).toStrictEqual({
      id: 'flock-tilt.board.summary',
      values: { penned: 1, total: 3, wolves: 2 },
    });
  });

  it('points the hint ring at the tilt key of the hinted move', () => {
    const state = {} as FlockTiltState;
    expect(
      flockTiltBoard.targetsOfMove?.(state, { kind: 'tilt', direction: 'down' }),
    ).toStrictEqual([{ regionId: TILT_KEY_REGIONS.down, col: 0, row: 0 }]);
  });

  it('gives all four palette sets the same tokens', () => {
    const keys = Object.values(BOARD_PALETTES).map((set) => Object.keys(set).sort().join());
    expect(new Set(keys).size).toBe(1);
  });
});
