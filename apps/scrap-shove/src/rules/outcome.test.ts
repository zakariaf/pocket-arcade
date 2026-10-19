// apps/scrap-shove/src/rules/outcome.test.ts
import { stateFromText } from './board-text.ts';
import { outcome, robotsScrapped } from './outcome.ts';

const PLAYING = stateFromText(['n...', '....', '..@.', 'h...']);

describe('outcome', () => {
  it('says playing while robots are left and none reached the player', () => {
    expect(outcome(PLAYING)).toStrictEqual({ kind: 'playing' });
  });

  it('says won when every robot of the floor is scrap, scoring 10 per robot (spec 13: clearing a floor)', () => {
    const cleared = { ...PLAYING, robots: [] };
    expect(outcome(cleared)).toStrictEqual({ kind: 'won', score: GOLDEN_CLEARED_SCORE });
  });

  it('says lost with the caught reason when a robot reached the player (spec S7)', () => {
    const caught = { ...PLAYING, caughtBy: 1 };
    expect(outcome(caught)).toStrictEqual({ kind: 'lost', reasonKey: 'scrap-shove.lose.caught' });
  });

  it('lets a catch win over an empty floor (the run ended with the player caught)', () => {
    expect(outcome({ ...PLAYING, robots: [], caughtBy: 1 }).kind).toBe('lost');
  });
});

describe('robotsScrapped', () => {
  it('counts the robots gone from the floor', () => {
    expect(robotsScrapped(PLAYING)).toBe(0);
    expect(robotsScrapped({ ...PLAYING, robots: PLAYING.robots.slice(1) })).toBe(1);
  });
});

const GOLDEN_CLEARED_SCORE = 20;
