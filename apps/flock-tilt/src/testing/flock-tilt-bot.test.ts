// apps/flock-tilt/src/testing/flock-tilt-bot.test.ts
import { create } from '@e07/flock-tilt/rules/create.ts';
import { parseField } from '@e07/flock-tilt/rules/field-text.ts';
import { TUNING } from '@e07/flock-tilt/rules/flock-tilt-tuning.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import {
  evaluateFlockTilt,
  flockTiltBot,
  isOnOpenLine,
  scoreOfFlockTilt,
  tagFlockTiltEvent,
} from './flock-tilt-bot.ts';

import type { FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';

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

describe('evaluateFlockTilt', () => {
  it('prefers fewer sheep outside the pen', () => {
    const two = stateOf(['s...s', '....o', '.....', 'w....']);
    const one = stateOf(['s...s', '....o', '.....', 'w....'], {
      sheep: [
        { id: 0, cell: 0, status: 'field' },
        { id: 1, cell: 9, status: 'penned' },
      ],
    });
    expect(evaluateFlockTilt(one)).toBeGreaterThan(evaluateFlockTilt(two));
  });

  it('prefers a sheep on an open line to the pen over one off the line', () => {
    const onLine = stateOf(['.....', 's...o', '.....', '....w']);
    const offLine = stateOf(['s....', '....o', '.....', '....w']);
    expect(evaluateFlockTilt(onLine)).toBeGreaterThan(evaluateFlockTilt(offLine));
  });

  it('dislikes a sheep standing beside a wolf', () => {
    const safe = stateOf(['s....', '.....', '....o', '....w']);
    const risky = stateOf(['sw...', '.....', '....o', '.....']);
    expect(evaluateFlockTilt(safe)).toBeGreaterThan(evaluateFlockTilt(risky));
  });

  it('ranks a win above every field and a loss below', () => {
    const playing = stateOf(['s...o', '.....', 'w....']);
    const won = stateOf(['s...o', '.....', 'w....'], {
      sheep: [{ id: 0, cell: 4, status: 'penned' }],
    });
    const lost = stateOf(['s...o', '.....', 'w....'], {
      sheep: [{ id: 0, cell: 0, status: 'lost' }],
    });
    expect(evaluateFlockTilt(won)).toBeGreaterThan(evaluateFlockTilt(playing));
    expect(evaluateFlockTilt(lost)).toBeLessThan(evaluateFlockTilt(playing));
  });
});

describe('isOnOpenLine', () => {
  it('sees a clear row or column to the pen, and a rock that blocks it', () => {
    const field = stateOf(['s.#.o', '.....', 's....', '.....', 'o....'].slice(0, 4));
    expect(isOnOpenLine(field, 0)).toBe(false);
    expect(isOnOpenLine(stateOf(['s...o']), 0)).toBe(true);
    expect(isOnOpenLine(stateOf(['o', '.', 's']), 2)).toBe(true);
    expect(isOnOpenLine(stateOf(['o', '#', 's']), 2)).toBe(false);
    expect(isOnOpenLine(stateOf(['o.', '.s']), 3)).toBe(false);
  });
});

describe('scoreOfFlockTilt', () => {
  it('reports the score the top bar and the result show', () => {
    const won = stateOf(['s...o'], { sheep: [{ id: 0, cell: 4, status: 'penned' }], tilts: 4 });
    expect(scoreOfFlockTilt(won)).toBe(TUNING.pointsPerSheep + 36 * TUNING.pointsPerSpareTilt);
    expect(scoreOfFlockTilt(stateOf(['s...o']))).toBe(0);
  });
});

describe('tagFlockTiltEvent', () => {
  it('tags a penned sheep as the payoff and a sheep stopped by a sheep or a wolf as the twist', () => {
    expect(tagFlockTiltEvent({ kind: 'sheep-penned', id: 0, cell: 4 })).toStrictEqual(['payoff']);
    const slid = (stoppedBy: 'sheep' | 'wolf' | 'rock', animal: 'sheep' | 'wolf' = 'sheep') => ({
      kind: 'animals-slid' as const,
      direction: 'right' as const,
      slides: [{ animal, id: 0, from: 0, to: 2, stoppedBy }],
    });
    expect(tagFlockTiltEvent(slid('sheep'))).toStrictEqual(['twist']);
    expect(tagFlockTiltEvent(slid('wolf'))).toStrictEqual(['twist']);
    expect(tagFlockTiltEvent(slid('rock'))).toStrictEqual([]);
    expect(tagFlockTiltEvent(slid('sheep', 'wolf'))).toStrictEqual([]);
    expect(tagFlockTiltEvent({ kind: 'field-cleared', tilts: 3, par: 3 })).toStrictEqual([]);
  });
});

describe('flockTiltBot', () => {
  it('takes the tilt that pens the last sheep', () => {
    const state = stateOf(['.....', 's...o', '.....', 'w....']);
    expect(flockTiltBot(state, listMoves(state), seedRng(1)).move).toStrictEqual({
      kind: 'tilt',
      direction: 'right',
    });
  });

  it('plays only listed moves on a real level', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(flockTiltBot(start, moves, seedRng(7)).move);
  });
});
