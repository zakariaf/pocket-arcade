// apps/trail-clear/src/board/to-view.test.ts
// Spec 13 (trail-clear) risk: ""what gets wiped" is hard to read before committing". The view
// carries, for each turn of the offered tile and each cell, whether it fits there and which tiles
// that placement would wipe, so the board can show it while the tile is dragged or chosen.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';
import { distinctTurns, edgesOf } from '@e07/trail-clear/rules/tiles.ts';

import { toView } from './to-view.ts';

import type { TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

const RULES = { listMoves, applyMove };
const PERSIAN = {
  formatNumber: (value: number) =>
    String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(digit))),
};
const PLAIN = { formatNumber: String };
/** Seed 1, difficulty 0: a river end on cell 12 and a road end on cell 14 face the empty cell 13. */
const OPENING = create(1, 0);

/** The cells a wipe mask names, ascending. */
function cellsOf(mask: number): number[] {
  return Array.from({ length: 25 }, (_, cell) => cell).filter((cell) => (mask >> cell) % 2 !== 0);
}

/** The points the move scores, read from the real rules. */
function scoredBy(state: TrailClearState, move: Parameters<typeof applyMove>[1]): number {
  const added = applyMove(state, move).events.find((event) => event.kind === 'score-added');
  return added?.kind === 'score-added' ? added.points : 0;
}

/** The cells the move wipes, read from the real rules. */
function wipedBy(state: TrailClearState, move: Parameters<typeof applyMove>[1]): number[] {
  const wiped = applyMove(state, move).events.find((event) => event.kind === 'tiles-wiped');
  return wiped?.kind === 'tiles-wiped' ? [...wiped.cells] : [];
}

/** One line per tray slot and cell: what the view shows, and what the rules say about that move. */
function previewAndRules(state: TrailClearState): {
  readonly shown: readonly string[];
  readonly real: readonly string[];
} {
  const view = toView(state, PLAIN);
  const turns = state.offered === null ? [] : distinctTurns(state.offered);
  const legal = new Set(listMoves(state).map((move) => JSON.stringify(move)));
  const shown: string[] = [];
  const real: string[] = [];
  turns.forEach((turn, slot) => {
    for (let cell = 0; cell < 25; cell += 1) {
      const move = {
        kind: 'place-tile' as const,
        turns: turn,
        col: cell % 5,
        row: Math.floor(cell / 5),
      };
      const mask = view.wipes[slot]?.[cell] ?? -1;
      const text = view.pointsText[slot]?.[cell] ?? '';
      shown.push(mask < 0 ? 'no fit' : `wipes ${cellsOf(mask).join()} scores ${text}`);
      const isLegal = legal.has(JSON.stringify(move));
      const points = isLegal ? scoredBy(state, move) : 0;
      const scored = points > 0 ? String(points) : '';
      real.push(isLegal ? `wipes ${wipedBy(state, move).join()} scores ${scored}` : 'no fit');
    }
  });
  return { shown, real };
}

describe('toView', () => {
  it('keeps every tile as its four edges in its turn and leaves empty cells empty', () => {
    const view = toView(OPENING, PLAIN);
    expect(view.size).toBe(5);
    expect([view.cells[12], view.cells[13], view.cells[14]]).toStrictEqual([
      edgesOf('river-end', 1),
      [],
      edgesOf('road-end', 3),
    ]);
    expect(view.cells.filter((cell) => cell.length > 0)).toHaveLength(2);
  });

  it('offers the tile once per distinct turn, in turn order', () => {
    expect(toView(OPENING, PLAIN).tray).toStrictEqual(
      [0, 1, 2, 3].map((turn) => edgesOf('ford', turn)),
    );
    const straight = toView({ ...OPENING, offered: 'road-straight' }, PLAIN);
    expect(straight.tray).toStrictEqual([edgesOf('road-straight', 0), edgesOf('road-straight', 1)]);
    expect(straight.wipes).toHaveLength(2);
  });

  it('offers nothing once the bag is empty', () => {
    const view = toView({ ...OPENING, offered: null }, PLAIN);
    expect([view.tray, view.wipes, view.pointsText]).toStrictEqual([[], [], []]);
  });

  it('marks the double spot: the ford turned once wipes both ends for 160 points, in Persian digits', () => {
    const view = toView(OPENING, PERSIAN);
    expect(cellsOf(view.wipes[1]?.[13] ?? -1)).toStrictEqual([12, 13, 14]);
    expect(view.pointsText[1]?.[13]).toBe('۱۶۰');
    // Turned the other way the ford's west edge is grass against the river: it does not fit there.
    expect(view.wipes[0]?.[13]).toBe(-1);
  });

  it('pins how many cells each turn of the opening ford fits (8, 13, 8 and 12)', () => {
    const view = toView(OPENING, PLAIN);
    expect(view.wipes.map((cells) => cells.filter((mask) => mask >= 0).length)).toStrictEqual([
      8, 13, 8, 12,
    ]);
    expect(view.pointsText.flat().filter((text) => text !== '')).toStrictEqual(['160']);
  });

  it('previews exactly the legal placements and the tiles each one wipes (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 24 }),
        (seed, difficulty, choices) => {
          const state =
            playChoices(RULES, create(seed, difficulty), choices).states.at(-1) ?? OPENING;
          const { shown, real } = previewAndRules(state);
          expect(shown).toStrictEqual(real);
        },
      ),
      { numRuns: 25 },
    );
  });
});
