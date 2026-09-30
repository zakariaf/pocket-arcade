// apps/line-siege/src/rules/score-level.test.ts
import { scoreLevel, starsByPar, starsByScore, type ScoreOptions } from './score-level.ts';

const WON: ScoreOptions = {
  result: { moves: 7, score: 0, isWon: true },
  rule: { kind: 'par', par: 7 },
  isDaily: false,
  hintsUsed: 0,
};

describe('starsByPar', () => {
  it('gives three stars at par and one far above it', () => {
    expect([starsByPar(7, 7), starsByPar(9, 7), starsByPar(12, 7)]).toStrictEqual([3, 2, 1]);
  });
});

describe('starsByScore', () => {
  it('gives one star per threshold reached', () => {
    expect(starsByScore(150, [100, 200, 300])).toBe(1);
    expect(starsByScore(300, [100, 200, 300])).toBe(3);
  });
});

describe('scoreLevel', () => {
  it('doubles the points of a daily challenge', () => {
    expect(scoreLevel({ ...WON, isDaily: true })).toStrictEqual({ stars: 3, points: 600 });
  });

  it('charges hints in points, never in stars', () => {
    expect(scoreLevel({ ...WON, hintsUsed: 2 })).toStrictEqual({ stars: 3, points: 250 });
  });

  it('returns no stars for a lost level', () => {
    const lost = { ...WON, result: { ...WON.result, isWon: false } };

    expect(scoreLevel(lost)).toStrictEqual({ stars: 0, points: 0 });
  });
});
