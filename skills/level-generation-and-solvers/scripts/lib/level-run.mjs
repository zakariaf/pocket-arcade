// level-run.mjs: runs the repo's real code: dailySeed and starsFor against their golden values, and
// each game's level plan through planLevelTable, compared with the committed pack files (values and
// bytes). Not an entry point.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { errorText } from './app-modules.mjs';
import { DAILY_GOLDENS, STAR_GOLDENS } from './level-checks.mjs';
import { createPackFormatter } from './pack-format.mjs';

export async function checkDailySeed(modules, report) {
  const rel = 'packages/game-kit/src/dates/daily-seed.ts';
  if (!modules.exists(rel)) return 0;
  let dailySeed;
  try {
    ({ dailySeed } = await modules.load(rel));
  } catch (error) {
    report.problem({ file: rel, line: 1, rule: 'daily-seed-golden', message: `daily-seed.ts cannot be loaded: ${errorText(error)}`, fix: 'Keep it free of imports other than the DateKey type (copy the template).' });
    return 1;
  }
  for (const golden of DAILY_GOLDENS) {
    const seed = dailySeed(golden.date, golden.salt);
    if (seed !== golden.seed) report.problem({ file: rel, line: 1, rule: 'daily-seed-golden', message: `dailySeed('${golden.date}', ${golden.salt}) is ${seed}, the golden value is ${golden.seed}`, fix: 'Restore daily-seed.ts from templates/packages/game-kit/src/dates/daily-seed.ts; the daily seed never changes (every player\'s daily level depends on it).' });
  }
  return 1;
}

/** Spec 8.1: 3 stars at or under par, 2 up to par + 2, 1 for finishing; score games by thresholds. */
export async function checkStarRule(modules, report) {
  const rel = 'packages/game-kit/src/levels/star-rating.ts';
  if (!modules.exists(rel)) return 0;
  let starsFor;
  try {
    ({ starsFor } = await modules.load(rel));
  } catch (error) {
    report.problem({ file: rel, line: 1, rule: 'star-rule', message: `star-rating.ts cannot be loaded: ${errorText(error)}`, fix: 'Keep it free of imports other than the contract types (copy the template).' });
    return 1;
  }
  for (const golden of STAR_GOLDENS) {
    const stars = starsFor(golden.rule, golden.run);
    if (stars !== golden.stars) report.problem({ file: rel, line: 1, rule: 'star-rule', message: `starsFor(${JSON.stringify(golden.rule)}, ${JSON.stringify(golden.run)}) is ${stars}, spec 8.1 gives ${golden.stars}`, fix: 'Restore star-rating.ts from templates/packages/game-kit/src/levels/star-rating.ts: 3 stars at or under par, 2 up to par + 2, 1 for finishing, 0 for a loss; score levels 2 and 3 at the upper thresholds.' });
  }
  return 1;
}

function firstDifference(expected, actual) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(expected[index]) !== JSON.stringify(actual[index])) {
      return `entry ${index}: committed ${JSON.stringify(actual[index] ?? null)}, the plan generates ${JSON.stringify(expected[index] ?? null)}`;
    }
  }
  return null;
}

/** Runs the game's plan headless: { packs, failures } from planLevelTable. Throws on a load error. */
export async function runPlan(modules, gameId) {
  const planRel = `apps/${gameId}/src/levels/${gameId}-level-plan.ts`;
  const planModule = await modules.load(planRel);
  const plan = Object.values(planModule).find((value) => value && typeof value === 'object' && typeof value.rate === 'function' && value.solver);
  if (!plan) throw new Error(`${planRel} exports no LevelPlan`);
  const { planLevelTable } = await modules.load('packages/game-kit/src/levels/plan-level-table.ts');
  return planLevelTable(plan);
}

/** Writes every pack the plan generates, formatted as generate-levels.ts does (the self-test's repos). */
export async function writePacks(root, modules, gameId) {
  const { packs, failures } = await runPlan(modules, gameId);
  if (failures.length > 0) throw new Error(`${gameId}: ${failures.length} levels without a candidate`);
  const formatter = await createPackFormatter(root);
  for (const [index, pack] of packs.entries()) {
    const rel = `apps/${gameId}/src/levels/pack-${index + 1}.json`;
    writeFileSync(join(root, rel), await formatter.format(rel, pack));
  }
  return packs.length;
}

/**
 * Regenerates the table from the game's plan and compares it with the committed packs, value by
 * value (pack-stale) and byte by byte against the generator's Prettier output (pack-format).
 */
export async function checkPlan(root, modules, gameId, report) {
  const folder = `apps/${gameId}/src/levels`;
  const planRel = `${folder}/${gameId}-level-plan.ts`;
  const plannerRel = 'packages/game-kit/src/levels/plan-level-table.ts';
  if (!modules.exists(planRel) || !modules.exists(plannerRel)) return 0;
  let packs;
  let failures;
  try {
    ({ packs, failures } = await runPlan(modules, gameId));
  } catch (error) {
    report.problem({ file: planRel, rule: 'plan-run', message: `the level plan cannot run headless: ${errorText(error)}`, fix: 'The plan and everything it imports must be pure (game-kit, the game\'s rules/ and levels/); fix the error, then rerun.' });
    return 1;
  }
  for (const failure of failures) report.problem({ file: planRel, rule: 'plan-failure', message: `level ${failure.level}: no candidate passed the solver and rate() in ${failure.tries} tries`, fix: 'Loosen rate() for that band, raise maxTries or the solver budget, or lower the difficulty there. (A witness that loses a candidate is only a retry; the level fails when every try is lost or rejected.)' });
  const formatter = await createPackFormatter(root);
  for (const [index, generated] of packs.entries()) {
    const rel = `${folder}/pack-${index + 1}.json`;
    let text = null;
    let committed = null;
    try {
      text = readFileSync(join(root, rel), 'utf8');
      committed = JSON.parse(text);
    } catch {
      committed = null;
    }
    const difference = Array.isArray(committed) ? firstDifference(generated, committed) : 'the file is missing or not an array';
    if (difference !== null) {
      report.problem({ file: rel, rule: 'pack-stale', message: `differs from what the plan generates (${difference})`, fix: 'Regenerate: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <id>, check the goldens, and commit with a Gate-Change: trailer.' });
      continue;
    }
    const expected = await formatter.format(rel, generated);
    if (text !== expected) {
      const line = text.split('\n').findIndex((row, at) => row !== expected.split('\n')[at]) + 1;
      report.problem({ file: rel, line, rule: 'pack-format', message: `holds the right levels but not the bytes generate-levels.ts writes (compared with ${formatter.source}; for example short arrays such as score thresholds go on one line)`, fix: 'Regenerate the pack with generate-levels.ts, which formats through the repo\'s Prettier, so prettier --check and generate-levels --check agree. Never hand-format a pack or add it to .prettierignore.' });
    }
  }
  return 1;
}
