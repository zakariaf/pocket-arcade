// apps/line-siege/src/rules/quick.sim.test.ts
import { writeFileSync } from 'node:fs';

describe('quick', () => {
  it('writes', () => {
    writeFileSync('x', 'y');
  });
});
