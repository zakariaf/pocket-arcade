// apps/flock-tilt/src/rules/field-text.ts
// A field as a small text map, for tests, goldens, example states and the tutorial:
// '.' grass, '#' rock, 'o' the pen, 's' a sheep, 'w' a wolf, 'x' a lost sheep (drawn only).
import type { Field, Sheep, Wolf } from './flock-tilt-types.ts';

type Parsed = {
  readonly rocks: number[];
  readonly pens: number[];
  readonly sheep: Sheep[];
  readonly wolves: Wolf[];
};

function readSign(parsed: Parsed, sign: string, cell: number): void {
  if (sign === '#') parsed.rocks.push(cell);
  else if (sign === 'o') parsed.pens.push(cell);
  else if (sign === 's') parsed.sheep.push({ id: parsed.sheep.length, cell, status: 'field' });
  else if (sign === 'w') parsed.wolves.push({ id: parsed.wolves.length, cell });
  else if (sign !== '.') throw new RangeError(`unknown sign "${sign}" in a field map`);
}

/** Reads a text map (one string per row); sheep and wolves get ids in reading order. */
export function parseField(lines: readonly string[]): Field {
  const cols = lines[0]?.length ?? 0;
  if (lines.some((line) => line.length !== cols)) throw new RangeError('rows of different length');
  const parsed: Parsed = { rocks: [], pens: [], sheep: [], wolves: [] };
  lines.forEach((line, row) => {
    for (let col = 0; col < cols; col += 1) readSign(parsed, line.charAt(col), row * cols + col);
  });
  const [pen] = parsed.pens;
  if (pen === undefined || parsed.pens.length !== 1) throw new RangeError('a field has one pen');
  const { rocks, sheep, wolves } = parsed;
  return { cols, rows: lines.length, rocks, pen, sheep, wolves };
}

/** Draws a field as a text map, one line per row. */
export function fieldText(field: Field): string {
  const signs = Array.from({ length: field.cols * field.rows }, () => '.');
  for (const rock of field.rocks) signs[rock] = '#';
  signs[field.pen] = 'o';
  for (const wolf of field.wolves) signs[wolf.cell] = 'w';
  for (const sheep of field.sheep) {
    if (sheep.status !== 'penned') signs[sheep.cell] = sheep.status === 'lost' ? 'x' : 's';
  }
  return Array.from({ length: field.rows }, (_, row) =>
    signs.slice(row * field.cols, (row + 1) * field.cols).join(''),
  ).join('\n');
}
