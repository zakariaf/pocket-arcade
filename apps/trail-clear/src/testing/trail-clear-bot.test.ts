// apps/trail-clear/src/testing/trail-clear-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { listMoves } from '@e07/trail-clear/rules/list-moves.ts';

import {
  evaluateTrailClear,
  scoreOfTrailClear,
  tagTrailClearEvent,
  trailClearBot,
} from './trail-clear-bot.ts';

describe('tagTrailClearEvent', () => {
  it('tags a closed loop as the payoff and a double as the twist', () => {
    expect(
      tagTrailClearEvent({ kind: 'loop-closed', terrain: 'road', cells: [1, 2], points: 40 }),
    ).toStrictEqual(['payoff']);
    expect(tagTrailClearEvent({ kind: 'double-closed', bonus: 80 })).toStrictEqual(['twist']);
    expect(
      tagTrailClearEvent({ kind: 'tile-placed', tile: 'ford', turns: 0, cell: 12 }),
    ).toStrictEqual([]);
  });
});

describe('scoreOfTrailClear', () => {
  it('reports the points the top bar shows', () => {
    expect(scoreOfTrailClear({ ...create(1, 0), score: 270 })).toBe(270);
  });
});

describe('evaluateTrailClear', () => {
  it('is the evaluation the witness of the levels uses (re-exported from rules)', () => {
    expect(evaluateTrailClear(create(1, 0))).toBeGreaterThan(0);
  });
});

describe('trailClearBot', () => {
  it('takes the opening double: the ford between the road end and the river end', () => {
    const start = create(11, 0);
    const choice = trailClearBot(start, listMoves(start), seedRng(11));
    const kinds = applyMove(start, choice.move).events.map((event) => event.kind);
    expect(kinds).toContain('double-closed');
  });

  it('plays only listed moves on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(trailClearBot(start, moves, seedRng(7)).move);
  });
});
