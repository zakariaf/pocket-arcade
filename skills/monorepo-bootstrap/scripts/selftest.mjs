#!/usr/bin/env node
// selftest.mjs: proves both scripts of this skill.
//   scaffold-monorepo.mjs: plans a clean root (merging .gitignore and settings) and reports conflicts.
//   check-monorepo.mjs: passes a repo generated from the templates right now, and fails each
//   planted bug (tests/fixtures/check-monorepo/bad-*/mutation.json applied to that repo).
//   PLACEHOLDERS: the pilot's game.config.ts placeholders (owner steps G5 and G3) come from the one
//   shared list; app-files.mjs re-exports ship-placeholders.mjs' list (never a copy), pinned here
//   with each value's field and owner step, as new-game-scaffold and the ship gates pin it.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleCheckFixtures } from './lib/assemble-fixtures.mjs';
import { PLACEHOLDERS } from './lib/app-files.mjs';
import { PLACEHOLDERS as SHIP_PLACEHOLDERS } from './lib/ship-placeholders.mjs';
import { createReporter, runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const TODAY = ['--today', '2026-09-28'];

/** The one placeholder list (value, game.config.ts field, owner step), as every gate pins it. */
const PINNED_PLACEHOLDERS = [
  ['com.example.*', 'bundleId / premium.productId', null],
  ['ca-app-pub-1234567890123456~1234567890', 'ads.ids.ios.appId', 'G5'],
  ['ca-app-pub-1234567890123456/1111111111', 'ads.ids.ios.units.banner', 'G5'],
  ['ca-app-pub-1234567890123456/2222222222', 'ads.ids.ios.units.interstitial', 'G5'],
  ['ca-app-pub-1234567890123456/3333333333', 'ads.ids.ios.units.rewarded', 'G5'],
  ['example.com', 'links.privacyPolicy.host', 'G3'],
  ['support@example.com', 'links.supportEmail', 'G3'],
];

/** True (and prints the problem) when app-files.mjs' PLACEHOLDERS is a copy or not the pinned list. */
function placeholdersDrifted() {
  const entries = PLACEHOLDERS.map((entry) => [entry.value, entry.field, entry.ownerStep]);
  const isShared = PLACEHOLDERS === SHIP_PLACEHOLDERS;
  if (isShared && JSON.stringify(entries) === JSON.stringify(PINNED_PLACEHOLDERS)) {
    console.log(`ok   PLACEHOLDERS is ship-placeholders.mjs' list, pinned (${entries.length} values with fields and owner steps)`);
    return false;
  }
  const report = createReporter({ name: 'selftest' });
  if (!isShared) report.problem({ file: 'scripts/lib/app-files.mjs', rule: 'placeholders-shared', message: 'PLACEHOLDERS is not the list ship-placeholders.mjs exports', fix: 'Re-export PLACEHOLDERS from ./ship-placeholders.mjs in the library\'s app-scaffold/app-files.mjs, then run sync-shared.' });
  else report.problem({ file: 'scripts/lib/ship-placeholders.mjs', rule: 'placeholders-pinned', message: `PLACEHOLDERS is ${JSON.stringify(entries)}, not the pinned ${JSON.stringify(PINNED_PLACEHOLDERS)}`, fix: 'Keep every placeholder, its field and its owner step in the shared list; change the pin only with the owner decision that changes it.' });
  process.exitCode = report.finish({ checked: 1, unit: 'lists' });
  return true;
}

const drifted = !wantsHelp && placeholdersDrifted();
const generated = wantsHelp || drifted ? join(here, '..', 'tests', 'fixtures', 'check-monorepo') : assembleCheckFixtures(join(here, '..', 'tests', 'fixtures', 'check-monorepo'));

try {
  if (!drifted) await runSelftest(import.meta.url, [
    { script: 'scaffold-monorepo.mjs', fixtures: '../tests/fixtures/scaffold-monorepo', args: (dir) => ['--root', dir, ...TODAY] },
    { script: 'check-monorepo.mjs', fixtures: generated, args: (dir) => [dir, ...TODAY] },
  ]);
} finally {
  if (!wantsHelp && !drifted) rmSync(generated, { recursive: true, force: true });
}
