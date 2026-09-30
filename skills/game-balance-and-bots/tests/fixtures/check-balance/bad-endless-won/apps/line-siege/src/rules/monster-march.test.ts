// apps/line-siege/src/rules/monster-march.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { TUNING, knobsFor } from './line-siege-tuning.ts';
import { march, spawn } from './monster-march.ts';

import type { Monster } from './line-siege-types.ts';

function monster(id: number, overrides: Partial<Monster> = {}): Monster {
  return { id, kind: 'normal', lane: 0, row: 0, hp: 5, ...overrides };
}

const EASY = knobsFor(0);

describe('march', () => {
  it('steps every monster one row toward the wall on a march placement (spec 13)', () => {
    const result = march({ monsters: [monster(1, { row: 2 })], hearts: 3 }, EASY.marchEvery, EASY);
    expect(result.events).toStrictEqual([
      { kind: 'monster-moved', monsterId: 1, fromRow: 2, toRow: 3 },
    ]);
    expect(result.monsters).toStrictEqual([monster(1, { row: 3 })]);
    expect(result.hearts).toBe(3);
  });

  it('keeps the monsters where they are between march placements', () => {
    const start = { monsters: [monster(1)], hearts: 3 };
    expect(march(start, EASY.marchEvery - 1, EASY)).toStrictEqual({ ...start, events: [] });
  });

  it('moves a fast monster two rows per march', () => {
    const result = march({ monsters: [monster(1, { kind: 'fast' })], hearts: 3 }, 6, EASY);
    expect(result.monsters[0]?.row).toBe(TUNING.fastStep);
  });

  it('takes a heart for each monster that breaks through the wall and removes it', () => {
    const edge = TUNING.laneRows - 1;
    const result = march(
      {
        monsters: [monster(1, { row: edge, lane: 4 }), monster(2, { row: edge, kind: 'armoured' })],
        hearts: 3,
      },
      6,
      EASY,
    );
    expect(result.events.slice(2)).toStrictEqual([
      { kind: 'wall-breached', monsterId: 1, monsterKind: 'normal', lane: 4, heartsLeft: 2 },
      { kind: 'wall-breached', monsterId: 2, monsterKind: 'armoured', lane: 0, heartsLeft: 1 },
    ]);
    expect(result.monsters).toStrictEqual([]);
    expect(result.hearts).toBe(1);
  });

  it('stops taking hearts at zero', () => {
    const edge = TUNING.laneRows - 1;
    const monsters = [1, 2, 3, 4].map((id) => monster(id, { row: edge }));
    expect(march({ monsters, hearts: 2 }, 6, EASY).hearts).toBe(0);
  });
});

describe('spawn', () => {
  const base = { monsters: [monster(1)], nextId: 2, spawned: 1, rng: seedRng(5) };

  it('brings in a new monster at the far end of a seeded lane on a spawn placement', () => {
    const result = spawn(base, { placements: EASY.spawnEvery, difficulty: 0 });
    expect(result.monsters).toHaveLength(2);
    expect(result.monsters[1]).toMatchObject({ id: 2, kind: 'normal', row: 0 });
    expect(result.spawned).toBe(2);
    expect(result.nextId).toBe(3);
    expect(result.events).toStrictEqual([
      {
        kind: 'monster-spawned',
        monsterId: 2,
        monsterKind: 'normal',
        lane: result.monsters[1]?.lane,
        hp: result.monsters[1]?.hp,
      },
    ]);
  });

  it('brings the next monster at once when the lanes are empty', () => {
    const result = spawn({ ...base, monsters: [] }, { placements: 1, difficulty: 0 });
    expect(result.monsters).toHaveLength(1);
  });

  it('stops once the whole wave of the level has entered', () => {
    const full = { ...base, spawned: EASY.goal };
    expect(spawn(full, { placements: EASY.spawnEvery, difficulty: 0 })).toStrictEqual({
      ...full,
      events: [],
    });
  });

  it('keeps spawning in the endless run, with health rising over the run', () => {
    const endless = { ...base, spawned: 500 };
    const late = spawn(endless, { placements: TUNING.endlessHpEvery * 12, difficulty: 100 });
    expect(late.monsters).toHaveLength(2);
    expect(late.monsters[1]?.hp).toBeGreaterThanOrEqual(TUNING.endlessRow.hpMin + 12);
  });

  it('draws health inside the difficulty row and a kind the row allows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_294_967_295 }),
        fc.integer({ min: 0, max: 99 }),
        (seed, difficulty) => {
          const knobs = knobsFor(difficulty);
          const result = spawn(
            { ...base, rng: seedRng(seed) },
            { placements: knobs.spawnEvery, difficulty },
          );
          const born = result.monsters[1];
          expect(born?.hp).toBeGreaterThanOrEqual(knobs.hpMin);
          expect(born?.hp).toBeLessThanOrEqual(knobs.hpMax);
          expect(knobs.kinds[born?.kind ?? 'normal']).toBeGreaterThan(0);
          expect(born?.lane).toBeLessThan(TUNING.boardSize);
        },
      ),
    );
  });

  it('keeps the pinned monster for seed 5 at the hardest level row', () => {
    const result = spawn(base, { placements: 3, difficulty: 99 });
    expect(JSON.stringify(result.monsters[1])).toBe(GOLDEN_SEED_5_SPAWN);
  });
});

const GOLDEN_SEED_5_SPAWN = '{"id":2,"kind":"fast","lane":4,"row":0,"hp":6}';
