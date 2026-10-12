#!/usr/bin/env node
// fake-aapt2.mjs: stands in for build-tools' aapt2 in the self-test. `dump badging <apk>` prints the
// badging.txt saved next to the APK, `dump xmltree --file AndroidManifest.xml <apk>` its manifest.txt
// (both captured in aapt2 36.0.0's exact format).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const apk = args.at(-1) ?? '';
const dumps = { badging: 'badging.txt', xmltree: 'manifest.txt' };
const file = args[0] === 'dump' ? dumps[args[1]] : undefined;
if (file === undefined) {
  console.error(`fake-aapt2: unexpected arguments: ${args.join(' ')}`);
  process.exit(1);
}
process.stdout.write(readFileSync(join(dirname(apk), file), 'utf8'));
