// apps/scrap-shove/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { stateFromText } from './board-text.ts';
import { create } from './create.ts';
import { isOnFloor, isSameCell } from './floor-squares.ts';
import { listMoves } from './list-moves.ts';

import type { ScrapShoveEvent, ScrapShoveState } from './scrap-shove-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });
const choicesArb = fc.array(fc.nat(), { maxLength: 30 });

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((item: unknown) => deepFreeze(item));
    Object.freeze(value);
  }
  return value;
}

function playedStates(
  seed: number,
  difficulty: number,
  choices: readonly number[],
): readonly ScrapShoveState[] {
  return playChoices(RULES, create(seed, difficulty), choices).states;
}

/** No two robots on one square, no robot on scrap, everything on the floor (while playing). */
function hasSoundFloor(state: ScrapShoveState): boolean {
  const pieces = [...state.robots, ...state.heaps];
  const isOverlapFree = pieces.every((piece, index) =>
    pieces.slice(index + 1).every((other) => !isSameCell(piece, other)),
  );
  const isOnBoard = [state.player, ...pieces].every((cell) => isOnFloor(cell, state.cols));
  return isOverlapFree && isOnBoard;
}

const PAST_TENSE_KEBAB =
  /^[a-z]+(-[a-z]+)*-(stepped|waited|shoved|smashed|crushed|crashed|caught|cleared|reverted)$/;

describe('applyMove (turn-based: apply the move, then animate its events)', () => {
  it('steps the player, then lets the robots step (spec 13: step or shove, then every robot steps)', () => {
    const { state, events } = applyMove(
      stateFromText(['n....', '.....', '..@..', '.....', '.....']),
      {
        kind: 'step',
        col: 3,
        row: 2,
      },
    );
    expect(state.player).toStrictEqual({ col: 3, row: 2 });
    expect(state.robots).toStrictEqual([{ id: 1, kind: 'normal', col: 1, row: 1 }]);
    expect(events).toStrictEqual([
      { kind: 'player-stepped', from: { col: 2, row: 2 }, to: { col: 3, row: 2 } },
      {
        kind: 'robots-stepped',
        steps: [{ robotId: 1, from: { col: 0, row: 0 }, to: { col: 1, row: 1 } }],
      },
    ]);
  });

  it('crushes a robot with a shoved heap and clears the floor before the robots move (the twist)', () => {
    const { state, events } = applyMove(stateFromText(['.n..', '.#..', '.@..', '....']), {
      kind: 'shove',
      col: 1,
      row: 1,
    });
    expect(state.robots).toStrictEqual([]);
    expect(state.heaps).toStrictEqual([{ id: 2, col: 1, row: 0, isShoved: true }]);
    expect(events).toStrictEqual([
      { kind: 'player-stepped', from: { col: 1, row: 2 }, to: { col: 1, row: 1 } },
      {
        kind: 'scrap-shoved',
        heapId: 2,
        from: { col: 1, row: 1 },
        to: { col: 1, row: 0 },
        byRobotId: null,
      },
      {
        kind: 'robot-crushed',
        robotId: 1,
        robotKind: 'normal',
        at: { col: 1, row: 0 },
        heapId: 2,
        isByPlayer: true,
      },
      { kind: 'floor-cleared' },
    ]);
  });

  it('wrecks a robot on scrap the player shoved into its path, marking the twist', () => {
    const { events } = applyMove(
      stateFromText(['n.....', '......', '..#...', '...@..', '......', '......']),
      {
        kind: 'shove',
        col: 2,
        row: 2,
      },
    );
    expect(events.at(-2)).toStrictEqual({
      kind: 'robots-crashed',
      robotIds: [1],
      at: { col: 1, row: 1 },
      cause: 'scrap',
      heapId: 2,
      isShovedScrap: true,
    });
    expect(events.at(-1)).toStrictEqual({ kind: 'floor-cleared' });
  });

  it('lets the player shove back the heap a heavy robot pushed up, crushing it', () => {
    const pushed = stateFromText(['.....', '.....', '..h..', '...#.', '....@']);
    const { state, events } = applyMove(pushed, { kind: 'shove', col: 3, row: 3 });
    expect(state.robots).toStrictEqual([]);
    expect(events).toContainEqual({
      kind: 'robot-crushed',
      robotId: 1,
      robotKind: 'heavy',
      at: { col: 2, row: 2 },
      heapId: 2,
      isByPlayer: true,
    });
  });

  it('throws a RangeError for a move listMoves does not offer', () => {
    const state = stateFromText(['n...', '.#..', '..@#', '....']);
    expect(() => applyMove(state, { kind: 'step', col: 0, row: 0 })).toThrow(RangeError);
    expect(() => applyMove(state, { kind: 'shove', col: 3, row: 2 })).toThrow(RangeError);
    expect(() => applyMove(state, { kind: 'shove', col: 1, row: 2 })).toThrow(RangeError);
    expect(() => applyMove({ ...state, caughtBy: 1 }, { kind: 'wait' })).toThrow(RangeError);
  });

  it('keeps the pinned result of the seed 1 opening shove', () => {
    const { events } = applyMove(create(1, 0), { kind: 'shove', col: 4, row: 3 });
    expect(events.map((event) => event.kind)).toStrictEqual(GOLDEN_SEED_1_SHOVE_EVENTS);
  });

  it('accepts every listed move and replays identically for the same seed and choices', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        expect(playedStates(seed, difficulty, choices)).toStrictEqual(
          playedStates(seed, difficulty, choices),
        );
      }),
    );
  });

  it('leaves its input state unchanged', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, pick) => {
        const start = deepFreeze(create(seed, difficulty));
        const moves = listMoves(start);
        const move = moves[pick % moves.length] ?? { kind: 'wait' };
        expect(() => applyMove(start, move)).not.toThrow();
      }),
    );
  });

  it('keeps the floor sound and never adds a robot while playing', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const states = playedStates(seed, difficulty, choices);
        const playing = states.filter((state) => state.caughtBy === null);
        expect(playing.every(hasSoundFloor)).toBe(true);
        const counts = states.map((state) => state.robots.length);
        expect(counts.every((count, index) => count <= (counts[index - 1] ?? count))).toBe(true);
      }),
    );
  });

  it('names every event in past-tense kebab-case', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const { events } = playChoices(RULES, create(seed, difficulty), choices);
        const kinds = events.map((event: ScrapShoveEvent) => event.kind);
        expect(kinds.filter((kind) => !PAST_TENSE_KEBAB.test(kind))).toStrictEqual([]);
      }),
    );
  });

  it('survives a JSON round trip unchanged after play (runs are saved as JSON)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
        const last = playedStates(seed, difficulty, choices).at(-1);
        expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
      }),
    );
  });
});

const GOLDEN_SEED_1_SHOVE_EVENTS = [
  'player-stepped',
  'scrap-shoved',
  'robots-stepped',
  'scrap-shoved',
  'robots-crashed',
];
