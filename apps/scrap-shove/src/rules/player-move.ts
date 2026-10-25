// apps/scrap-shove/src/rules/player-move.ts
// The player's half of a move: step to a free neighbour, wait, or step onto a heap and shove it
// one square further the same way; a heap shoved onto a robot crushes it (the twist).
import { beyond, heapAt, robotAt } from './floor-squares.ts';

import type { Cell, Floor, ScrapShoveEvent, ScrapShoveMove } from './scrap-shove-types.ts';

/** The floor after the player's part of a move, with its events in order. */
export type PlayerResult = { readonly floor: Floor; readonly events: readonly ScrapShoveEvent[] };

function shoveHeap(floor: Floor, square: Cell): PlayerResult {
  const heap = heapAt(floor, square);
  if (heap === null) throw new RangeError(`no heap to shove at ${JSON.stringify(square)}`);
  const target = beyond(floor.player, square);
  const victim = robotAt(floor, target);
  const heaps = floor.heaps.map((piece) =>
    piece.id === heap.id ? { ...piece, ...target, isShoved: true } : piece,
  );
  const robots = floor.robots.filter((robot) => robot !== victim);
  const shoved: ScrapShoveEvent = {
    kind: 'scrap-shoved',
    heapId: heap.id,
    from: square,
    to: target,
    byRobotId: null,
  };
  const events: ScrapShoveEvent[] = [shoved];
  if (victim !== null) {
    events.push({
      kind: 'robot-crushed',
      robotId: victim.id,
      robotKind: victim.kind,
      at: target,
      heapId: heap.id,
      isByPlayer: true,
    });
  }
  return { floor: { ...floor, heaps, robots }, events };
}

/** Applies the player's move to the floor (the move is already known to be legal). */
export function playerMove(floor: Floor, move: ScrapShoveMove): PlayerResult {
  if (move.kind === 'wait') return { floor, events: [{ kind: 'player-waited', at: floor.player }] };
  const to = { col: move.col, row: move.row };
  const stepped: ScrapShoveEvent = { kind: 'player-stepped', from: floor.player, to };
  const pushed = move.kind === 'shove' ? shoveHeap(floor, to) : { floor, events: [] };
  return { floor: { ...pushed.floor, player: to }, events: [stepped, ...pushed.events] };
}
