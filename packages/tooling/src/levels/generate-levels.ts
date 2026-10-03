// packages/tooling/src/levels/generate-levels.ts
// Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON packages/tooling/src/levels/generate-levels.ts --app <game-id> [--check]
// Runs the game's level plan (apps/<game-id>/src/levels/<game-id>-level-plan.ts) and writes
// apps/<game-id>/src/levels/pack-<n>.json, each formatted by the repo's own Prettier (its config,
// the json parser), so `prettier --check` and this generator always agree on the bytes. With
// --check it writes nothing and exits 1 when a committed pack's bytes differ from what the plan
// generates today (a changed generator, curve or tuning). Never hand-edit or hand-format a pack.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { planLevelTable } from '@e07/game-kit/levels/plan-level-table.ts';

import type { LevelPlan, PackTable } from '@e07/game-kit/levels/level-plan.ts';

const GAME_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isLevelPlan(value: unknown): value is LevelPlan<unknown, unknown> {
  return typeof value === 'object' && value !== null && 'solver' in value && 'rate' in value;
}

async function loadPlan(app: string): Promise<LevelPlan<unknown, unknown>> {
  const loaded: unknown = await import(`@e07/${app}/levels/${app}-level-plan.ts`);
  const exported = typeof loaded === 'object' && loaded !== null ? Object.values(loaded) : [];
  const plan = exported.find(isLevelPlan);
  if (plan === undefined)
    throw new Error(`apps/${app}/src/levels/${app}-level-plan.ts exports no LevelPlan`);
  return plan;
}

/** The pack as the repo's Prettier writes it (short number arrays such as thresholds on one line). */
async function packText(pack: PackTable, path: string): Promise<string> {
  const prettier = await import('prettier');
  const config = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(JSON.stringify(pack, null, 2), { ...config, parser: 'json' });
}

/** Writes (or, with --check, compares) every pack file; returns the number of differing packs. */
async function syncPacks(app: string, packs: readonly PackTable[], isCheck: boolean) {
  let differing = 0;
  for (const [index, pack] of packs.entries()) {
    const path = join('apps', app, 'src', 'levels', `pack-${String(index + 1)}.json`);
    const text = await packText(pack, path);
    if (existsSync(path) && readFileSync(path, 'utf8') === text) continue;
    differing += 1;
    if (isCheck) console.error(`differs: ${path}`);
    else writeFileSync(path, text);
  }
  return differing;
}

const { values } = parseArgs({
  options: { app: { type: 'string' }, check: { type: 'boolean', default: false } },
});
const app = values.app ?? '';
if (!GAME_ID.test(app)) throw new Error('pass --app <game-id> (kebab-case)');
const plan = await loadPlan(app);
const { packs, failures } = planLevelTable(plan);
for (const failure of failures) {
  console.error(`level ${String(failure.level)}: no candidate in ${String(failure.tries)} tries`);
}
const differing = failures.length === 0 ? await syncPacks(app, packs, values.check) : 0;
console.warn(
  `${app}: ${String(packs.flat().length)} levels, ${String(failures.length)} failures, ${String(differing)} ${values.check ? 'differing' : 'written'} packs`,
);
process.exitCode = failures.length > 0 || (values.check && differing > 0) ? 1 : 0;
