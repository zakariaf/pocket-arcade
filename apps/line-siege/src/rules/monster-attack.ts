// apps/line-siege/src/rules/monster-attack.ts
// Spec 13 (line-siege): "A cleared column shoots its lane (8 damage to the lowest monster); a
// cleared row sends a shockwave that hits every monster for 2". Beams go first, column by
// column; then one shockwave carries the damage of every cleared row. Armoured monsters shrug
// off shockwaves. Monsters at 0 health are defeated after both.
import { TUNING } from './line-siege-tuning.ts';

import type { FullLines } from './board-lines.ts';
import type { LineSiegeEvent, Monster } from './line-siege-types.ts';

export type Attack = {
  readonly monsters: readonly Monster[];
  readonly events: readonly LineSiegeEvent[];
  readonly defeated: number;
};

/** The living monster of a lane closest to the wall (the lower id on a tie). */
function lowestIn(monsters: readonly Monster[], lane: number): Monster | undefined {
  return monsters
    .filter((monster) => monster.lane === lane && monster.hp > 0)
    .reduce<Monster | undefined>((low, monster) => {
      if (low === undefined || monster.row > low.row) return monster;
      return monster.row === low.row && monster.id < low.id ? monster : low;
    }, undefined);
}

function hit(monster: Monster, damage: number): { monster: Monster; event: LineSiegeEvent } {
  const hp = Math.max(monster.hp - damage, 0);
  return {
    monster: { ...monster, hp },
    event: { kind: 'monster-hit', monsterId: monster.id, damage, hpLeft: hp },
  };
}

function fireBeams(
  monsters: readonly Monster[],
  cols: readonly number[],
  events: LineSiegeEvent[],
) {
  let current = monsters;
  for (const lane of cols) {
    const target = lowestIn(current, lane);
    events.push({ kind: 'beam-fired', lane, targetId: target?.id ?? null });
    if (target === undefined) continue;
    const result = hit(target, TUNING.beamDamage);
    events.push(result.event);
    current = current.map((monster) => (monster.id === target.id ? result.monster : monster));
  }
  return current;
}

function sendShockwave(monsters: readonly Monster[], rows: number, events: LineSiegeEvent[]) {
  if (rows === 0) return monsters;
  const damage = TUNING.shockDamage * rows;
  events.push({ kind: 'shockwave-sent', rows, damage });
  return monsters.map((monster) => {
    if (monster.hp <= 0 || monster.kind === 'armoured') return monster;
    const result = hit(monster, damage);
    events.push(result.event);
    return result.monster;
  });
}

/** Beams up the cleared columns, one shockwave for the cleared rows, then the defeats. */
export function attack(monsters: readonly Monster[], lines: FullLines): Attack {
  const events: LineSiegeEvent[] = [];
  const beamed = fireBeams(monsters, lines.cols, events);
  const shocked = sendShockwave(beamed, lines.rows.length, events);
  const fallen = shocked.filter((monster) => monster.hp <= 0);
  for (const monster of fallen) {
    events.push({
      kind: 'monster-defeated',
      monsterId: monster.id,
      monsterKind: monster.kind,
      lane: monster.lane,
      row: monster.row,
    });
  }
  return {
    monsters: shocked.filter((monster) => monster.hp > 0),
    events,
    defeated: fallen.length,
  };
}
