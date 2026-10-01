#!/usr/bin/env node
// build-cases.mjs: (re)writes tests/cases/, the sample skills the validator self-test runs on.
// Two valid base skills (one without scripts, one with) are written as "good-*" cases; every other
// case is a base with exactly one planted bug, so it must fail with exactly one rule.
// Run it after changing the authoring standard or the validator, then run tests/selftest.mjs.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, resultLine, run } from '../shared/scripts/check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, 'cases');
const CHECK_LIB = readFileSync(join(HERE, '..', 'shared', 'scripts', 'check-lib.mjs'), 'utf8');

// ---------------------------------------------------------------------------------------------
// Base skills
// ---------------------------------------------------------------------------------------------

const DESCRIPTION = 'Checks sample greetings for the validator self-test. Use when testing the Pocket Arcade skill validator.';

function skillMd({ name, description = DESCRIPTION, scripted }) {
  const workflowRun = scripted ? '3. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-greeting.mjs greetings` and fix every FAIL line until it prints `RESULT: PASS`.\n' : '';
  const doneRun = scripted ? '- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-greeting.mjs greetings` prints `RESULT: PASS`.\n' : '';
  const fileRows = scripted
    ? [
        '| `scripts/check-greeting.mjs` | Checker for the greeting rule | Workflow step 3 |',
        '| `scripts/selftest.mjs` | Proves the checker | After changing the checker |',
        '| `scripts/check-lib.mjs` | Shared script helper (synced) | Never by hand |',
        '| `assets/shared.json` | Shared files this skill copies in | When adding a shared file |',
        '| `tests/fixtures/` | Good and planted-bad inputs | When adding a rule |',
      ].join('\n') + '\n'
    : '';
  return `---
name: ${name}
description: ${description}
---

# Sample greetings

A small, valid skill that the validator self-test changes one rule at a time.

## Rules that must hold

1. **Greet first.** Every greeting starts with "Hello", so the reader knows what it is.

## Workflow

1. Read [references/guide.md](references/guide.md).
2. Copy [templates/greeting.ts](templates/greeting.ts) into the app and fill in the placeholder.
${workflowRun}
## Definition of done

- [ ] The greeting is copied and filled in.
${doneRun}
## Anti-patterns

- Skipping the guide and guessing the wording.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/guide.md](references/guide.md) | How greetings are written | Workflow step 1 |
| [templates/greeting.ts](templates/greeting.ts) | Greeting function to copy | Workflow step 2 |
${fileRows}
## Related skills

- \`skill-template\` - the model skill every new skill starts from.
`;
}

const GUIDE = `# Writing greetings

Greetings open every message in the sample app.

- Start with "Hello".
- Follow with the name and a comma.
- Keep it under forty characters.
`;

const TEMPLATE = `export function __FUNCTION_NAME__(name: string): string {
  return \`Hello, \${name}\`;
}
`;

const CHECKER = `#!/usr/bin/env node
// check-greeting.mjs: checks that every .txt greeting in a folder starts with "Hello".

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, parseArgs, requireDir, run, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-greeting',
  summary: 'Checks that every .txt file in the folder starts with "Hello".',
  usage: '[folder]',
  positionals: { min: 0, max: 1 },
};

run(async () => {
  const { positionals } = parseArgs(process.argv.slice(2), SPEC);
  const folder = requireDir(positionals[0] ?? '.', 'folder');
  const report = createReporter({ name: 'check-greeting' });
  const files = walk(folder, { include: ['*.txt'] });
  for (const rel of files) {
    if (!readFileSync(join(folder, rel), 'utf8').startsWith('Hello')) {
      report.problem({ file: rel, line: 1, rule: 'greeting', message: 'does not start with "Hello"', fix: 'Start the greeting with "Hello".' });
    }
  }
  return report.finish({ checked: files.length, unit: 'greetings' });
});
`;

const SELFTEST = `#!/usr/bin/env node
// selftest.mjs: proves check-greeting.mjs passes the good fixture and catches the planted bug.

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [{ script: 'check-greeting.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] }]);
`;

function baseBasic(name) {
  return {
    'SKILL.md': skillMd({ name, scripted: false }),
    'references/guide.md': GUIDE,
    'templates/greeting.ts': TEMPLATE,
  };
}

function baseScripted(name) {
  return {
    'SKILL.md': skillMd({ name, scripted: true }),
    'references/guide.md': GUIDE,
    'templates/greeting.ts': TEMPLATE,
    'scripts/check-greeting.mjs': CHECKER,
    'scripts/selftest.mjs': SELFTEST,
    'scripts/check-lib.mjs': CHECK_LIB,
    'assets/shared.json': '[\n  { "from": "scripts/check-lib.mjs", "to": "scripts/check-lib.mjs" }\n]\n',
    'tests/fixtures/good/hello.txt': 'Hello, Ada\n',
    'tests/fixtures/bad-rude/hello.txt': 'Go away\n',
    'tests/fixtures/bad-rude/EXPECT.txt': 'greeting\n',
  };
}

// ---------------------------------------------------------------------------------------------
// Cases: [id, base, folder name, mutate(files, name) -> files, expected rules, options]
// ---------------------------------------------------------------------------------------------

const replace = (text, from, to) => {
  if (!text.includes(from)) throw new Error(`build-cases: "${from.slice(0, 40)}" not found`);
  return text.replace(from, to);
};
const withSkill = (files, change) => ({ ...files, 'SKILL.md': change(files['SKILL.md']) });
const withDescription = (description) => (files) => withSkill(files, (text) => replace(text, `description: ${DESCRIPTION}`, `description: ${description}`));

const HOSTILE_SCRIPT = `#!/usr/bin/env node
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
  if (!readFileSync(\`\${folder}/\${name}\`, 'utf8').startsWith('Hello')) {
    problems += 1;
    console.log(\`FAIL \${name}:1 [greeting] does not start with "Hello" Fix: start with Hello.\`);
  }
}
console.log(problems ? \`RESULT: FAIL (\${problems} problems)\` : 'RESULT: PASS');
process.exitCode = problems ? 1 : 0;
`;

const LONG_LINE = 'This sentence only pads the workflow so that the Definition of done starts too far down the file for compaction to keep it. ';

export const CASE_TABLE = [
  ['good-basic', baseBasic, 'good-basic', (files) => files, []],
  ['good-scripted', baseScripted, 'good-scripted', (files) => files, []],
  ['skill-md', baseBasic, 'skill-md', (files) => ({ ...files, 'SKILL.md': null }), ['skill-md']],
  ['fm-line1', baseBasic, 'fm-line1', (files) => withSkill(files, (text) => `\n${text}`), ['fm-line1']],
  ['fm-close', baseBasic, 'fm-close', (files) => withSkill(files, (text) => replace(text, `${DESCRIPTION}\n---\n`, `${DESCRIPTION}\n`)), ['fm-close']],
  ['fm-yaml', baseBasic, 'fm-yaml', withDescription('Checks sample greetings. Use when: testing the Pocket Arcade skill validator.'), ['fm-yaml']],
  ['fm-key', baseBasic, 'fm-key', (files) => withSkill(files, (text) => replace(text, `${DESCRIPTION}\n`, `${DESCRIPTION}\npaths: "**/*.ts"\n`)), ['fm-key']],
  ['fm-no-disable-model-invocation', baseBasic, 'fm-no-disable-model-invocation', (files) => withSkill(files, (text) => replace(text, `${DESCRIPTION}\n`, `${DESCRIPTION}\ndisable-model-invocation: true\n`)), ['fm-no-disable-model-invocation']],
  ['fm-no-allowed-tools', baseBasic, 'fm-no-allowed-tools', (files) => withSkill(files, (text) => replace(text, `${DESCRIPTION}\n`, `${DESCRIPTION}\nallowed-tools: Read\n`)), ['fm-no-allowed-tools']],
  ['name-format', baseBasic, 'Name-Format', (files) => files, ['name-format']],
  ['name-match', baseBasic, 'name-match', (files) => withSkill(files, (text) => replace(text, 'name: name-match', 'name: other-name')), ['name-match']],
  ['name-reserved', baseBasic, 'simplify', (files) => files, ['name-reserved']],
  ['desc-length', baseBasic, 'desc-length', withDescription(`Checks sample greetings for the validator self-test, ${'and keeps adding words to the description '.repeat(6)}. Use when testing the Pocket Arcade skill validator.`), ['desc-length']],
  ['desc-angle', baseBasic, 'desc-angle', withDescription('Checks sample greetings for a <name>. Use when testing the Pocket Arcade skill validator.'), ['desc-angle']],
  ['desc-verb', baseBasic, 'desc-verb', withDescription('Sample greetings checker for the self-test. Use when testing the Pocket Arcade skill validator.'), ['desc-verb']],
  ['desc-person', baseBasic, 'desc-person', withDescription('Checks sample greetings so you can test things. Use when testing the Pocket Arcade skill validator.'), ['desc-person']],
  ['desc-trigger', baseBasic, 'desc-trigger', withDescription('Checks sample greetings for the validator self-test of the Pocket Arcade skills.'), ['desc-trigger']],
  ['skill-lines', baseBasic, 'skill-lines', (files) => withSkill(files, (text) => replace(text, '- Skipping the guide and guessing the wording.\n', `- Skipping the guide and guessing the wording.\n${'- Another sample anti-pattern line.\n'.repeat(280)}`)), ['skill-lines']],
  ['sections', baseBasic, 'sections', (files) => withSkill(files, (text) => {
    const block = '## Anti-patterns\n\n- Skipping the guide and guessing the wording.\n\n';
    return replace(replace(text, block, ''), '## Definition of done', `${block}## Definition of done`);
  }), ['sections']],
  ['section-format', baseBasic, 'section-format', (files) => withSkill(files, (text) => replace(text, '1. **Greet first.**', '- **Greet first.**')), ['section-format']],
  ['dod-position', baseBasic, 'dod-position', (files) => withSkill(files, (text) => replace(text, '## Definition of done', `${`${LONG_LINE.repeat(1)}\n`.repeat(170)}\n## Definition of done`)), ['dod-position']],
  ['link-resolve', baseBasic, 'link-resolve', (files) => withSkill(files, (text) => replace(text, '## Definition of done', '3. Then read [the missing notes](references/missing.md).\n\n## Definition of done')), ['link-resolve']],
  ['files-listed', baseBasic, 'files-listed', (files) => ({ ...files, 'references/extra.md': '# Extra\n\nA file nobody listed.\n' }), ['files-listed']],
  ['files-exist', baseBasic, 'files-exist', (files) => withSkill(files, (text) => replace(text, '| Greeting function to copy | Workflow step 2 |\n', '| Greeting function to copy | Workflow step 2 |\n| `references/ghost.md` | A file that is not there | Never |\n')), ['files-exist']],
  ['ref-toc', baseBasic, 'ref-toc', (files) => ({ ...files, 'references/guide.md': `${GUIDE}\n${Array.from({ length: 110 }, (_, i) => `- Greeting example ${i + 1}: Hello, friend number ${i + 1}.`).join('\n')}\n` }), ['ref-toc']],
  ['no-project-ref', baseBasic, 'no-project-ref', (files) => ({ ...files, 'references/guide.md': `${GUIDE}\nThe full wording rules are in docs/05-ui-and-components.md.\n` }), ['no-project-ref']],
  ['device-explicit', baseBasic, 'device-explicit', (files) => ({ ...files, 'references/guide.md': `${GUIDE}\nTo see a greeting on the simulator:\n\n\`\`\`sh\nmaestro test flows/greeting.yaml\n\`\`\`\n` }), ['device-explicit']],
  ['no-shouting', baseBasic, 'no-shouting', (files) => ({ ...files, 'references/guide.md': `${GUIDE}\nIt is IMPORTANT to greet first.\n` }), ['no-shouting']],
  ['layout', baseBasic, 'layout', (files) => withSkill({ ...files, 'notes.txt': 'Loose notes at the top of the skill.\n' }, (text) => replace(text, '| Greeting function to copy | Workflow step 2 |\n', '| Greeting function to copy | Workflow step 2 |\n| `notes.txt` | Loose notes | Never |\n')), ['layout']],
  ['script-lib', baseScripted, 'script-lib', (files) => ({ ...files, 'scripts/check-greeting.mjs': HOSTILE_SCRIPT }), ['script-lib']],
  ['script-deps', baseScripted, 'script-deps', (files) => ({ ...files, 'scripts/check-greeting.mjs': replace(CHECKER, "import { join } from 'node:path';\n", "import { join } from 'node:path';\nimport fs from 'fs';\n") }), ['script-deps']],
  ['script-help', baseScripted, 'script-help', (files) => ({ ...files, 'scripts/check-greeting.mjs': replace(CHECKER, "const SPEC = {", "if (process.argv.includes('--help')) process.exit(3);\n\nconst SPEC = {") }), ['script-help']],
  ['script-result', baseScripted, 'script-result', (files) => ({ ...files, 'scripts/check-greeting.mjs': replace(CHECKER, "const SPEC = {", "if (process.argv.length === 2) {\n  console.log('checked nothing');\n  process.exit(0);\n}\n\nconst SPEC = {") }), ['script-result']],
  ['selftest-missing', baseScripted, 'selftest-missing', (files) => withSkill({ ...files, 'scripts/selftest.mjs': null }, (text) => replace(text, '| `scripts/selftest.mjs` | Proves the checker | After changing the checker |\n', '')), ['selftest-missing']],
  ['fixtures', baseScripted, 'fixtures', (files) => ({ ...files, 'tests/fixtures/bad-rude/EXPECT.txt': null }), ['fixtures']],
  ['shared-json', baseScripted, 'shared-json', (files) => ({ ...files, 'assets/shared.json': '[\n  { "from": "scripts/check-lib.mjs" }\n]\n' }), ['shared-json'], { sync: false }],
  ['shared-drift', baseScripted, 'shared-drift', (files) => ({ ...files, 'scripts/check-lib.mjs': `${CHECK_LIB}// a local edit that the canonical copy does not have\n` }), ['shared-drift'], { sync: false }],
  ['shared-undeclared', baseScripted, 'shared-undeclared', (files) => withSkill({ ...files, 'assets/shared.json': null }, (text) => replace(text, '| `assets/shared.json` | Shared files this skill copies in | When adding a shared file |\n', '')), ['shared-undeclared']],
  ['dod-script', baseScripted, 'dod-script', (files) => withSkill(files, (text) => replace(text, '- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-greeting.mjs greetings` prints `RESULT: PASS`.\n', '- [ ] The greetings read well aloud.\n')), ['dod-script']],
];

const SPEC = {
  name: 'build-cases',
  summary: 'Rewrites tests/cases/ from the two base skills and the mutation table in this file (one planted bug per case).',
  usage: '',
  positionals: { min: 0, max: 0 },
};

run(async () => {
  parseArgs(process.argv.slice(2), SPEC);
  rmSync(CASES, { recursive: true, force: true });
  for (const [id, base, folder, mutate, rules, options = {}] of CASE_TABLE) {
    const files = mutate(base(folder), folder);
    const caseDir = join(CASES, id);
    for (const [rel, content] of Object.entries(files)) {
      if (content === null) continue;
      const path = join(caseDir, folder, rel);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    writeFileSync(join(caseDir, 'case.json'), `${JSON.stringify({ expect: rules.length ? 'fail' : 'pass', rules, sync: options.sync !== false }, null, 2)}\n`);
    console.log(`wrote cases/${id}/${folder} (${rules.length ? `expects ${rules.join(', ')}` : 'expects PASS'})`);
  }
  console.log(`build-cases: ${CASE_TABLE.length} cases written`);
  console.log(resultLine(0));
  return 0;
});
