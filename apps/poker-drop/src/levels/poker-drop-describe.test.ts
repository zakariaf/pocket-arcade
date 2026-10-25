// apps/poker-drop/src/levels/poker-drop-describe.test.ts
import { create } from '@e07/poker-drop/rules/create.ts';

import { cardName, describeLevel } from './poker-drop-describe.ts';

describe('cardName', () => {
  it('names a card by its rank and suit letters', () => {
    expect([0, 12, 21, 51].map(cardName)).toStrictEqual(['2s', 'As', 'Th', 'Ac']);
  });
});

describe('describeLevel', () => {
  it('shows the goal, the hand and next card, the rising row interval and the well top row first', () => {
    const lines = describeLevel(create(1, 0)).split('\n');
    expect(lines[0]).toBe('goal 6 hand 9h next 9d rises every 8');
    expect(lines.slice(5)).toStrictEqual(['Th Qc Qh Td ..', 'Jc Kh Jd Kd ..']);
    expect(lines).toHaveLength(1 + 6);
  });
});
