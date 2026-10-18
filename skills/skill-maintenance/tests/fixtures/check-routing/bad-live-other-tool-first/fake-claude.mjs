#!/usr/bin/env node
// A stand-in for `claude -p <prompt> --output-format stream-json --verbose` (self-test only): prints
// one stream-json assistant event per tool call listed in calls.json beside this file, then a result.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const calls = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'calls.json'), 'utf8'));
calls.forEach((call, index) => {
  const block = { type: 'tool_use', id: `toolu_${String(index)}`, name: call.name, input: call.input };
  console.log(JSON.stringify({ type: 'assistant', message: { content: [block] } }));
});
console.log(JSON.stringify({ type: 'result', is_error: false, result: 'done' }));
