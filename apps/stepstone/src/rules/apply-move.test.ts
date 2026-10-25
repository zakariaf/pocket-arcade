// apps/stepstone/src/rules/apply-move.test.ts
// Spec 10 RULES: '"Apply a move": returns the new state plus a list of events (what happened, for
// animations and sounds)'. The frog lands on the stone and takes its hop (spec 13: "the tile the
// player stands on sets the next move"); the stone it left sinks.
import fc from 'fast-check';

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { isMoveKind } from './hops.ts';
import { listMoves } from './list-moves.ts';
import { pondFromText, pondText } from './pond-text.ts';

import type { StepstoneState } from './stepstone-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });
const choicesArb = fc.array(fc.nat(), { maxLength: 40 });

/** A hand-built state from pond text: the frog's stone is the one hop kind used so far. */
function pond(text: string): StepstoneState {
  const drawn = pondFromText(text);
  const here = drawn.cells[drawn.frog];
  return {
    ...drawn,
    moves: 0,
    par: 2,
    kindsUsed: here !== undefined && isMoveKind(here) ? [here] : [],
  };
}

const START = ['r.B', '...', 'K.F'].join('\n');

describe('applyMove', () => {
  it('lands the frog on the stone, sinks the stone it left and takes the new hop', () => {
    const { state, events } = applyMove(pond(START), { kind: 'hop', to: 2 });
    expect(pondText(state)).toBe(['~.b', '...', 'K.F'].join('\n'));
    expect(state.moves).toBe(1);
    expect(state.kindsUsed).toStrictEqual(['rook', 'bishop']);
    expect(events).toStrictEqual([
      { kind: 'player-stepped', from: 0, to: 2, moveKind: 'rook', kindsUsed: 2 },
      { kind: 'stone-sank', cell: 0, stone: 'rook' },
      { kind: 'move-kind-changed', cell: 2, from: 'rook', to: 'bishop', isNewKind: true },
    ]);
  });

  it('reports a kind change to a kind already used as not new', () => {
    const start = {
      ...pond(['r.K', '...', 'R.F'].join('\n')),
      kindsUsed: ['rook', 'king'] as const,
    };
    const { events } = applyMove(start, { kind: 'hop', to: 2 });
    expect(events).toContainEqual({
      kind: 'move-kind-changed',
      cell: 2,
      from: 'rook',
      to: 'king',
      isNewKind: false,
    });
  });

  it('emits no kind change when the frog lands on a stone of the same kind', () => {
    const { events } = applyMove(pond(['r.B', '...', 'R.F'].join('\n')), { kind: 'hop', to: 6 });
    expect(events.map((event) => event.kind)).toStrictEqual(['player-stepped', 'stone-sank']);
  });

  describe('when the hop lands on the flag', () => {
    it('emits goal-reached with the hops made and par after the frog steps', () => {
      const { state, events } = applyMove(pond(['b..', '...', '..F'].join('\n')), {
        kind: 'hop',
        to: 8,
      });
      expect(pondText(state)).toBe(['~..', '...', '..f'].join('\n'));
      expect(events).toStrictEqual([
        { kind: 'player-stepped', from: 0, to: 8, moveKind: 'bishop', kindsUsed: 1 },
        { kind: 'stone-sank', cell: 0, stone: 'bishop' },
        { kind: 'goal-reached', cell: 8, moves: 1, par: 2 },
      ]);
    });
  });

  describe('when the hop leaves no stone in reach', () => {
    it('emits frog-stranded after the kind change (the run is lost unless the player undoes)', () => {
      const { events } = applyMove(pond(['r.K', '...', '..F'].join('\n')), { kind: 'hop', to: 2 });
      expect(events).toStrictEqual([
        { kind: 'player-stepped', from: 0, to: 2, moveKind: 'rook', kindsUsed: 2 },
        { kind: 'stone-sank', cell: 0, stone: 'rook' },
        { kind: 'move-kind-changed', cell: 2, from: 'rook', to: 'king', isNewKind: true },
        { kind: 'frog-stranded', cell: 2 },
      ]);
    });
  });

  describe('when the move is illegal', () => {
    it('throws for a stone the hop does not reach', () => {
      expect(() => applyMove(pond(START), { kind: 'hop', to: 8 })).toThrow(RangeError);
    });

    it('throws for water and for a cell outside the pond', () => {
      expect(() => applyMove(pond(START), { kind: 'hop', to: 1 })).toThrow(RangeError);
      expect(() => applyMove(pond(START), { kind: 'hop', to: 9 })).toThrow(RangeError);
    });

    it('throws once the run is over', () => {
      expect(() =>
        applyMove(pond(['R.f', '...', 'R..'].join('\n')), { kind: 'hop', to: 0 }),
      ).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
        }),
        { numRuns: 100 },
      );
    });

    it('accepts every listed hop, counts it once and sinks exactly the stone left', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          expectOneHopEach(states);
        }),
        { numRuns: 150 },
      );
    });

    it('leaves the state it was given unchanged', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, pick) => {
          const start = create(seed, difficulty);
          const frozen = structuredClone(start);
          const moves = listMoves(start);
          const move = moves[pick % moves.length];
          if (move === undefined) throw new Error('no legal move at the start');
          applyMove(Object.freeze(start), move);
          expect(start).toStrictEqual(frozen);
        }),
        { numRuns: 100 },
      );
    });

    it('throws a RangeError for every cell the hop does not list', () => {
      fc.assert(
        fc.property(
          seedArb,
          difficultyArb,
          fc.integer({ min: -3, max: 52 }),
          (seed, difficulty, to) => {
            expectRejectedUnlessListed(create(seed, difficulty), to);
          },
        ),
        { numRuns: 150 },
      );
    });

    it('survives a JSON round trip unchanged (runs are saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, 50), choices);
          const last = states[states.length - 1];
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
        { numRuns: 100 },
      );
    });

    it('names every event in past-tense kebab-case', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          for (const event of playChoices(RULES, create(seed, difficulty), choices).events.flat()) {
            expect(event.kind).toMatch(/^[a-z]+(-[a-z]+)*$/);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});

/** Each consecutive pair of a played line is one hop (expectOneHop). */
function expectOneHopEach(states: readonly StepstoneState[]): void {
  for (let index = 1; index < states.length; index += 1) {
    expectOneHop(states[index - 1], pickAt(states, index));
  }
}

/** A hop onto a cell listMoves does not list throws a RangeError. */
function expectRejectedUnlessListed(start: StepstoneState, to: number): void {
  if (listMoves(start).some((move) => move.to === to)) return;
  expect(() => applyMove(start, { kind: 'hop', to })).toThrow(RangeError);
}

/** One hop: one more move, the old stone sunk, the frog elsewhere, no other cell changed. */
function expectOneHop(before: StepstoneState | undefined, after: StepstoneState): void {
  if (before === undefined) throw new Error('missing state');
  expect(after.moves).toBe(before.moves + 1);
  expect(after.cells[before.frog]).toBe('sunk');
  expect(after.frog).not.toBe(before.frog);
  const changed = after.cells.filter((cell, index) => cell !== before.cells[index]);
  expect(changed).toStrictEqual(['sunk']);
}
