// apps/trail-clear/src/rules/apply-move.test.ts
// Spec 10 RULES: "Apply a move": returns the new state plus a list of events. Spec 13 (trail-clear):
// "closing a road or river loop scores it and wipes those tiles."
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { ALL_CELLS } from './board-cells.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { knobsFor } from './trail-clear-tuning.ts';

import type {
  PlacedTile,
  TileKind,
  TrailClearEvent,
  TrailClearMove,
  TrailClearState,
} from './trail-clear-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

type Layout = Readonly<Record<number, readonly [TileKind, number]>>;

/** A level-0 state with these tiles on the board and this tile offered. */
function stateWith(
  layout: Layout,
  offered: TileKind,
  overrides: Partial<TrailClearState> = {},
): TrailClearState {
  const cells = ALL_CELLS.map((cell): PlacedTile | null => {
    const entry = layout[cell];
    return entry === undefined ? null : { kind: entry[0], turns: entry[1], placedAt: 1 };
  });
  return { ...create(7, 0), cells, offered, placements: 1, ...overrides };
}

const place = (turns: number, col: number, row: number): TrailClearMove => ({
  kind: 'place-tile',
  turns,
  col,
  row,
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const PAST_TENSE_KIND = /^[a-z]+(-[a-z]+)*-(placed|closed|wiped|added|dealt|cleared)$/;

/** The state after a seeded line of choices. */
function lastState(seed: number, difficulty: number, choices: readonly number[]): TrailClearState {
  const { states } = playChoices(RULES, create(seed, difficulty), choices);
  return states.at(-1) ?? create(seed, difficulty);
}

/** Every placement on the board in every turn, as JSON. */
function everyPlacement(): TrailClearMove[] {
  return ALL_CELLS.flatMap((cell) =>
    [0, 1, 2, 3].map((turns) => place(turns, cell % 5, Math.floor(cell / 5))),
  );
}

/** What applyMove answers for each placement: ok, a RangeError, or another error. */
function answersOf(state: TrailClearState): string[] {
  return everyPlacement().map((move) => {
    try {
      applyMove(state, move);
      return 'ok';
    } catch (error) {
      return error instanceof RangeError ? 'range-error' : 'other-error';
    }
  });
}

/** ok for exactly the listed moves, a RangeError for every other placement. */
function expectedAnswersOf(state: TrailClearState): string[] {
  const listed = listMoves(state).map((move) => JSON.stringify(move));
  return everyPlacement().map((move) =>
    listed.includes(JSON.stringify(move)) ? 'ok' : 'range-error',
  );
}

function pointsIn(events: readonly TrailClearEvent[]): number {
  return events.reduce((sum, event) => sum + (event.kind === 'score-added' ? event.points : 0), 0);
}

function countOf(kinds: readonly string[], wanted: string): number {
  return kinds.filter((kind) => kind === wanted).length;
}

function notPastTense(kinds: readonly string[]): string[] {
  return kinds.filter((kind) => !PAST_TENSE_KIND.test(kind));
}

function kindsIn(events: readonly TrailClearEvent[]): string[] {
  return events.map((event) => event.kind);
}

describe('applyMove', () => {
  it('places the offered tile, counts the placement and deals the next tile', () => {
    const start = stateWith({}, 'road-straight');
    const { state, events } = applyMove(start, place(1, 2, 2));
    expect(state.cells[12]).toStrictEqual({ kind: 'road-straight', turns: 1, placedAt: 2 });
    expect(state.placements).toBe(2);
    expect(events.map((event) => event.kind)).toStrictEqual(['tile-placed', 'tile-dealt']);
    expect(events[0]).toStrictEqual({
      kind: 'tile-placed',
      tile: 'road-straight',
      turns: 1,
      cell: 12,
    });
  });

  it('closes a road between two end pieces, scores it and wipes its tiles', () => {
    const { state, events } = applyMove(
      stateWith({ 12: ['road-end', 1] }, 'road-end', { score: 10 }),
      place(3, 3, 2),
    );
    expect(events.slice(0, 4)).toStrictEqual([
      { kind: 'tile-placed', tile: 'road-end', turns: 3, cell: 13 },
      { kind: 'loop-closed', terrain: 'road', cells: [12, 13], points: 40 },
      { kind: 'tiles-wiped', cells: [12, 13] },
      { kind: 'score-added', points: 40, total: 50 },
    ]);
    expect([state.cells[12], state.cells[13], state.score, state.loopsClosed]).toStrictEqual([
      null,
      null,
      50,
      1,
    ]);
  });

  it('closes the road and the river at once with the opening ford, and doubles the score (the twist)', () => {
    const start = create(1, 0);
    const double = listMoves(start).find((move) =>
      applyMove(start, move).events.some((event) => event.kind === 'double-closed'),
    );
    expect(double).toBeDefined();
    const { state, events } = applyMove(start, double ?? place(0, 0, 0));
    expect(events.filter((event) => event.kind === 'loop-closed')).toHaveLength(2);
    expect(events).toContainEqual({ kind: 'double-closed', bonus: 80 });
    expect(events).toContainEqual({ kind: 'score-added', points: 160, total: 160 });
    expect(state.cells.every((tile) => tile === null)).toBe(true);
    expect(state.loopsClosed).toBe(2);
  });

  it('wipes a tile that sits in both closed loops once', () => {
    const { events } = applyMove(
      stateWith({ 7: ['road-end', 2], 17: ['river-end', 0] }, 'ford'),
      place(0, 2, 2),
    );
    expect(events).toContainEqual({ kind: 'tiles-wiped', cells: [7, 12, 17] });
  });

  it('deals no tile after the last tile of the bag: the level is won', () => {
    const bag = knobsFor(0).bag;
    const { state, events } = applyMove(
      stateWith({}, 'road-end', { placements: bag - 1 }),
      place(2, 2, 0),
    );
    expect(state.offered).toBeNull();
    expect(events.some((event) => event.kind === 'tile-dealt')).toBe(false);
    expect(outcome(state)).toStrictEqual({ kind: 'won', score: state.score });
  });

  it('keeps dealing in the endless run, however many tiles were placed', () => {
    const start = stateWith({}, 'road-end', { difficulty: ENDLESS_DIFFICULTY, placements: 500 });
    expect(applyMove(start, place(2, 2, 0)).state.offered).not.toBeNull();
  });

  it('leaves the state it was given unchanged', () => {
    const start = deepFreeze(create(3, 40));
    const before = JSON.stringify(start);
    for (const move of listMoves(start).slice(0, 5)) applyMove(start, move);
    expect(JSON.stringify(start)).toBe(before);
  });

  describe('when the move is illegal', () => {
    const start = stateWith({ 12: ['road-end', 1] }, 'road-straight');

    it.each([
      ['a cell off the board', place(0, 5, 0)],
      ['a cell that holds a tile', place(1, 2, 2)],
      ['a turn the tile does not list (a straight turned half way)', place(2, 3, 2)],
      ['edges that do not match', place(0, 3, 2)],
      ['a road toward the rim', place(0, 0, 0)],
    ])('throws a RangeError for %s', (_, move) => {
      expect(() => applyMove(start, move)).toThrow(RangeError);
    });

    it('throws once the bag is empty', () => {
      expect(() => applyMove({ ...start, offered: null }, place(1, 0, 2))).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
        }),
      );
    });

    it('accepts every listed move and throws a RangeError for every other placement', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const state = lastState(seed, difficulty, choices);
          expect(answersOf(state)).toStrictEqual(expectedAnswersOf(state));
        }),
        { numRuns: 60 },
      );
    });

    it('keeps the score and the loop count equal to what the events say', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states, events } = playChoices(RULES, create(seed, difficulty), choices);
          const last = states.at(-1) ?? create(seed, difficulty);
          expect(last.score).toBe(pointsIn(events));
          expect(last.loopsClosed).toBe(countOf(kindsIn(events), 'loop-closed'));
          expect(last.placements).toBe(states.length - 1);
        }),
      );
    });

    it('names every event in past-tense kebab-case and survives a JSON round trip', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states, events } = playChoices(RULES, create(seed, difficulty), choices);
          expect(notPastTense(kindsIn(events))).toStrictEqual([]);
          const last = states.at(-1);
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
      );
    });
  });
});
