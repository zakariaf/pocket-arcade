// apps/flock-tilt/src/rules/apply-move.test.ts
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { fieldText, parseField } from './field-text.ts';
import { TUNING } from './flock-tilt-tuning.ts';
import { listMoves } from './list-moves.ts';
import { DIRECTIONS } from './tilt-field.ts';

import type {
  Direction,
  FlockTiltEvent,
  FlockTiltMove,
  FlockTiltState,
} from './flock-tilt-types.ts';

const RULES = { listMoves, applyMove };
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });
const choicesArb = fc.array(fc.nat(), { maxLength: 30 });

/** A playing state from a text map. */
function stateOf(
  lines: readonly string[],
  overrides: Partial<FlockTiltState> = {},
): FlockTiltState {
  return {
    ...parseField(lines),
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par: 2,
    hasContinued: false,
    beforeLoss: null,
    ...overrides,
  };
}

function tilt(direction: Direction): FlockTiltMove {
  return { kind: 'tilt', direction };
}

/** Freezes a value and everything inside it, so any write throws. */
function deepFreeze<TValue>(value: TValue): TValue {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
}

const PAST_TENSE_KEBAB = /^[a-z]+(-[a-z]+)*-(slid|penned|lost|cleared|out|back)$/;

/** Event kinds that are not past-tense kebab-case (there must be none). */
function oddEventKinds(events: readonly FlockTiltEvent[]): string[] {
  return events.map((event) => event.kind).filter((kind) => !PAST_TENSE_KEBAB.test(kind));
}

describe('applyMove (spec 10 RULES: "Apply a move: returns the new state plus a list of events")', () => {
  it('slides every sheep and wolf as far as it goes and counts the tilt', () => {
    const { state, events } = applyMove(stateOf(['s....', '.....', 'w...o']), tilt('right'));
    expect(fieldText(state)).toBe(['....s', '.....', '...wo'].join('\n'));
    expect(state.tilts).toBe(1);
    expect(events).toStrictEqual([
      {
        kind: 'animals-slid',
        direction: 'right',
        cols: 5,
        slides: [
          { animal: 'sheep', id: 0, from: 0, to: 4, stoppedBy: 'fence' },
          { animal: 'wolf', id: 0, from: 10, to: 13, stoppedBy: 'pen' },
        ],
      },
    ]);
  });

  it('moves the animal nearest the wall first, so sheep stop against each other', () => {
    const { events } = applyMove(stateOf(['ss.#.', '....o']), tilt('right'));
    expect(events[0]).toStrictEqual({
      kind: 'animals-slid',
      direction: 'right',
      cols: 5,
      slides: [
        { animal: 'sheep', id: 1, from: 1, to: 2, stoppedBy: 'rock' },
        { animal: 'sheep', id: 0, from: 0, to: 1, stoppedBy: 'sheep' },
      ],
    });
  });

  it('drops a sheep that reaches the pen into it and counts it', () => {
    const { state, events } = applyMove(stateOf(['s..o.', 's....']), tilt('right'));
    expect(state.sheep[0]).toStrictEqual({ id: 0, cell: 3, status: 'penned' });
    expect(events.slice(1)).toStrictEqual([{ kind: 'sheep-penned', id: 0, cell: 3 }]);
  });

  it('wins when the last sheep drops in: field-cleared with the tilts and par', () => {
    const { state, events } = applyMove(stateOf(['s..o.', '.....', 'w....']), tilt('right'));
    expect(state.sheep.every((sheep) => sheep.status === 'penned')).toBe(true);
    expect(events.map((event) => event.kind)).toStrictEqual([
      'animals-slid',
      'sheep-penned',
      'field-cleared',
    ]);
    expect(events[2]).toStrictEqual({ kind: 'field-cleared', tilts: 1, par: 2 });
  });

  it('loses a sheep that ends against the wolf and keeps the flock from before the tilt', () => {
    const start = stateOf(['s...w', '....o']);
    const { state, events } = applyMove(start, tilt('right'));
    expect(state.sheep[0]?.status).toBe('lost');
    expect(events[1]).toStrictEqual({ kind: 'sheep-lost', id: 0, cell: 3, wolfId: 0, wolfCell: 4 });
    expect(state.beforeLoss).toStrictEqual({ sheep: start.sheep, wolves: start.wolves, tilts: 0 });
  });

  it('ends the run when the last tilt of the budget is made without a win', () => {
    const start = stateOf(['s....', '....o'], { tilts: TUNING.tiltLimit - 1 });
    const { state, events } = applyMove(start, tilt('right'));
    expect(state.tilts).toBe(TUNING.tiltLimit);
    expect(events.at(-1)).toStrictEqual({ kind: 'tilts-ran-out', tilts: TUNING.tiltLimit });
    expect(state.beforeLoss?.tilts).toBe(TUNING.tiltLimit - 1);
  });

  it('keeps no flock-before while the run goes on', () => {
    expect(applyMove(stateOf(['s....', '....o']), tilt('down')).state.beforeLoss).toBeNull();
  });

  describe('when the move is illegal', () => {
    it('throws a RangeError for a tilt that moves nothing', () => {
      expect(() => applyMove(stateOf(['s....', '....o']), tilt('up'))).toThrow(RangeError);
    });

    it('throws a RangeError for an unknown direction and once the run is over', () => {
      const bad = { kind: 'tilt', direction: 'sideways' } as unknown as FlockTiltMove;
      expect(() => applyMove(stateOf(['s....', '....o']), bad)).toThrow(RangeError);
      const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }] });
      expect(() => applyMove(won, tilt('left'))).toThrow(RangeError);
    });
  });

  describe('properties', () => {
    it('accepts every listed move and refuses every unlisted tilt', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const { states } = playChoices(RULES, create(seed, difficulty), choices);
          for (const state of states) expect(unlistedTiltsThatApply(state)).toStrictEqual([]);
        }),
        { numRuns: 30 },
      );
    });

    it('replays identically for the same seed, difficulty and move choices', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, choicesArb, (seed, difficulty, choices) => {
          const first = playChoices(RULES, create(seed, difficulty), choices);
          expect(playChoices(RULES, create(seed, difficulty), choices)).toStrictEqual(first);
        }),
        { numRuns: 30 },
      );
    });

    it('leaves a frozen input state unchanged and names events in past-tense kebab-case', () => {
      fc.assert(
        fc.property(seedArb, difficultyArb, fc.nat(), (seed, difficulty, pick) => {
          const start = deepFreeze(create(seed, difficulty));
          const moves = listMoves(start);
          const move = moves[pick % moves.length] ?? tilt('up');
          const { events } = applyMove(start, move);
          expect(oddEventKinds(events)).toStrictEqual([]);
        }),
        { numRuns: 30 },
      );
    });

    it('survives a JSON round trip unchanged (runs are saved as JSON)', () => {
      fc.assert(
        fc.property(seedArb, choicesArb, (seed, choices) => {
          const { states } = playChoices(RULES, create(seed, 50), choices);
          const last = states[states.length - 1];
          expect(JSON.parse(JSON.stringify(last)) as unknown).toStrictEqual(last);
        }),
        { numRuns: 30 },
      );
    });
  });
});

/** Tilts listMoves leaves out that applyMove still accepts (there must be none). */
function unlistedTiltsThatApply(state: FlockTiltState): Direction[] {
  const listed = listMoves(state).map((move) => move.direction);
  return DIRECTIONS.filter((direction) => !listed.includes(direction)).filter((direction) => {
    try {
      applyMove(state, tilt(direction));
      return true;
    } catch (error) {
      if (error instanceof RangeError) return false;
      throw error;
    }
  });
}
