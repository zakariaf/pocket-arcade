#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-catalogs.mjs', fixtures: '../tests/fixtures/check-catalogs', args: (dir) => [dir] },
  { script: 'check-i18n-code.mjs', fixtures: '../tests/fixtures/check-i18n-code', args: (dir) => [dir] },
  { script: 'copy-deck.mjs', fixtures: '../tests/fixtures/copy-deck', args: (dir) => ['check', dir, '--screen', 'S6', '--game', 'line-siege'] },
  // A deck of the fixture's own (--deck): the debug-english rule on the sources, not only the catalogs.
  { script: 'copy-deck.mjs', fixtures: '../tests/fixtures/copy-deck-source', args: (dir) => ['check', dir, '--deck', `${dir}/copy-deck.json`] },
]);
