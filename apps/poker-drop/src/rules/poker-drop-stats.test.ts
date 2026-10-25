// apps/poker-drop/src/rules/poker-drop-stats.test.ts
import { busiestBoardTurn } from '@e07/poker-drop/testing/poker-drop-board-turn.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { POKER_DROP_STATS } from './poker-drop-stats.ts';

import type { PokerDropEvent, PokerDropState } from './poker-drop-types.ts';
import type { CounterSpec } from '@e07/game-kit/contract/stats.ts';

const GOLDEN_COUNTERS = [
  ['hands-made', 3],
  ['big-hands', 0],
  ['biggest-cascade', 2],
];

/** The Shell's fold: a sum adds every move's value, a max keeps the best. */
function fold(
  counter: CounterSpec<PokerDropEvent>,
  moves: readonly (readonly PokerDropEvent[])[],
): number {
  const values = moves.map((events) => counter.measure(events));
  return counter.aggregate === 'sum'
    ? values.reduce((sum, value) => sum + value, 0)
    : Math.max(0, ...values);
}

/** The events of each move of a fixed line: always the first listed column. */
function playFirstColumns(start: PokerDropState, count: number): PokerDropEvent[][] {
  const moves: PokerDropEvent[][] = [];
  let state = start;
  for (let i = 0; i < count; i += 1) {
    const move = listMoves(state)[0];
    if (move === undefined) break;
    const result = applyMove(state, move);
    moves.push([...result.events]);
    state = result.state;
  }
  return moves;
}

const handOf = (hand: 'two-pair' | 'straight' | 'flush', step: number): PokerDropEvent => ({
  kind: 'hand-burst',
  step,
  hand,
  lineKind: 'row',
  line: [0, 1, 2, 3, 4],
  cells: [0, 1, 2, 3, 4],
  cards: [0, 1, 2, 3, 4],
  points: 40 * step,
  atMs: 0,
});
const measureAll = (events: readonly PokerDropEvent[]) =>
  POKER_DROP_STATS.counters.map((counter) => [counter.id, counter.measure(events)]);

describe('POKER_DROP_STATS', () => {
  // spec 10 and S10: 2 to 4 counters per game, shown on the game card.
  it('counts hands made, big hands (a straight or better) and the longest cascade of a move', () => {
    const events = [handOf('two-pair', 1), handOf('straight', 1), handOf('flush', 2)];
    expect(measureAll(events)).toStrictEqual([
      ['hands-made', 3],
      ['big-hands', 2],
      ['biggest-cascade', 2],
    ]);
  });

  it('counts nothing for a drop that makes no hand', () => {
    const quiet: PokerDropEvent[] = [{ kind: 'card-dealt', hand: 1, next: 2, atMs: 0 }];
    expect(measureAll(quiet).map(([, value]) => value)).toStrictEqual([0, 0, 0]);
  });

  it('pins the busiest turn: three hands, a two-step cascade', () => {
    expect(measureAll(busiestBoardTurn().result.events)).toStrictEqual(GOLDEN_COUNTERS);
  });

  it('folds a run to the hands it made, and replaying its move line gives the same counters', () => {
    const start = create(7, 30);
    const run = playFirstColumns(start, 30);
    const [hands] = POKER_DROP_STATS.counters;
    if (hands === undefined) throw new Error('hands-made expected');
    const burstCount = run.flat().filter((event) => event.kind === 'hand-burst').length;
    expect(fold(hands, run)).toBe(burstCount);
    const replay = playFirstColumns(start, 30);
    const counters = POKER_DROP_STATS.counters.map((counter) => fold(counter, run));
    expect(POKER_DROP_STATS.counters.map((counter) => fold(counter, replay))).toStrictEqual(
      counters,
    );
  });

  it('declares 2 to 4 counters with permanent kebab-case ids, their labels and folds', () => {
    const { counters } = POKER_DROP_STATS;
    expect(counters.map((counter) => counter.id)).toStrictEqual([
      'hands-made',
      'big-hands',
      'biggest-cascade',
    ]);
    expect(counters.map((counter) => counter.labelId)).toStrictEqual([
      'poker-drop.stats.hands-made',
      'poker-drop.stats.big-hands',
      'poker-drop.stats.biggest-cascade',
    ]);
    expect(counters.map((counter) => counter.aggregate)).toStrictEqual(['sum', 'sum', 'max']);
  });
});
