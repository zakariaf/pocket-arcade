#!/usr/bin/env node
// write-component-specs.mjs: writes packages/shell/src/ui/component-specs.json, the as-rendered specs:
// the numeric projection of the Toybox token file's components block (every size, padding, gap, radius,
// border, elevation and rotation a component uses) with each CSS border floored the way Chrome drew the
// references (asRenderedBorder: 2.5 -> 2, 1.5 -> 1) and the commented mockup overrides applied
// (MOCKUP_OVERRIDES in lib/component-source.mjs). Rings, icon and Skia strokes keep their token values.
// Components read it through COMPONENT_SPECS; nobody edits it by hand, and the token file never changes.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/write-component-specs.mjs [repo-root] [--check]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseArgs, requireDir, requireFile, run } from './check-lib.mjs';
import { SPECS_JSON, firstDifference, loadTokens, specNote, specsFromTokens, specsJsonText } from './lib/component-source.mjs';

const SPEC = {
  name: 'write-component-specs',
  summary: 'Writes packages/shell/src/ui/component-specs.json from the Toybox token file as the references render it (numbers only; CSS borders floored, mockup overrides applied). With --check it only compares.',
  usage: '[options] [repo-root]',
  options: {
    check: { type: 'boolean', help: 'Do not write; fail when the file is missing or differs' },
    tokens: { type: 'string', value: 'file', help: 'Token file to derive from (default: this skill\'s assets/toybox-tokens.json)' },
  },
  positionals: { min: 0, max: 1 },
  details: 'Example: node write-component-specs.mjs .   (from the app repo root)',
};

/** ': <path> is <x>, the as-rendered spec is <y> (<why>)' for the first differing value, or ''. */
function firstDiffText(current, tokens) {
  let actual;
  try {
    actual = JSON.parse(current);
  } catch {
    return ' (not valid JSON)';
  }
  const diff = firstDifference(specsFromTokens(tokens), actual);
  if (!diff) return ' (formatting only)';
  const note = specNote(tokens, diff.path);
  return `: ${diff.path} is ${diff.actual === undefined ? 'missing' : JSON.stringify(diff.actual)}, the as-rendered spec is ${JSON.stringify(diff.expected)}${note ? ` (${note})` : ''}`;
}

function finish(problems) {
  console.log(`write-component-specs: 1 file checked, ${problems} problems`);
  console.log(problems === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${problems} problems)`);
  return problems === 0 ? 0 : 1;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const target = join(root, SPECS_JSON);
  const tokens = options.tokens ? loadTokens(requireFile(options.tokens, 'token file')) : loadTokens();
  const expected = specsJsonText(tokens);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (options.check) {
    if (current === expected) return finish(0);
    const why = current === null ? 'is missing' : `differs from the as-rendered specs${firstDiffText(current, tokens)}`;
    console.log(`FAIL ${SPECS_JSON} [specs-mismatch] ${why} Fix: run write-component-specs.mjs without --check.`);
    return finish(1);
  }
  if (!existsSync(join(root, 'packages', 'shell'))) {
    console.log('ERROR [bad-input] packages/shell not found Fix: run from the app repo root.');
    console.log('RESULT: FAIL (1 problems)');
    return 2;
  }
  mkdirSync(dirname(target), { recursive: true });
  if (current !== expected) writeFileSync(target, expected);
  console.log(`${current === expected ? 'unchanged' : 'wrote'} ${SPECS_JSON} (${Object.keys(JSON.parse(expected)).length} components)`);
  return finish(0);
});
