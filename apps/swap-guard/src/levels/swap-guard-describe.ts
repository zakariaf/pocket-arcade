// apps/swap-guard/src/levels/swap-guard-describe.ts
// A level start as readable text for the data goldens: the swap budget, then the board row by row:
// 'G' the guard, '.' an empty square, a spear as its facing in lower case (u r d l), an archer in
// upper case (U R D L) and a brute as 'B' (it strikes all around, so its facing never shows).
import type { EnemyKind, Facing, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

const FACING_LETTERS: Readonly<Record<Facing, string>> = {
  up: 'u',
  right: 'r',
  down: 'd',
  left: 'l',
};

function letterOf(kind: EnemyKind, facing: Facing): string {
  if (kind === 'brute') return 'B';
  const letter = FACING_LETTERS[facing];
  return kind === 'archer' ? letter.toUpperCase() : letter;
}

/** The golden text of a level start (the golden test adds the seed and the difficulty). */
export function describeLevel(state: SwapGuardState): string {
  const squares = Array.from({ length: state.size * state.size }, () => '.');
  squares[state.guard] = 'G';
  for (const enemy of state.enemies) squares[enemy.cell] = letterOf(enemy.kind, enemy.facing);
  const rows = Array.from({ length: state.size }, (_, row) =>
    squares.slice(row * state.size, (row + 1) * state.size).join(''),
  );
  return [`swaps ${String(state.maxSwaps)}`, ...rows].join('\n');
}
