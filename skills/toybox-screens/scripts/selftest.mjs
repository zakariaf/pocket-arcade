#!/usr/bin/env node
// selftest.mjs: proves check-screens.mjs and list-screen.mjs pass good input and catch every
// planted bug, that a partial Shell (shell-slice.json) is checked for its screens only, and that
// the skill's own templates and assets pass them.
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';

const TEMPLATES = fileURLToPath(new URL('../templates', import.meta.url));
/** Planted bugs laid over the templates (the fixture's files replace the template files of the same path). */
const OVER_TEMPLATES = {
  'bad-overlay-not-modal': ['--screen', 'S7'],
  'bad-game-half-wired': ['--screen', 'S5'],
  'bad-daily-card-not-pressable': ['--screen', 'S4'],
  'bad-play-inside-opener': ['--screen', 'S4'],
  'bad-hint-key-without-fact': ['--screen', 'S5'],
  'bad-splash-ignores-freeze': ['--screen', 'S1'],
  'bad-rate-outline-star': ['--screen', 'S11'],
  'bad-debug-perf-row-missing': ['--screen', 'S15'],
  'bad-borrowed-missing': ['--screen', 'S6'],
  'bad-continue-offer-hidden-while-loading': ['--screen', 'S7'],
  'bad-loss-not-finished': ['--screen', 'S5'],
};

await runSelftest(import.meta.url, [
  {
    script: 'check-screens.mjs',
    fixtures: '../tests/fixtures/check-screens',
    args: (dir) => [dir],
  },
  {
    // shell-slice.json: screens outside the slice print SKIP lines; slice screens are strict.
    script: 'check-screens.mjs',
    fixtures: '../tests/fixtures/check-screens-slice',
    args: (dir) => [dir],
  },
  {
    // The templates are an app: every screen S1-S15 built, every testID exact, every model hook tested.
    script: 'check-screens.mjs',
    fixtures: '../tests/fixtures/templates',
    args: (dir) => {
      const name = basename(dir);
      if (name === 'good') return [TEMPLATES, dir, '--all'];
      if (name in OVER_TEMPLATES) return [TEMPLATES, dir, ...OVER_TEMPLATES[name]];
      return [dir, '--all'];
    },
  },
  {
    // good: the shipped map, deck and reference images; bad-*: small planted maps.
    script: 'list-screen.mjs',
    fixtures: '../tests/fixtures/list-screen',
    args: (dir) =>
      basename(dir) === 'good' ? ['--all'] : ['--map', `${dir}/map.json`, '--deck', `${dir}/deck.json`, '--refs', dir, '--all'],
  },
]);
