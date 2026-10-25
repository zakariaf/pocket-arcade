// apps/stepstone/src/rules/lay-pond.ts
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { hopDistance } from './hop-distance.ts';
import { isMoveKind, reachOf } from './hops.ts';

import type { DifficultyKnobs } from './stepstone-tuning.ts';
import type { Cell, MoveKind, StepstoneState } from './stepstone-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A pond being laid: null cells are still free. */
type Draft = (Cell | null)[];

type Laid = { readonly state: StepstoneState; readonly rng: RngState };

/** The row's kinds from a seeded offset, the previous hop's kind last (routes change kind). */
function kindOrder(
  kinds: readonly MoveKind[],
  offset: number,
  previous: MoveKind | null,
): MoveKind[] {
  const turned = [...kinds.slice(offset), ...kinds.slice(0, offset)];
  return [
    ...turned.filter((kind) => kind !== previous),
    ...turned.filter((kind) => kind === previous),
  ];
}

type Hop = { readonly kind: MoveKind; readonly target: number; readonly rng: RngState };

/** Where the route stands: its last cell, the kind of the hop before, the stream to draw from. */
type RouteEnd = {
  readonly cell: number;
  readonly previous: MoveKind | null;
  readonly rng: RngState;
};

/** The next route hop from the route's end onto a free cell, or null when no kind reaches one. */
function pickHop(draft: Draft, end: RouteEnd, knobs: DifficultyKnobs): Hop | null {
  const offset = nextInt(end.rng, knobs.kinds.length);
  for (const kind of kindOrder(knobs.kinds, offset.value, end.previous)) {
    const free = reachOf(knobs.side, end.cell, kind).filter((target) => draft[target] === null);
    if (free.length === 0) continue;
    const pick = nextInt(offset.state, free.length);
    return { kind, target: pickAt(free, pick.value), rng: pick.state };
  }
  return null;
}

/**
 * Lays the route first: from a seeded start, `routeHops` hops onto fresh cells, each stone given
 * the kind of the hop taken from it, the last cell the flag. The pond is solvable by construction.
 */
function layRoute(
  knobs: DifficultyKnobs,
  start: RngState,
): { draft: Draft; frog: number; rng: RngState } {
  const draft: Draft = Array.from({ length: knobs.side * knobs.side }, () => null);
  const first = nextInt(start, draft.length);
  let end: RouteEnd = { cell: first.value, previous: null, rng: first.state };
  for (let hop = 0; hop < knobs.routeHops; hop += 1) {
    const next = pickHop(draft, end, knobs);
    if (next === null) break;
    draft[end.cell] = next.kind;
    end = { cell: next.target, previous: next.kind, rng: next.rng };
  }
  draft[end.cell] = 'flag';
  return { draft, frog: first.value, rng: end.rng };
}

/** Free cells a route stone's own hop reaches: where a tempting side hop can sit. */
function sideCells(draft: Draft, side: number): number[] {
  const out = new Set<number>();
  draft.forEach((cell, index) => {
    if (cell === null || !isMoveKind(cell)) return;
    for (const target of reachOf(side, index, cell)) if (draft[target] === null) out.add(target);
  });
  return [...out].sort((a, b) => a - b);
}

/** King steps between two cells of the pond. */
function steps(side: number, a: number, b: number): number {
  const rows = Math.abs(Math.floor(a / side) - Math.floor(b / side));
  return Math.max(rows, Math.abs((a % side) - (b % side)));
}

/** The half of the side cells nearest the flag: where a stone looks like a step forward. */
function luringCells(draft: Draft, side: number): number[] {
  const flag = draft.indexOf('flag');
  const nearerFirst = (a: number, b: number): number => {
    const byDistance = steps(side, a, flag) - steps(side, b, flag);
    return byDistance !== 0 ? byDistance : a - b;
  };
  const free = sideCells(draft, side).sort(nearerFirst);
  return free.slice(0, Math.floor((free.length + 1) / 2));
}

/** True when a hop of this kind from `cell` reaches no stone but `except` (it strands the frog). */
function strands(
  draft: Draft,
  side: number,
  hop: { cell: number; kind: MoveKind; except: number },
): boolean {
  return reachOf(side, hop.cell, hop.kind).every(
    (target) => target === hop.except || draft[target] === null || draft[target] === 'water',
  );
}

type Trap = {
  readonly lure: number;
  readonly lureKind: MoveKind;
  readonly end: number;
  readonly endKind: MoveKind;
};

/**
 * A two-hop trap from the lure cell: a lure kind whose only stone in reach will be the end stone,
 * and an end kind that strands the frog there (the lure has sunk by then). Kinds are tried in the
 * seeded order; null when no pair fits.
 */
function trapAt(
  draft: Draft,
  at: { lure: number; offset: number },
  knobs: DifficultyKnobs,
): Trap | null {
  const { lure } = at;
  const order = kindOrder(knobs.kinds, at.offset, null);
  for (const lureKind of order) {
    if (!strands(draft, knobs.side, { cell: lure, kind: lureKind, except: -1 })) continue;
    for (const end of reachOf(knobs.side, lure, lureKind).filter((cell) => draft[cell] === null)) {
      const endKind = order.find((kind) =>
        strands(draft, knobs.side, { cell: end, kind, except: lure }),
      );
      if (endKind !== undefined) return { lure, lureKind, end, endKind };
    }
  }
  return null;
}

/**
 * Adds up to `decoys` two-hop traps beside the route, nearer the flag, where a route stone's hop
 * reaches the lure: a stone that looks like a step forward and leads only to a stone that strands
 * the frog, which a player sees by reading two stones ahead. Every other free cell is open water.
 */
function addDecoys(
  draft: Draft,
  knobs: DifficultyKnobs,
  start: RngState,
): { cells: Cell[]; rng: RngState } {
  let rng = start;
  const cells = [...draft];
  for (let decoy = 0; decoy < knobs.decoys; decoy += 1) {
    const free = luringCells(cells, knobs.side);
    if (free.length === 0) break;
    const where = nextInt(rng, free.length);
    const kind = nextInt(where.state, knobs.kinds.length);
    rng = kind.state;
    const trap = trapAt(cells, { lure: pickAt(free, where.value), offset: kind.value }, knobs);
    if (trap === null) continue;
    cells[trap.lure] = trap.lureKind;
    cells[trap.end] = trap.endKind;
  }
  return { cells: cells.map((cell): Cell => cell ?? 'water'), rng };
}

/** One seeded pond with its par (the shortest route, found by hopDistance). */
export function layPond(knobs: DifficultyKnobs, start: RngState): Laid {
  const route = layRoute(knobs, start);
  const { cells, rng } = addDecoys(route.draft, knobs, route.rng);
  const startKind = pickAt(cells, route.frog);
  const pond = { side: knobs.side, cells, frog: route.frog };
  const state: StepstoneState = {
    ...pond,
    moves: 0,
    par: hopDistance(pond) ?? 0,
    kindsUsed: isMoveKind(startKind) ? [startKind] : [],
  };
  return { state, rng };
}
