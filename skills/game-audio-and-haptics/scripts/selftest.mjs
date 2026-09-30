#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixture and catch every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs   (rebuild fixtures first with node tests/build-fixtures.mjs)

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-audio-haptics.mjs', fixtures: '../tests/fixtures/check-audio-haptics', args: (dir) => [dir] },
  // A game-first repo (shell-slice.json "screens": []): the Shell audio wiring prints SKIP (D10).
  { script: 'check-audio-haptics.mjs', fixtures: '../tests/fixtures/check-audio-haptics-game-first', args: (dir) => [dir] },
  { script: 'check-sound-banks.mjs', fixtures: '../tests/fixtures/check-sound-banks', args: (dir) => [dir] },
]);
