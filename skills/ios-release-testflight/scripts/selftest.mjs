#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixtures and catch every planted bug.
// Files that must never be committed (a .claude/settings.json inside a skill, anything named like a
// key, private key text, an .ipa) are created at run time in temporary copies, from plant.json.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeTempDir, removeTempDir, runSelftest } from './check-lib.mjs';
import { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

// The ship gates refuse these scaffold placeholders by name (owner decision O4): the pinned list.
const PINNED = {
  bundleIdPrefix: 'com.example.',
  admobAppId: 'ca-app-pub-1234567890123456~1234567890',
  admobUnits: ['ca-app-pub-1234567890123456/1111111111', 'ca-app-pub-1234567890123456/2222222222', 'ca-app-pub-1234567890123456/3333333333'],
  privacyHost: 'example.com',
  supportEmail: 'support@example.com',
};
if (JSON.stringify(PLACEHOLDERS) !== JSON.stringify(PINNED)) {
  console.log('FAIL scripts/lib/ship-placeholders.mjs [placeholders-pin] PLACEHOLDERS is not the pinned list Fix: Restore the list in _library/shared/scripts/lib/ship-placeholders.mjs (a change needs the owner) and sync.');
  console.log('RESULT: FAIL (1 problems)');
  process.exit(1);
}

const temps = [];
process.on('exit', () => temps.forEach((dir) => removeTempDir(dir)));

function tempCopy(dir) {
  const copy = join(makeTempDir('release-selftest-'), 'repo');
  temps.push(dirname(copy));
  cpSync(dir, copy, { recursive: true });
  return copy;
}

// Built from parts so this file never contains private key text itself.
const FAKE_KEY = ['-----BEGIN ', 'PRIVATE KEY-----', '\nnot-a-real-key\n', '-----END ', 'PRIVATE KEY-----', '\n'].join('');

/** release-setup fixtures: copy, then create the files listed in plant.json. */
function plantedRepo(dir) {
  const copy = tempCopy(dir);
  const plant = existsSync(join(dir, 'plant.json')) ? JSON.parse(readFileSync(join(dir, 'plant.json'), 'utf8')) : {};
  for (const [rel, content] of Object.entries(plant)) {
    mkdirSync(dirname(join(copy, rel)), { recursive: true });
    const text = typeof content === 'string' ? content : `# Handover\n\nkey:\n${FAKE_KEY}`;
    writeFileSync(join(copy, rel), text);
  }
  return [copy];
}

function artifactArgs(dir) {
  const args = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'));
  const entitlements = join(dir, 'entitlements.plist');
  return existsSync(entitlements) ? [...args, '--entitlements', entitlements] : args;
}

/** store-artifact-store fixtures: zip Payload/ into a real .ipa and check it through --ipa. */
function ipaArgs(dir) {
  const work = tempCopy(dir);
  const ipa = join(dirname(work), 'LineSiege.ipa');
  const zip = spawnSync('zip', ['-qr', ipa, 'Payload'], { cwd: work });
  if (zip.status !== 0) throw new Error(`zip failed for ${dir}`);
  return ['--ipa', ipa, ...artifactArgs(dir)];
}

await runSelftest(import.meta.url, [
  { script: 'check-release-setup.mjs', fixtures: '../tests/fixtures/release-setup', args: plantedRepo },
  { script: 'check-store-artifact.mjs', fixtures: '../tests/fixtures/store-artifact', args: (dir) => ['--app', join(dir, 'Payload', 'LineSiege.app'), ...artifactArgs(dir)] },
  { script: 'check-store-artifact.mjs', fixtures: '../tests/fixtures/store-artifact-store', args: ipaArgs },
]);
