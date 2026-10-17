#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixtures and catch every planted bug. check-emu-app
// reads its APK through tests/fixtures/fakes/fake-aapt2.mjs, which prints the aapt2 dumps saved
// next to each fixture's app-release.apk (real zip files with the bundle and app.config inside).
// Before the suites it pins the shared zip and manifest-tree helpers on the good APK: the xmltree is
// parsed under a "#root" node, and findElements searches at or below the node it is given.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { parseXmlTree } from './lib/apk.mjs';
import { findElements, metaDataValue } from './lib/manifest-tree.mjs';
import { readZipEntry, readZipIndex } from './lib/zip.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');
const GOOD_APP = join(FIXTURES, 'emu-app', 'good');
const FAKE_AAPT2 = join(FIXTURES, 'fakes', 'fake-aapt2.mjs');

/** App fixtures carry their variant flags in args.json next to app-release.apk, and maybe a screenshot. */
const appArgs = (dir) => [
  '--apk',
  join(dir, 'app-release.apk'),
  '--aapt2',
  FAKE_AAPT2,
  ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')),
  ...(existsSync(join(dir, 'screenshot.png')) ? ['--screenshot', join(dir, 'screenshot.png')] : []),
];

/** The shared helpers on the good APK: its zip entries and its xmltree under the "#root" node. */
function sharedLibProblems() {
  const zip = readZipIndex(join(GOOD_APP, 'app-release.apk'));
  const tree = parseXmlTree(readFileSync(join(GOOD_APP, 'manifest.txt'), 'utf8'));
  const problems = [];
  if (!readZipEntry(zip, 'assets/index.android.bundle')?.length) problems.push('readZipEntry does not read assets/index.android.bundle');
  if (readZipEntry(zip, 'no/such/entry') !== null) problems.push('readZipEntry of a missing entry is not null');
  if (tree.name !== '#root' || findElements(tree, 'manifest').length !== 1 || findElements(tree, 'manifest')[0] !== tree.children[0]) problems.push('findElements(tree, "manifest") does not return exactly the one <manifest> under "#root"');
  if (metaDataValue(tree, 'E07AppVariant') !== 'test') problems.push('metaDataValue(tree, "E07AppVariant") is not "test"');
  return problems;
}

const libProblems = sharedLibProblems();
for (const problem of libProblems) console.log(`FAIL lib/manifest-tree.mjs [selftest-shared-libs] ${problem} Fix: Fix the shared zip.mjs or manifest-tree.mjs in _library/shared/scripts/lib/, then sync.`);
if (libProblems.length > 0) {
  console.log(`RESULT: FAIL (${libProblems.length} problems)`);
  process.exit(1);
}

await runSelftest(import.meta.url, [
  { script: 'check-emu-setup.mjs', fixtures: '../tests/fixtures/emu-setup', args: (dir) => [dir] },
  { script: 'check-emu-app.mjs', fixtures: '../tests/fixtures/emu-app', args: appArgs },
  { script: 'check-emu-app.mjs', fixtures: '../tests/fixtures/emu-app-store', args: appArgs },
]);
