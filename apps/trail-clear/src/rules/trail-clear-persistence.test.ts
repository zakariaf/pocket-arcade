// apps/trail-clear/src/rules/trail-clear-persistence.test.ts
// Spec 8.6 and N10: a run survives every kill and every update; a saved run that no longer parses
// is dropped alone (8.14), never a crash.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playBotLine } from '@e07/game-kit/testing/play-bot.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';
import { trailClearBot } from '@e07/trail-clear/testing/trail-clear-bot.ts';
import { TRAIL_CLEAR_TESTING } from '@e07/trail-clear/testing/trail-clear-testing.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { distinctTurns, edgesOf } from './tiles.ts';
import { TRAIL_CLEAR_PERSISTENCE, parseMove, parseState } from './trail-clear-persistence.ts';
import { knobsFor } from './trail-clear-tuning.ts';
import { fits } from './trails.ts';

import type { PlacedTile, TileKind, TrailClearMove, TrailClearState } from './trail-clear-types.ts';

const RULES = { listMoves, applyMove };
const START = create(1, 0);
const TILE = { kind: 'road-end', turns: 1, placedAt: 3 };
/** Seed 1's opening gap: column 3, row 2 (create.test.ts pins the board). */
const OPENING_GAP = 2 * 5 + 3;

/** A seeded line of play and its states. */
function played(seed: number, difficulty: number, choices: readonly number[]) {
  return playChoices(RULES, create(seed, difficulty), choices);
}

/** The moves a run's choices pick, replayed from the start. */
function movesOf(start: TrailClearState, choices: readonly number[]): TrailClearMove[] {
  const moves: TrailClearMove[] = [];
  let state = start;
  for (const choice of choices) {
    const legal = listMoves(state);
    const move = legal[choice % Math.max(legal.length, 1)];
    if (move === undefined) break;
    moves.push(move);
    state = applyMove(state, move).state;
  }
  return moves;
}

function replay(start: TrailClearState, moves: readonly TrailClearMove[]): TrailClearState {
  return moves.reduce((state, move) => applyMove(state, move).state, start);
}

describe('parseState', () => {
  it('returns a saved state unchanged after a JSON round trip', () => {
    const state = create(9, 60);
    expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
  });

  it('returns any state reached by play unchanged (the save is written after every move)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          const last = played(seed, difficulty, choices).states.at(-1);
          expect(parseState(JSON.parse(JSON.stringify(last)))).toStrictEqual(last);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('returns every state the bot reaches unchanged, high scores and long runs included', () => {
    fc.assert(
      fc.property(fc.nat(), fc.constantFrom(0, 30, 60, 90, 100), (seed, difficulty) => {
        const options = { seed, difficulty, policy: trailClearBot, maxMoves: 60 };
        const { line } = playBotLine({ create, listMoves, applyMove, outcome }, options);
        const states = line.map((step) => applyMove(step.state, step.move).state);
        const refused = states.filter(
          (state) => parseState(JSON.parse(JSON.stringify(state))) === null,
        );
        expect(refused).toStrictEqual([]);
      }),
      { numRuns: 12 },
    );
  });

  it('gives back the same bytes, keys in the same order (the save compares JSON text)', () => {
    const state = create(4, 30);
    expect(JSON.stringify(parseState(JSON.parse(JSON.stringify(state))))).toBe(
      JSON.stringify(state),
    );
  });

  it('keeps an empty bag (a won level: every tile placed, offered null) and a finished continue', () => {
    const won = { ...TRAIL_CLEAR_TESTING.examples.win(), hasContinued: true };
    expect(won.offered).toBeNull();
    expect(won.placements).toBe(knobsFor(won.difficulty).bag);
    expect(parseState(JSON.parse(JSON.stringify(won)))).toStrictEqual(won);
  });

  it.each([
    ['text', 'garbage'],
    ['a missing field', { ...START, score: undefined }],
    ['a field of the wrong type', { ...START, hasContinued: 'yes' }],
    ['an extra field', { ...START, hearts: 3 }],
    ['cells of the wrong length', { ...START, cells: [null, null] }],
    ['cells that are not a list', { ...START, cells: {} }],
    [
      'a tile of an unknown kind',
      { ...START, cells: START.cells.map(() => ({ ...TILE, kind: 'tunnel' })) },
    ],
    [
      'a tile turned five times',
      { ...START, cells: START.cells.map(() => ({ ...TILE, turns: 5 })) },
    ],
    [
      'a tile with an extra field',
      { ...START, cells: START.cells.map(() => ({ ...TILE, colour: 1 })) },
    ],
    ['an offered tile of an unknown kind', { ...START, offered: 'tunnel' }],
    ['a difficulty above 100', { ...START, difficulty: 101 }],
    ['a negative score', { ...START, score: -10 }],
    ['an RNG state of three words', { ...START, rng: [1, 2, 3] }],
    ['an RNG word above 32 bits', { ...START, rng: [1, 2, 3, 2 ** 33] }],
  ])('refuses %s', (_, json) => {
    expect(parseState(JSON.parse(JSON.stringify(json)))).toBeNull();
  });
});

/** START with a `kind` tile on the opening's gap, placed by placement 1, turned to fit or not. */
function withGapTile(kind: TileKind, isClosing: boolean): TrailClearState {
  const gap = OPENING_GAP;
  const turns = distinctTurns(kind).find(
    (turn) => fits(START.cells, gap, edgesOf(kind, turn)) === isClosing,
  );
  const tile: PlacedTile = { kind, turns: turns ?? 0, placedAt: 1 };
  return {
    ...START,
    placements: 1,
    cells: START.cells.map((old, index) => (index === gap ? tile : old)),
  };
}

/** A state of real play with several tiles of its own on the board. */
const MID = played(1, 0, [3, 1, 4, 1, 5, 9, 2, 6]).states.at(-1) ?? START;
const placedCells = MID.cells.flatMap((tile, index) =>
  tile !== null && tile.placedAt > 0 ? [index] : [],
);

function retagged(cell: number, placedAt: number): TrailClearState {
  return {
    ...MID,
    cells: MID.cells.map((tile, index) =>
      index === cell && tile !== null ? { ...tile, placedAt } : tile,
    ),
  };
}

describe('parseState refuses a save that legal play cannot reach', () => {
  it('starts from a played state with tiles of its own, which it accepts', () => {
    expect(placedCells.length).toBeGreaterThanOrEqual(2);
    expect(MID.loopsClosed).toBeGreaterThanOrEqual(1);
    expect(parseState(JSON.parse(JSON.stringify(MID)))).toStrictEqual(MID);
  });

  it.each([
    [
      'two tiles with the same placement number (a tile id used twice)',
      () => retagged(placedCells[1] ?? 0, MID.cells[placedCells[0] ?? 0]?.placedAt ?? 0),
    ],
    [
      'a tile placed after the last placement',
      () => retagged(placedCells[0] ?? 0, MID.placements + 1),
    ],
    ['a third opening tile', () => retagged(placedCells[0] ?? 0, 0)],
    ['a tile whose edges do not match its neighbour', () => withGapTile('road-straight', false)],
    [
      'a closed loop left on the board (a loop is wiped when it closes)',
      () => withGapTile('ford', true),
    ],
    ['a score without a closed loop', () => ({ ...START, score: 40 })],
    ['a score that is not a whole number of tile points', () => ({ ...MID, score: MID.score + 5 })],
    [
      'a score below the smallest loops (two tiles each) its closed loops would score',
      () => ({ ...MID, score: 10 }),
    ],
    [
      'a score above what its placements could ever score',
      () => ({ ...MID, score: MID.score + 1_000_000 }),
    ],
    ['a closed loop without a score', () => ({ ...START, loopsClosed: 1 })],
    [
      'more than two loops for each placement',
      () => ({ ...START, placements: 1, loopsClosed: 3, score: 480 }),
    ],
    [
      'more placements than the level bag holds',
      () => ({ ...START, placements: knobsFor(0).bag + 1 }),
    ],
    ['an empty bag before the last tile is placed', () => ({ ...START, offered: null })],
    [
      'an offered tile after the last tile of the bag was placed',
      () => ({ ...TRAIL_CLEAR_TESTING.examples.win(), offered: 'ford' }),
    ],
    [
      'an endless run with nothing offered (its bag never empties)',
      () => ({ ...create(1, ENDLESS_DIFFICULTY), offered: null }),
    ],
  ])('refuses %s', (_, make) => {
    expect(parseState(JSON.parse(JSON.stringify(make())))).toBeNull();
  });
});

describe('parseMove', () => {
  it('returns every legal move unchanged (property)', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
        for (const move of listMoves(create(seed, difficulty))) {
          expect(parseMove(JSON.parse(JSON.stringify(move)))).toStrictEqual(move);
        }
      }),
      { numRuns: 30 },
    );
  });

  it.each([
    ['another kind', { kind: 'rotate-tile', turns: 1, col: 0, row: 0 }],
    ['a cell off the board', { kind: 'place-tile', turns: 0, col: 5, row: 0 }],
    ['a turn past three', { kind: 'place-tile', turns: 4, col: 0, row: 0 }],
    ['a part cell', { kind: 'place-tile', turns: 0, col: 1.5, row: 0 }],
    ['an extra field', { kind: 'place-tile', turns: 0, col: 0, row: 0, tray: 1 }],
    ['not an object', 7],
  ])('refuses %s', (_, json) => {
    expect(parseMove(json)).toBeNull();
  });
});

describe('TRAIL_CLEAR_PERSISTENCE', () => {
  it('saves after every move, at state version 1, with nothing older to migrate', () => {
    expect(TRAIL_CLEAR_PERSISTENCE.savePolicy).toStrictEqual({ kind: 'after-every-move' });
    expect(TRAIL_CLEAR_PERSISTENCE.stateVersion).toBe(1);
    expect(TRAIL_CLEAR_PERSISTENCE.migrateState(START, 0)).toBeNull();
  });

  it('rebuilds the same state from a replay of the saved move line (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 30 }),
        (seed, difficulty, choices) => {
          const start = create(seed, difficulty);
          const saved = movesOf(start, choices).map((move) =>
            parseMove(JSON.parse(JSON.stringify(move))),
          );
          const last = played(seed, difficulty, choices).states.at(-1);
          expect(
            replay(
              start,
              saved.filter((move) => move !== null),
            ),
          ).toStrictEqual(last);
        },
      ),
      { numRuns: 40 },
    );
  });
});
