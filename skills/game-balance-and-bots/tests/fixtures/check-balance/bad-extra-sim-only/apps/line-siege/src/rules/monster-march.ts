// apps/line-siege/src/rules/monster-march.ts
// Spec 13 (line-siege): "the monsters then step toward the wall, and each one that breaks through
// costs a heart". How often they step and spawn is a tuning knob (the sims set the pace).
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { TUNING, knobsFor } from './line-siege-tuning.ts';

import type { DifficultyKnobs, KindWeights } from './line-siege-tuning.ts';
import type { LineSiegeEvent, Monster, MonsterKind } from './line-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

export type Front = { readonly monsters: readonly Monster[]; readonly hearts: number };
type Events = { readonly events: readonly LineSiegeEvent[] };

function stepOf(monster: Monster): number {
  return monster.kind === 'fast' ? TUNING.fastStep : 1;
}

/** Every marchEvery-th placement all monsters step; one past the last lane row breaks the wall. */
export function march(front: Front, placements: number, knobs: DifficultyKnobs): Front & Events {
  if (placements % knobs.marchEvery !== 0) return { ...front, events: [] };
  const events: LineSiegeEvent[] = [];
  const moved = front.monsters.map((monster) => {
    const toRow = monster.row + stepOf(monster);
    events.push({ kind: 'monster-moved', monsterId: monster.id, fromRow: monster.row, toRow });
    return { ...monster, row: toRow };
  });
  let hearts = front.hearts;
  for (const monster of moved.filter((item) => item.row >= TUNING.laneRows)) {
    hearts = Math.max(hearts - 1, 0);
    events.push({
      kind: 'wall-breached',
      monsterId: monster.id,
      monsterKind: monster.kind,
      lane: monster.lane,
      heartsLeft: hearts,
    });
  }
  return { monsters: moved.filter((item) => item.row < TUNING.laneRows), hearts, events };
}

export type Spawner = {
  readonly monsters: readonly Monster[];
  readonly nextId: number;
  readonly spawned: number;
  readonly rng: RngState;
};

export type SpawnTime = { readonly placements: number; readonly difficulty: number };

function kindFrom(weights: KindWeights, roll: number): MonsterKind {
  if (roll < weights.normal) return 'normal';
  return roll < weights.normal + weights.armoured ? 'armoured' : 'fast';
}

function isDue(spawner: Spawner, when: SpawnTime, knobs: DifficultyKnobs): boolean {
  const hasWaveLeft = isEndlessDifficulty(when.difficulty) || spawner.spawned < knobs.goal;
  const isOnTime = when.placements % knobs.spawnEvery === 0 || spawner.monsters.length === 0;
  return hasWaveLeft && isOnTime;
}

/** A new monster at the far end of a random lane, when the wave has more and it is time. */
export function spawn(spawner: Spawner, when: SpawnTime): Spawner & Events {
  const knobs = knobsFor(when.difficulty);
  if (!isDue(spawner, when, knobs)) return { ...spawner, events: [] };
  const weights = knobs.kinds;
  const lane = nextInt(spawner.rng, TUNING.boardSize);
  const kind = nextInt(lane.state, weights.normal + weights.armoured + weights.fast);
  const health = nextInt(kind.state, knobs.hpMax - knobs.hpMin + 1);
  const ramp = isEndlessDifficulty(when.difficulty)
    ? Math.floor(when.placements / TUNING.endlessHpEvery)
    : 0;
  const monster: Monster = {
    id: spawner.nextId,
    kind: kindFrom(weights, kind.value),
    lane: lane.value,
    row: 0,
    hp: knobs.hpMin + health.value + ramp,
  };
  return {
    monsters: [...spawner.monsters, monster],
    nextId: spawner.nextId + 1,
    spawned: spawner.spawned + 1,
    rng: health.state,
    events: [
      {
        kind: 'monster-spawned',
        monsterId: monster.id,
        monsterKind: monster.kind,
        lane: monster.lane,
        hp: monster.hp,
      },
    ],
  };
}
