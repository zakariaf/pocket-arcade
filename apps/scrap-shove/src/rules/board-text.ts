// apps/scrap-shove/src/rules/board-text.ts
// A floor as text, one line per row: '@' the player, 'n' 'f' 'h' a normal, fast or heavy robot,
// '#' a heap, '*' a heap the player shoved, 'X' a robot on the player (caught), '.' empty. The level
// goldens, the tutorial's example floors and the rules tests read and write floors this way.
import { isSameCell } from './floor-squares.ts';

import type { Cell, Floor, Heap, Robot, RobotKind, ScrapShoveState } from './scrap-shove-types.ts';

const ROBOT_LETTERS = { n: 'normal', f: 'fast', h: 'heavy' } as const satisfies Record<
  string,
  RobotKind
>;

const LETTER_OF_KIND = { normal: 'n', fast: 'f', heavy: 'h' } as const satisfies Record<
  RobotKind,
  string
>;

type Parsed = { readonly player: Cell | null; readonly robots: Robot[]; readonly heaps: Heap[] };

function isRobotLetter(letter: string): letter is keyof typeof ROBOT_LETTERS {
  return letter in ROBOT_LETTERS;
}

function readSquare(parsed: Parsed, letter: string, cell: Cell): Parsed {
  const id = parsed.robots.length + parsed.heaps.length + 1;
  if (letter === '@') return { ...parsed, player: cell };
  if (letter === '#' || letter === '*') {
    return { ...parsed, heaps: [...parsed.heaps, { id, ...cell, isShoved: letter === '*' }] };
  }
  if (isRobotLetter(letter)) {
    return { ...parsed, robots: [...parsed.robots, { id, kind: ROBOT_LETTERS[letter], ...cell }] };
  }
  if (letter !== '.') throw new RangeError(`unknown floor letter "${letter}"`);
  return parsed;
}

/**
 * A playing state from a square picture (ids in reading order, robots and heaps sharing them).
 * Throws on a picture that is not square, has no player or an unknown letter: it is test and
 * tutorial data, never player input.
 */
export function stateFromText(lines: readonly string[]): ScrapShoveState {
  const side = lines.length;
  let parsed: Parsed = { player: null, robots: [], heaps: [] };
  lines.forEach((line, row) => {
    if (line.length !== side)
      throw new RangeError(`row ${String(row)} is not ${String(side)} wide`);
    for (let col = 0; col < side; col += 1)
      parsed = readSquare(parsed, line.charAt(col), { col, row });
  });
  if (parsed.player === null) throw new RangeError('the floor has no player');
  const { player, robots, heaps } = parsed;
  const nextId = robots.length + heaps.length + 1;
  return {
    cols: side,
    rows: side,
    player,
    robots,
    heaps,
    nextId,
    robotsTotal: robots.length,
    caughtBy: null,
    rescue: null,
    hasContinued: false,
  };
}

function letterAt(floor: Floor, cell: Cell): string {
  const robot = floor.robots.find((piece) => isSameCell(piece, cell));
  if (robot !== undefined) return isSameCell(floor.player, cell) ? 'X' : LETTER_OF_KIND[robot.kind];
  if (isSameCell(floor.player, cell)) return '@';
  const heap = floor.heaps.find((piece) => isSameCell(piece, cell));
  if (heap === undefined) return '.';
  return heap.isShoved ? '*' : '#';
}

/** The floor as text, one line per row (the inverse of stateFromText for a playing floor). */
export function boardText(floor: Floor, side: number): string {
  const rows: string[] = [];
  for (let row = 0; row < side; row += 1) {
    let line = '';
    for (let col = 0; col < side; col += 1) line += letterAt(floor, { col, row });
    rows.push(line);
  }
  return rows.join('\n');
}
