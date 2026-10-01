#!/usr/bin/env node
// selftest.mjs: proves check-balance.mjs passes the good fixtures and catches every planted bug,
// both in the normal run and with --release (owner-approved bands required), and that game-kit
// files the sims never import leave the report fresh (check-balance-kit-growth).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs   (rebuild fixtures first with node tests/build-fixtures.mjs)

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-balance.mjs', fixtures: '../tests/fixtures/check-balance', args: (dir) => [dir] },
  { script: 'check-balance.mjs', fixtures: '../tests/fixtures/check-balance-wrapped', args: (dir) => [dir] },
  { script: 'check-balance.mjs', fixtures: '../tests/fixtures/check-balance-release', args: (dir) => [dir, '--release'] },
  { script: 'check-balance.mjs', fixtures: '../tests/fixtures/check-balance-kit-growth', args: (dir) => [dir] },
  // The level packs generated after the sims leave the report fresh; a rules or plan change does not.
  { script: 'check-balance.mjs', fixtures: '../tests/fixtures/check-balance-packs', args: (dir) => [dir] },
]);
