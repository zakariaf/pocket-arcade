// apps/flock-tilt/src/rules/field-search.ts
// The breadth-first search over fields: create keeps only fields it wins inside the row's par band,
// and the level solver and the hints use the same moves through the engine. Nodes are flocks; a tilt
// that moves nothing gives the same key and is skipped, a lost sheep is a dead end.
import { bfsSolve } from '@e07/game-kit/solver/bfs-solve.ts';

import { DIRECTIONS, pennedCount, tiltField } from './tilt-field.ts';

import type { Blocker, Direction, Field, Flock } from './flock-tilt-types.ts';
import type { SearchProblem } from '@e07/game-kit/solver/search-problem.ts';

/** A shortest way to pen every sheep: its length is par. */
export type FieldSolution = { readonly par: number; readonly line: readonly Direction[] };

/** A search node: the flock, how many tilts reached it, and whether a sheep was lost on the way. */
type FlockNode = Flock & { readonly depth: number; readonly isLost: boolean };

function sortedCells(cells: readonly number[]): string {
  return [...cells]
    .sort((a, b) => a - b)
    .map((cell) => String.fromCharCode(48 + cell))
    .join('');
}

/**
 * Two flocks with the same key play out the same from here: sheep places, the number in the pen,
 * the number lost and the wolves' places. Ids do not matter (sheep are alike).
 */
export function fieldKey(flock: Flock): string {
  const onField = flock.sheep.filter((sheep) => sheep.status === 'field').map((s) => s.cell);
  const penned = pennedCount(flock.sheep);
  const lost = flock.sheep.filter((sheep) => sheep.status === 'lost').length;
  const wolves = flock.wolves.map((wolf) => wolf.cell);
  return `${sortedCells(onField)}/${String(penned)}/${String(lost)}|${sortedCells(wolves)}`;
}

function fieldProblem(field: Field, maxPar: number): SearchProblem<FlockNode, Direction> {
  return {
    start: { sheep: field.sheep, wolves: field.wolves, depth: 0, isLost: false },
    moves: () => DIRECTIONS,
    apply: (node, direction) => {
      const tilted = tiltField({ ...field, sheep: node.sheep, wolves: node.wolves }, direction);
      const isLost = tilted.losses.length > 0;
      return { sheep: tilted.sheep, wolves: tilted.wolves, depth: node.depth + 1, isLost };
    },
    isGoal: (node) => node.sheep.every((sheep) => sheep.status === 'penned'),
    isDeadEnd: (node) => node.isLost || node.depth > maxPar,
    key: fieldKey,
  };
}

/** How many times a line of tilts stops a sheep against another sheep (the twist). */
export function sheepBlocks(field: Field, line: readonly Direction[]): number {
  let flock: Flock = field;
  let blocks = 0;
  for (const direction of line) {
    const tilted = tiltField({ ...field, ...flock }, direction);
    const stopped = tilted.slides.filter((slide) => isSheepBlock(slide.animal, slide.stoppedBy));
    blocks += stopped.length;
    flock = tilted;
  }
  return blocks;
}

function isSheepBlock(animal: 'sheep' | 'wolf', stoppedBy: Blocker): boolean {
  return animal === 'sheep' && stoppedBy === 'sheep';
}

/** Breadth-first search for the fewest tilts that pen every sheep without losing one. */
export function solveField(field: Field, maxPar: number, maxNodes: number): FieldSolution | null {
  const result = bfsSolve(fieldProblem(field, maxPar), maxNodes);
  return result.kind === 'solved' ? { par: result.par, line: result.line } : null;
}
