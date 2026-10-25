// apps/flock-tilt/src/rules/tilt-field.ts
// The one physical rule of Flock Tilt (spec 13): tilt the whole field and every animal slides,
// the one nearest the fence first, until the fence, a rock or another animal stops it. A sheep
// that reaches the pen drops in; a wolf treats the pen like a rock. Afterwards a sheep that touches
// a wolf along the tilt (in front of it or right behind it) is lost. create's search runs this
// thousands of times per field, so it is written with plain loops.
import type { Blocker, Direction, Field, Flock, Sheep, Slide, Wolf } from './flock-tilt-types.ts';

/** The four tilts in their fixed order (bots, solvers and replays depend on it). */
export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

/** A sheep that ended a tilt against a wolf. */
export type Loss = {
  readonly sheepId: number;
  readonly cell: number;
  readonly wolfId: number;
  readonly wolfCell: number;
};

/** The flock after one tilt, with what moved, which sheep dropped into the pen and which were lost. */
export type Tilted = Flock & {
  readonly slides: readonly Slide[];
  /** Ids of the sheep that dropped into the pen, in the order they did. */
  readonly penned: readonly number[];
  readonly losses: readonly Loss[];
};

/** One cell's move as (columns, rows). */
type Step = readonly [number, number];

/** Physical steps (swipes never mirror): one cell per direction. */
export const STEP: Readonly<Record<Direction, Step>> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

type Occupant = 'sheep' | 'wolf' | 'rock' | null;

/** An animal about to slide: its kind, its place in the field's list, its id, cell and lead. */
type Mover = {
  readonly animal: 'sheep' | 'wolf';
  readonly index: number;
  readonly id: number;
  readonly cell: number;
  /** How far the cell lies in the tilt's direction: the larger, the earlier it moves. */
  readonly lead: number;
};

type End = { readonly cell: number; readonly stoppedBy: Blocker; readonly isPenned: boolean };

/** One tilt in progress: the field, the step and what stands where right now. */
type Tilt = {
  readonly field: Field;
  readonly step: Step;
  readonly back: Step;
  readonly ground: Occupant[];
};

/** Where every animal ended (by index), what moved and which sheep dropped into the pen. */
type Ends = {
  readonly sheep: number[];
  readonly wolves: number[];
  readonly slides: Slide[];
  readonly penned: number[];
};

/** A cell index as its (column, row) on a field `cols` wide. */
export function colRow(cell: number, cols: number): [number, number] {
  return [cell % cols, Math.floor(cell / cols)];
}

/** The cell one step away, or -1 past the fence. */
function stepBy(field: Pick<Field, 'cols' | 'rows'>, cell: number, step: Step): number {
  const [dx, dy] = step;
  const col = (cell % field.cols) + dx;
  const row = Math.floor(cell / field.cols) + dy;
  return col < 0 || row < 0 || col >= field.cols || row >= field.rows ? -1 : row * field.cols + col;
}

/** The neighbouring cell in a direction, or -1 past the fence. */
export function stepFrom(
  field: Pick<Field, 'cols' | 'rows'>,
  cell: number,
  direction: Direction,
): number {
  return stepBy(field, cell, STEP[direction]);
}

/** What stands on each cell before the tilt (the pen is always free). */
function groundOf(field: Field): Occupant[] {
  const ground = new Array<Occupant>(field.cols * field.rows).fill(null);
  for (const rock of field.rocks) ground[rock] = 'rock';
  for (const sheep of field.sheep) if (sheep.status === 'field') ground[sheep.cell] = 'sheep';
  for (const wolf of field.wolves) ground[wolf.cell] = 'wolf';
  return ground;
}

function leadOf(tilt: Tilt, cell: number): number {
  const [dx, dy] = tilt.step;
  return (cell % tilt.field.cols) * dx + Math.floor(cell / tilt.field.cols) * dy;
}

/** The animal nearest the fence first; ties (different lanes) by kind, then by index. */
function compareMovers(a: Mover, b: Mover): number {
  if (a.lead !== b.lead) return b.lead - a.lead;
  if (a.animal !== b.animal) return a.animal === 'sheep' ? -1 : 1;
  return a.index - b.index;
}

function moversOf(tilt: Tilt): Mover[] {
  const movers: Mover[] = [];
  tilt.field.sheep.forEach((one, index) => {
    if (one.status !== 'field') return;
    movers.push({
      animal: 'sheep',
      index,
      id: one.id,
      cell: one.cell,
      lead: leadOf(tilt, one.cell),
    });
  });
  tilt.field.wolves.forEach((one, index) => {
    movers.push({
      animal: 'wolf',
      index,
      id: one.id,
      cell: one.cell,
      lead: leadOf(tilt, one.cell),
    });
  });
  return movers.sort(compareMovers);
}

/** Slides one animal cell by cell until something stops it. */
function slideOne(tilt: Tilt, mover: Mover): End {
  let cell = mover.cell;
  for (;;) {
    const next = stepBy(tilt.field, cell, tilt.step);
    if (next < 0) return { cell, stoppedBy: 'fence', isPenned: false };
    const occupant = tilt.ground[next] ?? null;
    if (occupant !== null) return { cell, stoppedBy: occupant, isPenned: false };
    if (next === tilt.field.pen) {
      const isPenned = mover.animal === 'sheep';
      return { cell: isPenned ? next : cell, stoppedBy: 'pen', isPenned };
    }
    cell = next;
  }
}

/** Records where one animal ended and whether it moved or dropped into the pen. */
function recordEnd(ends: Ends, mover: Mover, end: End): void {
  const { animal, id } = mover;
  if (end.isPenned) ends.penned.push(id);
  if (end.cell !== mover.cell) {
    ends.slides.push({ animal, id, from: mover.cell, to: end.cell, stoppedBy: end.stoppedBy });
  }
  const cells = animal === 'sheep' ? ends.sheep : ends.wolves;
  cells[mover.index] = end.cell;
}

/** Moves every animal in order, keeping the ground current so the flock piles up. */
function slideAll(tilt: Tilt): Ends {
  const { field, ground } = tilt;
  const ends: Ends = {
    sheep: field.sheep.map((one) => one.cell),
    wolves: field.wolves.map((one) => one.cell),
    slides: [],
    penned: [],
  };
  for (const mover of moversOf(tilt)) {
    const end = slideOne(tilt, mover);
    ground[mover.cell] = null;
    if (!end.isPenned) ground[end.cell] = mover.animal;
    recordEnd(ends, mover, end);
  }
  return ends;
}

/** The wolf on a cell, if any. */
function wolfOn(wolves: readonly Wolf[], cell: number): Wolf | undefined {
  return cell < 0 ? undefined : wolves.find((wolf) => wolf.cell === cell);
}

/** Every sheep still on the field that touches a wolf along the tilt, in id order (wolf in front first). */
function lossesOf(tilt: Tilt, ends: Ends, wolves: readonly Wolf[]): Loss[] {
  const losses: Loss[] = [];
  tilt.field.sheep.forEach((one, index) => {
    const cell = ends.sheep[index] ?? one.cell;
    if (one.status !== 'field' || cell === tilt.field.pen) return;
    const ahead = stepBy(tilt.field, cell, tilt.step);
    const behind = stepBy(tilt.field, cell, tilt.back);
    const wolf = wolfOn(wolves, ahead) ?? wolfOn(wolves, behind);
    if (wolf !== undefined) {
      losses.push({ sheepId: one.id, cell, wolfId: wolf.id, wolfCell: wolf.cell });
    }
  });
  return losses;
}

/** The sheep after the slide: moved, dropped into the pen, or lost to a wolf. */
function sheepAfter(field: Field, ends: Ends, losses: readonly Loss[]): Sheep[] {
  return field.sheep.map((one, index): Sheep => {
    if (one.status !== 'field') return one;
    const cell = ends.sheep[index] ?? one.cell;
    if (cell === field.pen) return { ...one, cell, status: 'penned' };
    const isLost = losses.some((loss) => loss.sheepId === one.id);
    return { ...one, cell, status: isLost ? 'lost' : 'field' };
  });
}

/** Tilts the whole field one way: every animal slides until something stops it. Pure. */
export function tiltField(field: Field, direction: Direction): Tilted {
  const [dx, dy] = STEP[direction];
  const tilt: Tilt = { field, step: [dx, dy], back: [-dx, -dy], ground: groundOf(field) };
  const ends = slideAll(tilt);
  const wolves = field.wolves.map((one, index) => ({
    ...one,
    cell: ends.wolves[index] ?? one.cell,
  }));
  const losses = lossesOf(tilt, ends, wolves);
  const sheep = sheepAfter(field, ends, losses);
  return { sheep, wolves, slides: ends.slides, penned: ends.penned, losses };
}
