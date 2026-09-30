#!/usr/bin/env node
// check-greeting.mjs written without the shared helper (planted bug for the validator self-test).

import { readdirSync, readFileSync } from 'node:fs';

if (process.argv.includes('--help')) {
  console.log('Usage: node check-greeting.mjs [folder]');
  process.exit(0);
}
const folder = process.argv[2] ?? '.';
const files = readdirSync(folder).filter((name) => name.endsWith('.txt'));
if (files.length === 0) {
  console.log('ERROR nothing to check');
  console.log('RESULT: FAIL (1 problems)');
  process.exit(2);
}
let problems = 0;
for (const name of files) {
  if (!readFileSync(`${folder}/${name}`, 'utf8').startsWith('Hello')) {
    problems += 1;
    console.log(`FAIL ${name}:1 [greeting] does not start with "Hello" Fix: start with Hello.`);
  }
}
console.log(problems ? `RESULT: FAIL (${problems} problems)` : 'RESULT: PASS');
process.exitCode = problems ? 1 : 0;
