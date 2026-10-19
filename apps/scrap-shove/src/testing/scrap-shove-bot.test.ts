// apps/scrap-shove/src/testing/scrap-shove-bot.test.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';

import {
  evaluateScrapShove,
  scoreOfScrapShove,
  scrapShoveBot,
  tagScrapShoveEvent,
} from './scrap-shove-bot.ts';

const AT = { col: 1, row: 1 };

describe('evaluateScrapShove', () => {
  it('ranks a cleared floor above every floor and a caught player below', () => {
    const playing = stateFromText(['n....', '.....', '..@..', '.....', '.....']);
    expect(evaluateScrapShove({ ...playing, robots: [] })).toBeGreaterThan(
      evaluateScrapShove(playing),
    );
    expect(evaluateScrapShove({ ...playing, caughtBy: 1 })).toBeLessThan(
      evaluateScrapShove(playing),
    );
  });

  it('prefers fewer robots, then more distance to the nearest robot', () => {
    const two = stateFromText(['n...n', '.....', '.....', '.....', '..@..']);
    const one = stateFromText(['n....', '.....', '.....', '.....', '..@..']);
    const near = stateFromText(['.....', '.....', '.n...', '.....', '..@..']);
    const adjacent = stateFromText(['.....', '.....', '.....', '.n...', '..@..']);
    expect(evaluateScrapShove(one)).toBeGreaterThan(evaluateScrapShove(two));
    expect(evaluateScrapShove(one)).toBeGreaterThan(evaluateScrapShove(near));
    expect(evaluateScrapShove(near)).toBeGreaterThan(evaluateScrapShove(adjacent));
  });

  it('counts a fast robot two squares away as a danger (it steps twice)', () => {
    const fast = stateFromText(['.....', '.....', 'f....', '.....', '..@..']);
    const normal = stateFromText(['.....', '.....', 'n....', '.....', '..@..']);
    expect(evaluateScrapShove(fast)).toBeLessThan(evaluateScrapShove(normal));
  });

  it('values heaps between the player and the robots: a robot about to wreck, a heavy one lined up', () => {
    const doomed = stateFromText(['n....', '.#...', '.....', '.....', '....@']);
    const open = stateFromText(['n....', '.....', '.....', '...#.', '....@']);
    expect(evaluateScrapShove(doomed)).toBeGreaterThan(evaluateScrapShove(open));
    const lined = stateFromText(['.....', '.....', '..h..', '...#.', '....@']);
    const loose = stateFromText(['.....', '.....', '..h..', '..#..', '....@']);
    expect(evaluateScrapShove(lined)).toBeGreaterThan(evaluateScrapShove(loose));
  });
});

describe('scoreOfScrapShove', () => {
  it('reports the score the top bar shows: 10 per robot scrapped', () => {
    const state = stateFromText(['n...n', '.....', '..@..', '.....', '.....']);
    expect(scoreOfScrapShove(state)).toBe(0);
    expect(scoreOfScrapShove({ ...state, robots: state.robots.slice(1) })).toBe(10);
  });
});

describe('tagScrapShoveEvent', () => {
  it('tags every scrapped robot as the payoff and a shoved heap that blocks or crushes as the twist', () => {
    const crash = {
      kind: 'robots-crashed',
      robotIds: [1, 2],
      at: AT,
      cause: 'robot',
      heapId: 3,
      isShovedScrap: false,
    } as const;
    expect(tagScrapShoveEvent(crash)).toStrictEqual(['payoff']);
    expect(tagScrapShoveEvent({ ...crash, cause: 'scrap', isShovedScrap: true })).toStrictEqual([
      'payoff',
      'twist',
    ]);
    const crush = {
      kind: 'robot-crushed',
      robotId: 1,
      robotKind: 'heavy',
      at: AT,
      heapId: 3,
      isByPlayer: true,
    } as const;
    expect(tagScrapShoveEvent(crush)).toStrictEqual(['payoff', 'twist']);
    expect(tagScrapShoveEvent({ ...crush, isByPlayer: false })).toStrictEqual(['payoff']);
    expect(tagScrapShoveEvent({ kind: 'player-waited', at: AT })).toStrictEqual([]);
  });
});

describe('scrapShoveBot', () => {
  it('shoves the heap that crushes the last robot', () => {
    const state = stateFromText(['.....', '.....', '..h..', '...#.', '....@']);
    expect(scrapShoveBot(state, listMoves(state), seedRng(1)).move).toStrictEqual({
      kind: 'shove',
      col: 3,
      row: 3,
    });
  });

  it('plays only listed moves on a real floor', () => {
    const start = create(7, 40);
    const moves = listMoves(start);
    expect(moves).toContainEqual(scrapShoveBot(start, moves, seedRng(7)).move);
  });
});
