// packages/game-kit/src/levels/levels-contract.ts
import { ENDLESS_DIFFICULTY, MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { verifyLine } from '@e07/game-kit/solver/verify-line.ts';

import type { LevelEntry, LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { SolvableEngine } from '@e07/game-kit/solver/search-problem.ts';

/** What the level contract test needs besides the LevelsSpec itself. */
export type LevelsContractInput<TState, TMove, TEvent> = {
  readonly levels: LevelsSpec<TState, TMove>;
  readonly engine: SolvableEngine<TState, TMove, TEvent> & {
    readonly create: (seed: number, difficulty: number) => TState;
  };
  /** From game.config.ts `levels`: the packs must match it exactly. */
  readonly config: { readonly packCount: number; readonly levelsPerPack: number };
  /** Node budget per level for the solver check (tooling may use more). */
  readonly maxNodes: number;
};

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function tableProblems<TState, TMove>(levels: LevelsSpec<TState, TMove>): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  levels.table.forEach((entry, index) => {
    if (entry.level !== index + 1)
      problems.push(
        `table[${String(index)}] is level ${String(entry.level)}, expected ${String(index + 1)}`,
      );
    if (entry.difficulty !== levels.difficultyFor(entry.level)) {
      problems.push(
        `level ${String(entry.level)} difficulty ${String(entry.difficulty)} differs from difficultyFor (${String(levels.difficultyFor(entry.level))})`,
      );
    }
    const key = `${String(entry.seed)}/${String(entry.difficulty)}`;
    if (seen.has(key)) problems.push(`level ${String(entry.level)} repeats seed/difficulty ${key}`);
    seen.add(key);
  });
  return problems;
}

function packProblems<TState, TMove>(
  levels: LevelsSpec<TState, TMove>,
  config: LevelsContractInput<TState, TMove, unknown>['config'],
): string[] {
  const problems: string[] = [];
  let next = 1;
  let previousStars = 0;
  for (const pack of levels.packs) {
    if (!KEBAB.test(pack.id)) problems.push(`pack id "${pack.id}" is not kebab-case`);
    if (pack.firstLevel !== next)
      problems.push(
        `pack ${pack.id} starts at ${String(pack.firstLevel)}, expected ${String(next)}`,
      );
    if (pack.levelCount !== config.levelsPerPack)
      problems.push(
        `pack ${pack.id} has ${String(pack.levelCount)} levels, game.config says ${String(config.levelsPerPack)}`,
      );
    if (pack.starsToUnlock < previousStars)
      problems.push(`pack ${pack.id} needs fewer stars than the pack before it`);
    previousStars = pack.starsToUnlock;
    next = pack.firstLevel + pack.levelCount;
  }
  if (levels.packs[0]?.starsToUnlock !== 0) problems.push('the first pack must need 0 stars');
  if (levels.packs.length !== config.packCount)
    problems.push(
      `${String(levels.packs.length)} packs, game.config says ${String(config.packCount)}`,
    );
  if (next - 1 !== levels.table.length)
    problems.push(
      `packs cover ${String(next - 1)} levels, the table has ${String(levels.table.length)}`,
    );
  return problems;
}

/** Levels and the daily stay on 0..99; the endless run, if any, is exactly ENDLESS_DIFFICULTY. */
function modeProblems<TState, TMove>(levels: LevelsSpec<TState, TMove>): string[] {
  const problems = levels.table
    .filter((entry) => entry.difficulty > MAX_LEVEL_DIFFICULTY)
    .map(
      (entry) =>
        `level ${String(entry.level)} difficulty ${String(entry.difficulty)} is above ${String(MAX_LEVEL_DIFFICULTY)} (${String(ENDLESS_DIFFICULTY)} is the endless run)`,
    );
  const { daily, endless } = levels;
  if (daily.kind === 'daily' && daily.difficulty > MAX_LEVEL_DIFFICULTY)
    problems.push(
      `the daily difficulty ${String(daily.difficulty)} is above ${String(MAX_LEVEL_DIFFICULTY)}`,
    );
  if (endless.kind === 'endless' && endless.difficulty !== ENDLESS_DIFFICULTY)
    problems.push(
      `the endless difficulty ${String(endless.difficulty)} is not ENDLESS_DIFFICULTY (${String(ENDLESS_DIFFICULTY)})`,
    );
  return problems;
}

function solverProblem<TState, TMove, TEvent>(
  input: LevelsContractInput<TState, TMove, TEvent>,
  entry: LevelEntry,
): string | null {
  const solver = input.levels.solver;
  if (solver === null) return null;
  const start = input.engine.create(entry.seed, entry.difficulty);
  const result = solver.solve(start, input.maxNodes);
  const name = `level ${String(entry.level)}`;
  if (result.kind !== 'solved') return `${name} is ${result.kind}`;
  const check = verifyLine(input.engine, start, result.line);
  if (check.kind !== 'wins') return `${name}: the solver line does not replay (${check.kind})`;
  if (entry.stars.kind === 'par' && entry.stars.par !== result.par) {
    return `${name} par ${String(entry.stars.par)} differs from the solver's ${String(result.par)}`;
  }
  return null;
}

/**
 * Every problem of a game's level data, or [] (spec 8.1, S8): numbered table, curve-consistent
 * difficulties on 0..99, an endless run at ENDLESS_DIFFICULTY, packs matching game.config, and with
 * a solver every level proven winnable by a line replayed through the real engine (at its recorded
 * par for par-rated levels; a witness line for score-rated ones).
 */
export function levelsContractProblems<TState, TMove, TEvent>(
  input: LevelsContractInput<TState, TMove, TEvent>,
): readonly string[] {
  const solved = input.levels.table
    .map((entry) => solverProblem(input, entry))
    .filter((problem): problem is string => problem !== null);
  return [
    ...tableProblems(input.levels),
    ...modeProblems(input.levels),
    ...packProblems(input.levels, input.config),
    ...solved,
  ];
}
