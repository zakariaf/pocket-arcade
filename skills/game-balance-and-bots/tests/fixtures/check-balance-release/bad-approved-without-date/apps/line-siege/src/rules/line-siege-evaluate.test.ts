// apps/line-siege/src/rules/line-siege-evaluate.test.ts
import { create } from './create.ts';
import { evaluateLineSiege } from './line-siege-evaluate.ts';

describe('evaluateLineSiege', () => {
  it('values a defeat above a closer monster, and a heart above a crowded board', () => {
    const start = create(3, 20);
    expect(evaluateLineSiege({ ...start, defeated: 1 })).toBeGreaterThan(evaluateLineSiege(start));
    const closer = start.monsters.map((monster) => ({ ...monster, row: monster.row + 1 }));
    expect(evaluateLineSiege({ ...start, monsters: closer })).toBeLessThan(
      evaluateLineSiege(start),
    );
    expect(evaluateLineSiege({ ...start, hearts: 2 })).toBeLessThan(evaluateLineSiege(start));
  });
});
