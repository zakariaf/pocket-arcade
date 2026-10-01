// apps/line-siege/src/rules/monster-attack.test.ts
import fc from 'fast-check';

import { attack } from './monster-attack.ts';

import type { Monster } from './line-siege-types.ts';

function monster(id: number, overrides: Partial<Monster> = {}): Monster {
  return { id, kind: 'normal', lane: 0, row: 0, hp: 5, ...overrides };
}

describe('attack', () => {
  describe('when a column is cleared (spec 13: 8 damage to the lowest monster)', () => {
    it('fires a beam up the lane at the monster closest to the wall', () => {
      const far = monster(1, { lane: 3, row: 0, hp: 9 });
      const near = monster(2, { lane: 3, row: 4, hp: 9 });
      const result = attack([far, near], { rows: [], cols: [3] });
      expect(result.events).toStrictEqual([
        { kind: 'beam-fired', lane: 3, targetId: 2 },
        { kind: 'monster-hit', monsterId: 2, damage: 8, hpLeft: 1 },
      ]);
      expect(result.monsters).toStrictEqual([far, { ...near, hp: 1 }]);
      expect(result.defeated).toBe(0);
    });

    it('fires into an empty lane without hitting anything', () => {
      const result = attack([monster(1, { lane: 2 })], { rows: [], cols: [5] });
      expect(result.events).toStrictEqual([{ kind: 'beam-fired', lane: 5, targetId: null }]);
    });

    it('defeats a monster whose health the beam uses up, and reports where it stood', () => {
      const result = attack([monster(4, { lane: 1, row: 2, hp: 8 })], { rows: [], cols: [1] });
      expect(result.events).toStrictEqual([
        { kind: 'beam-fired', lane: 1, targetId: 4 },
        { kind: 'monster-hit', monsterId: 4, damage: 8, hpLeft: 0 },
        { kind: 'monster-defeated', monsterId: 4, monsterKind: 'normal', lane: 1, row: 2 },
      ]);
      expect(result.monsters).toStrictEqual([]);
      expect(result.defeated).toBe(1);
    });

    it('prefers the lower id when two monsters stand on the same lane row', () => {
      const result = attack([monster(7, { hp: 20 }), monster(3, { hp: 20 })], {
        rows: [],
        cols: [0],
      });
      expect(result.events[0]).toStrictEqual({ kind: 'beam-fired', lane: 0, targetId: 3 });
    });
  });

  describe('when rows are cleared (spec 13: a shockwave hits every monster for 2)', () => {
    it('hits every monster once per cleared row, but bounces off armoured ones', () => {
      const plain = monster(1, { lane: 0, hp: 5 });
      const armoured = monster(2, { lane: 1, hp: 5, kind: 'armoured' });
      const result = attack([plain, armoured], { rows: [3, 4], cols: [] });
      expect(result.events).toStrictEqual([
        { kind: 'shockwave-sent', rows: 2, damage: 4 },
        { kind: 'monster-hit', monsterId: 1, damage: 4, hpLeft: 1 },
      ]);
      expect(result.monsters).toStrictEqual([{ ...plain, hp: 1 }, armoured]);
    });

    it('sends the beams first, so a monster the beam defeated takes no shockwave', () => {
      const result = attack([monster(1, { hp: 8 }), monster(2, { lane: 5, hp: 2 })], {
        rows: [0],
        cols: [0],
      });
      expect(result.events.map((event) => event.kind)).toStrictEqual([
        'beam-fired',
        'monster-hit',
        'shockwave-sent',
        'monster-hit',
        'monster-defeated',
        'monster-defeated',
      ]);
      expect(result.defeated).toBe(2);
    });
  });

  it('keeps health from rising and removes every monster at 0 health', () => {
    const monsterArb = fc.record({
      id: fc.nat(50),
      kind: fc.constantFrom('normal' as const, 'armoured' as const, 'fast' as const),
      lane: fc.integer({ min: 0, max: 7 }),
      row: fc.integer({ min: 0, max: 5 }),
      hp: fc.integer({ min: 1, max: 12 }),
    });
    const linesArb = fc.record({
      rows: fc.uniqueArray(fc.integer({ min: 0, max: 7 })),
      cols: fc.uniqueArray(fc.integer({ min: 0, max: 7 })),
    });
    fc.assert(
      fc.property(fc.array(monsterArb, { maxLength: 8 }), linesArb, (monsters, lines) => {
        const result = attack(monsters, lines);
        expect(result.monsters.every((left) => left.hp > 0)).toBe(true);
        expect(result.monsters.length + result.defeated).toBe(monsters.length);
      }),
    );
  });

  it('keeps the pinned event line of a double clear', () => {
    const result = attack([monster(1, { lane: 2, row: 3, hp: 10 }), monster(2, { lane: 6 })], {
      rows: [1],
      cols: [2, 6],
    });
    expect(result.events.map((event) => event.kind).join(' ')).toBe(GOLDEN_DOUBLE_CLEAR);
  });
});

const GOLDEN_DOUBLE_CLEAR =
  'beam-fired monster-hit beam-fired monster-hit shockwave-sent monster-hit monster-defeated monster-defeated';
