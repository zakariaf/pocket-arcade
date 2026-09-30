#!/usr/bin/env node
// Self-test for check-testids.mjs: the good fixture must pass, and every bad-* fixture (one planted
// bug each: 0 matches, 2 matches, wrong frame, wrong caption, wrong text key, unknown key, bad name,
// duplicate, missing parent, wrong requires, bounds on a state card, two testIDs on one node, wrong
// scope, and the reach policy: bounds on a crop-only part, a wrong coveredBy, a decorative component
// left reachable, a reachable element inside a hidden one) must fail with the lines in its EXPECT.txt.
//
//   node check-testids.selftest.mjs          (Playwright found as check-testids.mjs finds it,
//                                             e.g. PLAYWRIGHT_DIR=<folder with node_modules/playwright>)
//
// When PLAYWRIGHT_DIR is not set and playwright does not resolve from here, the self-test borrows
// the pinned install of a skill that syncs check-testids.mjs (its scripts/node_modules/playwright,
// made by npm ci --prefix <skill>/scripts). None installed: it stops with exit 2 and says so.
//
// A skill that syncs check-testids.mjs adds the same suite to its own scripts/selftest.mjs.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail, run, runSelftest } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function playwrightResolves(base) {
  try {
    createRequire(join(base, 'package.json')).resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

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
    if (existsSync(join(scripts, 'node_modules', 'playwright', 'package.json'))) return scripts;
  }
  return null;
}

const needsPlaywright = !process.env.PLAYWRIGHT_DIR && !playwrightResolves(HERE) && !playwrightResolves(process.cwd());
const borrowed = needsPlaywright ? findSkillPlaywright() : null;
if (borrowed) process.env.PLAYWRIGHT_DIR = borrowed;
if (needsPlaywright && !borrowed && !process.argv.includes('--help')) {
  // Exit 2 with the RESULT line (run() prints ERROR [bad-input] ... and RESULT: FAIL).
  await run(async () =>
    fail(
      'Playwright is not installed for the check-testids self-test',
      'Install it in the skill that syncs check-testids.mjs (npm ci --prefix <skill>/scripts), or set PLAYWRIGHT_DIR.',
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
