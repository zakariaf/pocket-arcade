// apps/merge-siege/src/rules/apply-move.test.ts
// Spec 13: "2048-style swipe merging while numbered enemies march in; bigger tiles smash smaller
// enemies." Spec 10 RULES: "Apply a move: returns the new state plus a list of events (what
// happened, for animations and sounds)." A turn: the tiles slide, the enemies march on every
// marchEvery-th swipe, the next enemy enters, a new tile appears (design notes, rules v1).
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { cellAt } from './board-cells.ts';
import { parseBoard } from './board-text.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { TUNING } from './merge-siege-tuning.ts';

import type { MergeSiegeEvent, MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });
const EMPTY_ROW = '. . . . .';

const swipe = (direction: MergeSiegeMove['direction']): MergeSiegeMove => ({
  kind: 'swipe',
  direction,
});

/** A level state with this board, its wave already entered (nothing enters) and `swipes` made. */
function board(rows: readonly string[], overrides: Partial<MergeSiegeState> = {}): MergeSiegeState {
  return { ...create(1, 0), cells: parseBoard(rows), next: null, ...overrides };
}

const eventOf = (
  events: readonly MergeSiegeEvent[],
  kind: MergeSiegeEvent['kind'],
): MergeSiegeEvent | undefined => events.find((event) => event.kind === kind);

/** The last state of a seeded random line of play. */
function played(seed: number, difficulty: number, choices: readonly number[]): MergeSiegeState {
  const { states } = playChoices(RULES, create(seed, difficulty), choices);
  return states[states.length - 1] ?? create(seed, difficulty);
}

describe('applyMove (turn-based: the swipe, then the march, the entry and a new tile)', () => {
  it('smashes both opening enemies with the first swipe up of seed 1, and the next one at the gate', () => {
    const { state, events } = applyMove(create(1, 0), swipe('up'));
    expect(eventOf(events, 'enemies-smashed')).toStrictEqual({
      kind: 'enemies-smashed',
      phase: 'slide',
      smashes: [
        { id: 1, tileId: 3, cell: cellAt(2, 1), value: 2 },
        { id: 2, tileId: 4, cell: cellAt(1, 2), value: 2 },
      ],
    });
    expect(events).toContainEqual({
      kind: 'enemies-smashed',
      phase: 'gate',
      smashes: [{ id: 6, tileId: 5, cell: cellAt(4, 0), value: 4 }],
    });
    expect(state).toMatchObject({ swipes: 1, smashed: 3, score: 80 });
  });

  it('reports the slide, the merges and the score of a swipe', () => {
    const start = board(['e2 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. 2 2 . .']);
    const { state, events } = applyMove(start, swipe('left'));
    expect(eventOf(events, 'tiles-slid')).toStrictEqual({
      kind: 'tiles-slid',
      steps: [
        { id: 2, from: 26, to: 25 },
        { id: 3, from: 27, to: 25 },
      ],
    });
    expect(eventOf(events, 'tiles-merged')).toStrictEqual({
      kind: 'tiles-merged',
      merges: [{ id: 3, intoId: 2, cell: 25, value: 4 }],
    });
    expect(state.cells[25]).toStrictEqual({ id: 2, kind: 'tile', value: 4 });
    expect(eventOf(events, 'score-added')).toStrictEqual({
      kind: 'score-added',
      points: 4,
      total: 4,
    });
  });

  it('loses a tile against a bigger enemy and says so', () => {
    const start = board([EMPTY_ROW, 'e8 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '4 . . . .']);
    const { events } = applyMove(start, swipe('up'));
    expect(eventOf(events, 'tiles-lost')).toStrictEqual({
      kind: 'tiles-lost',
      phase: 'slide',
      losses: [{ id: 2, enemyId: 1, cell: 10, value: 4 }],
    });
  });

  describe('the march', () => {
    it('steps every enemy one row down on every second swipe of a level', () => {
      const start = board(['e2 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . . . 2']);
      const first = applyMove(start, swipe('left'));
      expect(eventOf(first.events, 'enemies-marched')).toBeUndefined();
      const second = applyMove(first.state, swipe('right'));
      expect(eventOf(second.events, 'enemies-marched')).toStrictEqual({
        kind: 'enemies-marched',
        steps: [{ id: 1, from: 0, to: 5 }],
      });
    });

    it('lets a tile hold: an enemy marching onto an equal or bigger tile is smashed', () => {
      const start = board(
        [EMPTY_ROW, EMPTY_ROW, 'e4 . . . .', '4 . . . .', EMPTY_ROW, '. . . . 2'],
        { swipes: 1 },
      );
      const { state, events } = applyMove(start, swipe('left'));
      expect(eventOf(events, 'enemies-smashed')).toStrictEqual({
        kind: 'enemies-smashed',
        phase: 'march',
        smashes: [{ id: 1, tileId: 2, cell: 15, value: 4 }],
      });
      expect(state).toMatchObject({ smashed: 1, score: 40 });
    });

    it('crushes a smaller tile an enemy marches onto, and the enemy moves in', () => {
      const start = board(
        [EMPTY_ROW, EMPTY_ROW, 'e8 . . . .', '4 . . . .', EMPTY_ROW, '. . . . 2'],
        { swipes: 1 },
      );
      const { state, events } = applyMove(start, swipe('left'));
      expect(eventOf(events, 'tiles-lost')).toStrictEqual({
        kind: 'tiles-lost',
        phase: 'march',
        losses: [{ id: 2, enemyId: 1, cell: 15, value: 4 }],
      });
      expect(state.cells[15]).toStrictEqual({ id: 1, kind: 'enemy', value: 8 });
    });
  });

  describe('the entry', () => {
    it('brings the next enemy into the top row of its column and draws the next one', () => {
      const start = board([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .'], {
        next: { col: 3, value: 8 },
        entered: 2,
        nextId: 10,
      });
      const { state, events } = applyMove(start, swipe('right'));
      expect(events).toContainEqual({ kind: 'enemy-entered', id: 10, cell: 3, value: 8 });
      expect(state.entered).toBe(3);
      expect(state.next).not.toBeNull();
    });

    it('stops drawing once the level wave has entered', () => {
      const goal = TUNING.levelRows[0].goal;
      const start = board([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .'], {
        next: { col: 3, value: 8 },
        entered: goal - 1,
      });
      expect(applyMove(start, swipe('right')).state).toMatchObject({ entered: goal, next: null });
    });

    it('smashes the entering enemy at the gate when a tile holds its cell', () => {
      const start = board(['. . . 8 .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .'], {
        next: { col: 3, value: 4 },
        nextId: 10,
      });
      const { state, events } = applyMove(start, swipe('up'));
      expect(events).toContainEqual({
        kind: 'enemies-smashed',
        phase: 'gate',
        smashes: [{ id: 10, tileId: 1, cell: 3, value: 4 }],
      });
      expect(state).toMatchObject({ smashed: 1, entered: 3 });
    });

    it('crushes a smaller tile at the gate', () => {
      const start = board(['. . . 2 .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .'], {
        next: { col: 3, value: 8 },
        nextId: 10,
      });
      const { state, events } = applyMove(start, swipe('up'));
      expect(events).toContainEqual({
        kind: 'tiles-lost',
        phase: 'gate',
        losses: [{ id: 1, enemyId: 10, cell: 3, value: 2 }],
      });
      expect(state.cells[3]).toStrictEqual({ id: 10, kind: 'enemy', value: 8 });
    });

    it('keeps the next enemy waiting while an enemy stands in its entry cell', () => {
      const next = { col: 0, value: 4 };
      const start = board(['e2 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . . . 2'], {
        next,
      });
      const { state, events } = applyMove(start, swipe('left'));
      expect(eventOf(events, 'enemy-entered')).toBeUndefined();
      expect(state.next).toStrictEqual(next);
    });
  });

  describe('the new tile', () => {
    it('drops a 2 or a 4 into an empty cell of the bottom two rows', () => {
      const { state, events } = applyMove(
        board(['e2 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '. . . . 2']),
        swipe('left'),
      );
      const spawned = eventOf(events, 'tile-spawned');
      expect(spawned).toMatchObject({ kind: 'tile-spawned' });
      if (spawned?.kind !== 'tile-spawned') return;
      expect(spawned.cell).toBeGreaterThanOrEqual(cellAt(0, 4));
      expect([2, 4]).toContain(spawned.value);
      expect(state.cells[spawned.cell]).toStrictEqual({
        id: spawned.id,
        kind: 'tile',
        value: spawned.value,
      });
    });

    it('drops no tile when fewer than two cells are empty', () => {
      const full = ['2 4 2 4 e64', '4 2 4 2 4', '2 4 2 4 2', '4 2 4 2 4', '2 4 2 4 2', '. 2 4 2 4'];
      const { events } = applyMove(board(full), swipe('left'));
      expect(eventOf(events, 'tile-spawned')).toBeUndefined();
    });
  });

  it('throws a RangeError for a swipe that changes nothing', () => {
    const start = board(['e2 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, '2 . . . .']);
    expect(() => applyMove(start, swipe('left'))).toThrow(RangeError);
  });

  describe('properties', () => {
    it('accepts every listed swipe and throws a RangeError for every other one', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          expectListedSwipesOnly(played(seed, difficulty, choices));
        }),
      );
    });

    it('keeps its input state unchanged and gives the same results for the same swipes', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const state = played(seed, difficulty, choices);
          const frozen = JSON.stringify(state);
          const results = everySwipeOf(state);
          expect(JSON.stringify(state)).toBe(frozen);
          expect(everySwipeOf(state)).toStrictEqual(results);
        }),
      );
    });

    it('names every event in kebab-case past tense, and never lowers the score or the smash count', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states, events } = playChoices(RULES, create(seed, difficulty), choices);
          expectKebabKinds(events);
          expectRising(states);
        }),
      );
    });
  });
});

/** The results of every listed swipe from one state. */
function everySwipeOf(state: MergeSiegeState): unknown[] {
  return listMoves(state).map((move) => applyMove(state, move));
}

function expectListedSwipesOnly(state: MergeSiegeState): void {
  const listed = listMoves(state).map((move) => move.direction);
  for (const direction of ['up', 'down', 'left', 'right'] as const) {
    if (listed.includes(direction)) expect(() => applyMove(state, swipe(direction))).not.toThrow();
    else expect(() => applyMove(state, swipe(direction))).toThrow(RangeError);
  }
}

function expectKebabKinds(events: readonly MergeSiegeEvent[]): void {
  for (const event of events)
    expect(event.kind).toMatch(
      /^[a-z]+(-[a-z]+)*-(slid|merged|smashed|lost|marched|entered|spawned|added|back)$/,
    );
}

function expectRising(states: readonly MergeSiegeState[]): void {
  states.slice(1).forEach((state, index) => {
    const before = states[index];
    expect(state.score).toBeGreaterThanOrEqual(before?.score ?? 0);
    expect(state.smashed).toBeGreaterThanOrEqual(before?.smashed ?? 0);
    expect(state.swipes).toBe((before?.swipes ?? 0) + 1);
  });
}
