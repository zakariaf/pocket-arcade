#!/usr/bin/env node
// Self-test for check-testids.mjs: the good fixture must pass, and every bad-* fixture (one planted
// bug each: 0 matches, 2 matches, wrong frame, wrong caption, wrong text key, unknown key, bad name,
// duplicate, missing parent, wrong requires, bounds on a state card, two testIDs on one node, wrong
// scope, and the reach policy: bounds on a crop-only part, a wrong coveredBy, a decorative component
// left reachable, a reachable element inside a hidden one) must fail with the lines in its EXPECT.txt.
// Two error-* cases point the tooling folder at an empty folder (--tooling, and its alias
// --playwright): each must stop with exit 2 and both install forms.
//
//   node check-testids.selftest.mjs          (Playwright from the tooling folder, as check-testids.mjs
//                                             loads it: PARITY_TOOLING_DIR=<folder with node_modules/
//                                             playwright>, or its alias PLAYWRIGHT_DIR)
//
// When neither variable is set and this folder has no node_modules/playwright, the self-test
// borrows the pinned install of a skill that syncs check-testids.mjs (its scripts/node_modules,
// made by npm ci --prefix <skill>/scripts). None installed: it stops with exit 2 and says so.
//
// A skill that syncs check-testids.mjs adds the same suite to its own scripts/selftest.mjs.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, run, runSelftest } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const hasPlaywright = (dir) => existsSync(join(dir, 'node_modules', 'playwright', 'package.json'));
const isSet = (name) => (process.env[name] ?? '').trim() !== '';

/** A skill folder that syncs check-testids.mjs and has its pinned playwright installed. */
function findSkillPlaywright() {
  const skillsRoot = resolve(HERE, '..', '..', '..');
  for (const name of readdirSync(skillsRoot).sort()) {
    const manifest = join(skillsRoot, name, 'assets', 'shared.json');
    if (!existsSync(manifest)) continue;
    let entries;
    try {
      entries = JSON.parse(readFileSync(manifest, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(entries) || !entries.some((entry) => entry?.from === 'scripts/check-testids.mjs')) continue;
    const scripts = join(skillsRoot, name, 'scripts');
    if (hasPlaywright(scripts)) return scripts;
  }
  return null;
}

const needsPlaywright = !isSet('PARITY_TOOLING_DIR') && !isSet('PLAYWRIGHT_DIR') && !hasPlaywright(HERE);
const borrowed = needsPlaywright ? findSkillPlaywright() : null;
if (borrowed) process.env.PARITY_TOOLING_DIR = borrowed;
if (needsPlaywright && !borrowed && !process.argv.includes('--help')) {
  // Exit 2 with the RESULT line (run() prints ERROR [bad-input] ... and RESULT: FAIL).
  await run(async () =>
    fail(
      'Playwright is not installed for the check-testids self-test',
      'Install it in the skill that syncs check-testids.mjs (npm ci --prefix <skill>/scripts), or set PARITY_TOOLING_DIR (or PLAYWRIGHT_DIR) to a folder whose node_modules holds playwright 1.63.0.',
    ),
  );
  process.exit(process.exitCode ?? 2);
}

await runSelftest(import.meta.url, [
  {
    script: 'check-testids.mjs',
    fixtures: '../tests/fixtures/check-testids',
    args: (dir) => {
      const design = existsSync(join(dir, 'design.html')) ? join(dir, 'design.html') : join(dir, '..', 'good', 'design.html');
      return ['--map', join(dir, 'map.json'), '--design', design];
    },
  },
]);
