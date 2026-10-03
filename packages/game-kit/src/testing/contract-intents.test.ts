// packages/game-kit/src/testing/contract-intents.test.ts
import { contractIntentProblems, engineMemberProblems } from './contract-intents.ts';

import type { IntentEngine } from './contract-intents.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Toy: pick a slot of the tray (select region), then tap a board cell to put its number there. */
type Move = { readonly kind: 'put'; readonly slot: number; readonly col: number };
const slot = (col: number): BoardTarget => ({ regionId: 'tray', col, row: 0 });
const cell = (col: number): BoardTarget => ({ regionId: 'board', col, row: 0 });
const MOVES: readonly Move[] = [0, 1].flatMap((from) =>
  [0, 1, 2].map((col): Move => ({ kind: 'put', slot: from, col })),
);
const ENGINE: IntentEngine<null, Move> = {
  panMode: 'none',
  selectRegions: ['tray'],
  intentToMove: (_state, intent) =>
    intent.kind === 'tap' && intent.selected !== null && intent.target.regionId === 'board'
      ? { kind: 'put', slot: intent.selected.col, col: intent.target.col }
      : null,
};
const tap = (target: BoardTarget): InputIntent => ({ kind: 'tap', target, selected: null });
const INTENTS = [slot(0), slot(1), cell(0), cell(1), cell(2)].map(tap);

describe('contractIntentProblems', () => {
  it('tries every board tap with every tapped tray slot as the selection', () => {
    let calls = 0;
    const counting: IntentEngine<null, Move> = {
      ...ENGINE,
      intentToMove: (state, intent) => {
        calls += 1;
        return ENGINE.intentToMove(state, intent);
      },
    };
    expect(contractIntentProblems(counting, { state: null, moves: MOVES }, INTENTS)).toStrictEqual(
      [],
    );
    expect(calls).toBe(5 + 3 * 2);
  });

  it('reports a selected move that listMoves does not list', () => {
    const problems = contractIntentProblems(
      ENGINE,
      { state: null, moves: MOVES.slice(1) },
      INTENTS,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"selected":{"regionId":"tray","col":0,"row":0}');
  });
});

describe('engineMemberProblems', () => {
  it('accepts a known pan mode with a list of select regions', () => {
    expect(engineMemberProblems(ENGINE)).toStrictEqual([]);
  });

  it('reports an unknown pan mode and select regions that are not region ids', () => {
    const broken = { ...ENGINE, panMode: 'tilt', selectRegions: [7] } as unknown as typeof ENGINE;
    expect(engineMemberProblems(broken)).toStrictEqual([
      "panMode 'tilt' is not 'none', 'swipe', 'drag' or 'aim'",
      'selectRegions 7 is not a list of region ids ([] when every tap acts)',
    ]);
  });
});
