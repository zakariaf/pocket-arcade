// apps/line-siege/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { fullLines } from './board-lines.ts';
import { create } from './create.ts';
import { TUNING, knobsFor } from './line-siege-tuning.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { LineSiegeMove, LineSiegeState } from './line-siege-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

/** Seed 1, difficulty 0: column 7 lacks rows 3-4 and row 5 lacks columns 0-1 (see create's golden). */
const OPENING = create(1, 0);
const FINISH_COLUMN: LineSiegeMove = { kind: 'place-block', trayIndex: 1, col: 7, row: 3 };
const FINISH_ROW: LineSiegeMove = { kind: 'place-block', trayIndex: 2, col: 0, row: 5 };

function expectInvariants(states: readonly LineSiegeState[]): void {
  states.forEach((state, index) => {
    const previous = states[index - 1] ?? state;
    expect(state.score).toBeGreaterThanOrEqual(previous.score);
    expect(state.hearts).toBeLessThanOrEqual(previous.hearts);
    expect(state.cells).toHaveLength(TUNING.boardSize * TUNING.boardSize);
    expect(fullLines(state.cells)).toStrictEqual({ rows: [], cols: [] });
    expect(state.monsters.every((monster) => monster.row < TUNING.laneRows && monster.hp > 0)).toBe(
      true,
    );
    expect(state.tray.some((slot) => slot !== null)).toBe(true);
  });
}

describe('applyMove', () => {
  it('places the block, uses its tray slot and counts the placement', () => {
    const { state, events } = applyMove(OPENING, {
      kind: 'place-block',
      trayIndex: 0,
      col: 3,
      row: 0,
    });
    expect(events[0]).toStrictEqual({
      kind: 'block-placed',
      trayIndex: 0,
      piece: 3,
      cells: [3, 4, 5],
    });
    expect(state.tray).toStrictEqual([null, 2, 1]);
    expect(state.placements).toBe(1);
    expect([3, 4, 5].map((index) => state.cells[index])).toStrictEqual([1, 1, 1]);
  });

  describe('when the block completes a column (spec 13: a cleared column shoots its lane)', () => {
    it('clears it, fires the beam, defeats the weak monster and scores', () => {
      const { state, events } = applyMove(OPENING, FINISH_COLUMN);
      expect(events).toStrictEqual([
        { kind: 'block-placed', trayIndex: 1, piece: 2, cells: [31, 39] },
        { kind: 'column-cleared', col: 7 },
        { kind: 'beam-fired', lane: 7, targetId: 1 },
        { kind: 'monster-hit', monsterId: 1, damage: 8, hpLeft: 0 },
        { kind: 'monster-defeated', monsterId: 1, monsterKind: 'normal', lane: 7, row: 1 },
        { kind: 'score-added', points: 35, total: 35 },
      ]);
      expect(state.defeated).toBe(1);
      expect(state.monsters.map((monster) => monster.id)).toStrictEqual([2, 3]);
      expect(state.cells.filter((_, index) => index % 8 === 7)).toStrictEqual([
        0, 0, 0, 0, 0, 0, 0, 0,
      ]);
    });
  });

  describe('when the block completes a row (spec 13: a shockwave hits every monster for 2)', () => {
    it('clears it and hits every monster', () => {
      const { events } = applyMove(OPENING, FINISH_ROW);
      expect(events.slice(1, 3)).toStrictEqual([
        { kind: 'row-cleared', row: 5 },
        { kind: 'shockwave-sent', rows: 1, damage: 2 },
      ]);
      expect(events.filter((event) => event.kind === 'monster-hit')).toHaveLength(3);
    });
  });

  it('refills the tray from the run stream once all three blocks are placed', () => {
    const first = applyMove(OPENING, FINISH_COLUMN).state;
    const second = applyMove(first, { ...FINISH_ROW }).state;
    const third = applyMove(second, listMoves(second)[0] ?? FINISH_ROW);
    expect(third.events.at(-1)).toStrictEqual({ kind: 'tray-refilled', tray: third.state.tray });
    expect(third.state.tray.every((slot) => slot !== null)).toBe(true);
    expect(third.state.rng).not.toStrictEqual(OPENING.rng);
  });

  it('marches the monsters on every marchEvery-th placement, then the next one enters', () => {
    const due = { ...OPENING, placements: knobsFor(0).marchEvery - 1 };
    const { state, events } = applyMove(due, { kind: 'place-block', trayIndex: 0, col: 3, row: 0 });
    expect(events.filter((event) => event.kind === 'monster-moved')).toHaveLength(3);
    expect(state.monsters.map((monster) => monster.row)).toStrictEqual([2, 1, 1, 0]);
  });

  it('takes a heart when a monster breaks through the wall', () => {
    const due = {
      ...OPENING,
      placements: knobsFor(0).marchEvery - 1,
      monsters: [{ id: 2, kind: 'normal' as const, lane: 6, row: TUNING.laneRows - 1, hp: 3 }],
      spawned: knobsFor(0).goal,
    };
    const { state, events } = applyMove(due, { kind: 'place-block', trayIndex: 0, col: 3, row: 0 });
    expect(events).toContainEqual({
      kind: 'wall-breached',
      monsterId: 2,
      monsterKind: 'normal',
      lane: 6,
      heartsLeft: 2,
    });
    expect(state.hearts).toBe(2);
    expect(outcome(state)).toStrictEqual({ kind: 'won', score: 0 });
  });

  describe('when the move is illegal', () => {
    it('throws for a block that does not fit', () => {
      expect(() =>
        applyMove(OPENING, { kind: 'place-block', trayIndex: 0, col: 7, row: 7 }),
      ).toThrow(RangeError);
    });

    it('throws for a tray slot that is empty or does not exist', () => {
      const used = { ...OPENING, tray: [null, 2, 1] };
      expect(() => applyMove(used, { kind: 'place-block', trayIndex: 0, col: 3, row: 0 })).toThrow(
        RangeError,
      );
      expect(() =>
        applyMove(OPENING, { kind: 'place-block', trayIndex: 3, col: 3, row: 0 }),
      ).toThrow(RangeError);
    });

    it('throws once the run is over', () => {
      expect(() => applyMove({ ...OPENING, hearts: 0 }, FINISH_COLUMN)).toThrow(RangeError);
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

    it('keeps the score rising, the hearts falling and no full line behind', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          expectInvariants(playChoices(RULES, create(seed, difficulty), choices).states);
        }),
        { numRuns: 200 },
      );
    });

    it('lists no moves exactly when the run is over', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          for (const state of playChoices(RULES, create(seed, difficulty), choices).states) {
            expect(listMoves(state).length === 0).toBe(outcome(state).kind !== 'playing');
          }
        }),
      );
    });

    it('survives a JSON round trip unchanged (the save stores it as JSON)', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          const last = states.at(-1);
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
      );
    });

    it('leaves its input state untouched', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, choice) => {
          const start = create(seed, difficulty);
          const before = JSON.stringify(start);
          const moves = listMoves(start);
          applyMove(start, moves[choice % moves.length] ?? FINISH_COLUMN);
          expect(JSON.stringify(start)).toBe(before);
        }),
      );
    });
  });

  it('keeps the pinned event line of a fixed seed-3 run (a change breaks saved replays)', () => {
    const { events } = playChoices(RULES, create(3, 50), [5, 17, 2, 40, 11, 8, 3, 29]);
    expect(events.map((event) => event.kind).join(' ')).toBe(GOLDEN_SEED_3_EVENTS);
  });
});

const GOLDEN_SEED_3_EVENTS = [
  'block-placed',
  'block-placed',
  'block-placed monster-spawned tray-refilled',
  'block-placed monster-moved monster-moved monster-moved monster-moved',
  'block-placed',
  'block-placed monster-spawned tray-refilled',
  'block-placed',
  'block-placed row-cleared shockwave-sent monster-hit monster-hit monster-hit monster-hit score-added monster-moved monster-moved monster-moved monster-moved monster-moved',
].join(' ');
