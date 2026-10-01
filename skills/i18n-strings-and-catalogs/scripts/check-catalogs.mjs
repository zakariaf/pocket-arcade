#!/usr/bin/env node
// check-catalogs.mjs: lints every Pocket Arcade message catalog (Shell and games) with rules
// L1-L12, and checks all four languages against English (missing/extra keys, placeholders, =N,
// and P5 debug-english: the S15 debug menu's debug.* texts stay English in every language).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-catalogs.mjs [repo-root | catalog-dir...]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { debugEnglishProblem, LANGUAGES, lineOfKey, lintMessage, parityProblems, requiredGameKeys, RULES, ruleLabel, SOURCE_LANGUAGE } from './lib/catalog-rules.mjs';

const RULE_SUMMARIES = {
  L1: '2-5 lowercase kebab-case segments',
  L1b: 'game keys start with <game-id>.; Shell keys never do',
  L2: 'parses as ICU with an other clause',
  L3: 'no {x, date}, {x, time} or rich-text tags',
  L4: 'camelCase placeholders; plain {x} only for *Name/*Text',
  L5: 'plurals use only one, other, =N (one required)',
  L6: 'en: a number followed by a word must be a plural',
  L7: 'no literal digits in any script',
  L8: 'no bidi controls or ALM',
  L9: 'fa/ckb: Persian ی/ک, never Arabic ي/ك',
  L10: 'fa/ckb: ، ؛ ؟ instead of , ; ?',
  L11: 'one whole sentence (no edge joiner, double space, bare placeholder)',
  L12: 'keys sorted alphabetically',
  P1: 'every en key exists in de, fa, ckb',
  P2: 'no key that en lacks',
  P3: 'same placeholders and types as en',
  P4: 'same =N plural branches as en',
  P5: 'debug.* texts (S15) equal en in de, fa and ckb',
  F1: 'en/de/fa/ckb.json exist, flat objects of strings',
  G1: 'a game catalog holds <game-id>.name, <game-id>.win-title and <game-id>.tagline (the identity keys)',
};

const SPEC = {
  name: 'check-catalogs',
  summary: 'Checks the message catalogs of the Shell (packages/shell/src/i18n/catalogs/) and of every game (apps/<game-id>/src/i18n/): key shape and namespace, ICU syntax, placeholders, plurals, digits, bidi controls, Persian letters and punctuation, whole sentences, sorting, parity of de/fa/ckb with en, and the English debug menu (debug.* texts equal en in every language).',
  usage: '[repo-root | catalog-dir...]',
  options: {
    root: { type: 'string', value: 'dir', help: 'App repo root, used to find the catalogs when no folder is given (same as a positional repo-root)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'Rules (the same ids as the project linter behind npm run i18n:verify):',
    ...Object.entries(RULES).map(([id, [name]]) => `  ${`${id} ${name}`.padEnd(24)}${RULE_SUMMARIES[id] ?? ''}`),
    '',
    'One positional folder with an apps/ or packages/ folder inside is the repo root (default .).',
    'Any other folder given on the command line is a Shell catalog folder unless it is',
    'apps/<game-id>/src/i18n, in which case its keys must start with "<game-id>.".',
    '',
    'Example: node check-catalogs.mjs .',
  ].join('\n'),
};

function discover(root) {
  const dirs = [];
  const appsDir = join(root, 'apps');
  const gameIds = existsSync(appsDir) ? readdirSync(appsDir).filter((id) => statSync(join(appsDir, id)).isDirectory()).sort() : [];
  const shellDir = join(root, 'packages', 'shell', 'src', 'i18n', 'catalogs');
  if (existsSync(shellDir)) dirs.push({ dir: shellDir, namespace: { kind: 'shell', gameIds } });
  for (const gameId of gameIds) {
    const dir = join(appsDir, gameId, 'src', 'i18n');
    if (existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.json'))) dirs.push({ dir, namespace: { kind: 'game', gameId } });
  }
  return dirs;
}

function namespaceFor(dir, root) {
  const parts = toPosix(resolve(dir)).split('/');
  const at = parts.lastIndexOf('apps');
  if (at !== -1 && parts[at + 2] === 'src' && parts[at + 3] === 'i18n') return { kind: 'game', gameId: parts[at + 1] };
  const appsDir = join(root, 'apps');
  const gameIds = existsSync(appsDir) ? readdirSync(appsDir) : [];
  return { kind: 'shell', gameIds };
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const isRepoRoot = (dir) => existsSync(join(dir, 'apps')) || existsSync(join(dir, 'packages'));
  const rootArg = options.root ?? (positionals.length === 1 && isRepoRoot(positionals[0]) ? positionals[0] : '.');
  const folders = rootArg === positionals[0] && options.root === undefined ? [] : positionals;
  const root = resolve(rootArg);
  const targets = folders.length > 0
    ? folders.map((dir) => {
        if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`nothing to check: catalog folder ${dir} does not exist`, 'Pass a folder that holds en.json, de.json, fa.json and ckb.json.');
        return { dir: resolve(dir), namespace: namespaceFor(dir, root) };
      })
    : discover(root);
  if (targets.length === 0) {
    fail(`nothing to check: no catalogs under ${rootArg} (looked for packages/shell/src/i18n/catalogs and apps/*/src/i18n)`, 'Run from the app repo root, or pass the repo root or a catalog folder.');
  }
  const report = createReporter({ name: 'check-catalogs', json: options.json });
  const shown = (file) => toPosix(relative(process.cwd(), file)) || basename(file);
  let checked = 0;
  for (const { dir, namespace } of targets) {
    const catalogs = {};
    for (const language of LANGUAGES) {
      const file = join(dir, `${language}.json`);
      if (!existsSync(file)) {
        report.problem({ file: shown(file), line: 1, rule: ruleLabel('F1'), message: `${language}.json is missing`, fix: RULES.F1[1] });
        continue;
      }
      const text = readFileSync(file, 'utf8');
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        report.problem({ file: shown(file), line: 1, rule: ruleLabel('F1'), message: `not valid JSON: ${error.message}`, fix: RULES.F1[1] });
        continue;
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        report.problem({ file: shown(file), line: 1, rule: ruleLabel('F1'), message: 'not a flat JSON object', fix: RULES.F1[1] });
        continue;
      }
      catalogs[language] = { file, text, data };
      checked += 1;
      if (namespace.kind === 'game') {
        for (const key of requiredGameKeys(namespace.gameId).filter((k) => !Object.hasOwn(data, k))) {
          report.problem({ file: shown(file), line: 1, rule: ruleLabel('G1'), message: `missing required game key "${key}" (the Shell reads it through the identity)`, fix: RULES.G1[1] });
        }
      }
      const keys = Object.keys(data);
      const sorted = [...keys].sort();
      const firstUnsorted = keys.findIndex((key, index) => key !== sorted[index]);
      if (firstUnsorted !== -1) {
        report.problem({ file: shown(file), line: lineOfKey(text, keys[firstUnsorted]), rule: ruleLabel('L12'), message: `keys are not sorted alphabetically (first out of place: "${keys[firstUnsorted]}")`, fix: RULES.L12[1] });
      }
      for (const [key, message] of Object.entries(data)) {
        for (const problem of lintMessage({ language, key, message, namespace })) {
          report.problem({ file: shown(file), line: lineOfKey(text, key), rule: ruleLabel(problem.id), message: `${key}: ${problem.message}`, fix: RULES[problem.id][1] });
        }
      }
    }
    const source = catalogs[SOURCE_LANGUAGE];
    if (!source) continue;
    for (const language of LANGUAGES.filter((l) => l !== SOURCE_LANGUAGE)) {
      const target = catalogs[language];
      if (!target) continue;
      for (const key of Object.keys(source.data)) {
        if (!Object.hasOwn(target.data, key)) {
          report.problem({ file: shown(target.file), line: 1, rule: ruleLabel('P1'), message: `${key}: missing in ${language} (present in en)`, fix: RULES.P1[1] });
          continue;
        }
        if (typeof source.data[key] !== 'string' || typeof target.data[key] !== 'string') continue;
        const debugProblem = debugEnglishProblem(key, source.data[key], target.data[key], language);
        if (debugProblem) report.problem({ file: shown(target.file), line: lineOfKey(target.text, key), rule: ruleLabel(debugProblem.id), message: `${key}: ${debugProblem.message}`, fix: RULES.P5[1] });
        for (const problem of parityProblems(source.data[key], target.data[key])) {
          report.problem({ file: shown(target.file), line: lineOfKey(target.text, key), rule: ruleLabel(problem.id), message: `${key}: ${problem.message}`, fix: RULES[problem.id][1] });
        }
      }
      for (const key of Object.keys(target.data).filter((k) => !Object.hasOwn(source.data, k))) {
        report.problem({ file: shown(target.file), line: lineOfKey(target.text, key), rule: ruleLabel('P2'), message: `${key}: not in en.json`, fix: RULES.P2[1] });
      }
    }
  }
  return report.finish({ checked, unit: 'catalog files' });
});
