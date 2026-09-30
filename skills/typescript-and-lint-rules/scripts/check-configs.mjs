#!/usr/bin/env node
// check-configs.mjs: checks that the app repo's TypeScript, ESLint and Prettier configuration is the
// canonical, strict set from assets/ts-lint-baseline.json and has not been weakened.
// Run from the app repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-configs.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { scanSource } from './lib/source-scan.mjs';

const BASELINE = JSON.parse(readFileSync(new URL('../assets/ts-lint-baseline.json', import.meta.url), 'utf8'));

const SPEC = {
  name: 'check-configs',
  summary:
    'Checks the monorepo configuration against the canonical strict set: tsconfig.base.json options, the workspace ' +
    'tsconfig files (types, lib, include per world), eslint.config.mjs (required rules, limit values, no warn tier, ' +
    'no disabled safety rules, Prettier last, the messages the quality-gates.json guardrail compares), .prettierrc.json, ' +
    '.prettierignore, pre-existing top-level folders in both ignore lists, the exact lint/type tool versions and the lint scripts.',
  usage: '[options] [repo-root]',
  options: {
    only: { type: 'string', value: 'area', help: 'Check one area only: tsconfig, eslint, prettier or package' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  tsconfig-missing        a required tsconfig file (base, root, a workspace) does not exist',
    '  tsconfig-base-option    tsconfig.base.json lacks a required compiler option, or has a weaker value',
    '  tsconfig-workspace      a workspace tsconfig sets more than types/lib/include/exclude, or does not extend the base',
    '  tsconfig-world          a workspace tsconfig has the wrong types, lib, include or exclude for its world',
    '  tsconfig-expo-env       a tsconfig includes expo-env.d.ts or .expo/types (breaks TextStyle under the Strict API)',
    '  app-env                 packages/shell/src/app-env.d.ts is missing or does not declare process and EXPO_PUBLIC_APP_VARIANT',
    '  eslint-missing          eslint.config.mjs does not exist',
    '  eslint-required         a required setting or rule of the canonical config is missing',
    '  eslint-limit-changed    a size or complexity limit has a value other than the canonical one',
    '  eslint-rule-off         a rule is switched off (\'off\', [\'off\'] or 0) more often than the canonical config does',
    '  eslint-weakened         a construct that disables rules wholesale (disableTypeChecked, noInlineConfig: false)',
    '                          appears more often than in the canonical config',
    '  eslint-warn             a rule uses the "warn" severity (there is no warning tier)',
    '  eslint-forbidden-import the config imports a forbidden plugin (eslint-plugin-prettier)',
    '  config-stray            a second ESLint or Prettier config file exists (.eslintrc*, .prettierrc.js, ...)',
    '  prettier-option         .prettierrc.json is missing or an option differs from the canonical value',
    '  prettier-ignore         .prettierignore is missing, lacks a required line (generated folders, snapshots, skills/,',
    '                          .claude/) or still holds the __PRE_EXISTING__ placeholder',
    '  ignore-pre-existing     a top-level folder or file that is not part of the monorepo layout (knowledge, design exports,',
    '                          notes) is not ignored by .prettierignore (folders and files Prettier formats) or by',
    '                          PRE_EXISTING in eslint.config.mjs (folders and JS/TS files)',
    '  package-pin             a lint/type tool is missing from the root devDependencies or not pinned to the verified version',
    '  lint-script             an npm script that runs eslint lacks --max-warnings 0 or passes an override flag',
    '',
    'Example: node check-configs.mjs .            (from the app repo root)',
  ].join('\n'),
};

const AREAS = ['tsconfig', 'eslint', 'prettier', 'package'];

function readJsonc(path) {
  const text = scanSource(readFileSync(path, 'utf8')).codeKeep.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = (value) => JSON.stringify(value);

function subfolders(root, parent) {
  const dir = join(root, parent);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => `${parent}/${entry.name}`)
    .sort();
}

function checkBase(root, report) {
  const spec = BASELINE.tsconfigBase;
  const path = join(root, spec.file);
  if (!existsSync(path)) {
    report.problem({ file: spec.file, rule: 'tsconfig-missing', message: `${spec.file} does not exist`, fix: 'Copy templates/tsconfig.base.json to the repo root.' });
    return;
  }
  const config = readJsonc(path);
  if (config.extends !== spec.extends) {
    report.problem({ file: spec.file, line: 1, rule: 'tsconfig-base-option', message: `extends is ${show(config.extends)}, expected "${spec.extends}"`, fix: `Set "extends": "${spec.extends}".` });
  }
  const options = config.compilerOptions ?? {};
  for (const [key, want] of Object.entries(spec.compilerOptions)) {
    if (!same(options[key], want)) {
      report.problem({ file: spec.file, line: 1, rule: 'tsconfig-base-option', message: `compilerOptions.${key} is ${show(options[key])}, expected ${show(want)}`, fix: `Set "${key}": ${show(want)} (templates/tsconfig.base.json).` });
    }
  }
  for (const key of spec.notTrue) {
    if (options[key] === true) {
      report.problem({ file: spec.file, line: 1, rule: 'tsconfig-base-option', message: `compilerOptions.${key} is true; ESLint's no-unused-vars is the one reporter for unused code`, fix: `Remove "${key}" (it stays off so "_"-prefixed parameters work).` });
    }
  }
}

function workspaceFiles(root, spec) {
  if (!spec.file.includes('*')) return [spec.file];
  const [parent] = spec.file.split('/*/');
  return subfolders(root, parent)
    .filter((dir) => existsSync(join(root, dir, 'package.json')) || existsSync(join(root, dir, 'tsconfig.json')))
    .map((dir) => `${dir}/tsconfig.json`);
}

function checkWorkspaceConfig(root, file, spec, report) {
  const config = readJsonc(join(root, file));
  const extraKeys = Object.keys(config).filter((key) => !['$schema', 'extends', 'compilerOptions', 'include', 'exclude'].includes(key));
  const extraOptions = Object.keys(config.compilerOptions ?? {}).filter((key) => !['types', 'lib'].includes(key));
  for (const key of [...extraKeys, ...extraOptions.map((key) => `compilerOptions.${key}`)]) {
    report.problem({ file, line: 1, rule: 'tsconfig-workspace', message: `sets ${key}; a workspace tsconfig may only set types, lib, include and exclude`, fix: 'Remove it; compiler options live in tsconfig.base.json so every app gets the same guarantees.' });
  }
  if (config.extends !== spec.extends) {
    report.problem({ file, line: 1, rule: 'tsconfig-workspace', message: `extends is ${show(config.extends)}, expected "${spec.extends}"`, fix: `Set "extends": "${spec.extends}".` });
  }
  const types = config.compilerOptions?.types;
  if (!same(types, spec.types)) {
    report.problem({ file, line: 1, rule: 'tsconfig-world', message: `compilerOptions.types is ${show(types)}, expected ${show(spec.types)} (${spec.world} world)`, fix: `Set "types": ${show(spec.types)}; app code never sees Node types and Node code never ships in an app.` });
  }
  const lib = config.compilerOptions?.lib ?? null;
  if (!same(lib, spec.lib)) {
    report.problem({ file, line: 1, rule: 'tsconfig-world', message: `compilerOptions.lib is ${show(lib)}, expected ${spec.lib === null ? 'no lib (the Expo base decides)' : show(spec.lib)}`, fix: spec.lib === null ? 'Remove "lib".' : `Set "lib": ${show(spec.lib)}.` });
  }
  if (spec.include && !same(config.include, spec.include)) {
    const missing = spec.include.filter((entry) => !(config.include ?? []).includes(entry));
    const why = missing.map((entry) => spec.includeWhy?.[entry]).filter(Boolean);
    const lacks = missing.length > 0 ? `; it lacks ${missing.map((entry) => `"${entry}"`).join(', ')}${why.length > 0 ? ` (${why.join('; ')})` : ''}` : '';
    report.problem({ file, line: 1, rule: 'tsconfig-world', message: `include is ${show(config.include)}, expected ${show(spec.include)}${lacks}`, fix: 'Copy the include list from the matching template (templates/tsconfig.app.json for an app).' });
  }
  for (const entry of spec.includeContains ?? []) {
    if (!(config.include ?? []).includes(entry)) {
      report.problem({ file, line: 1, rule: 'tsconfig-world', message: `include lacks "${entry}"`, fix: `Add "${entry}" to include (templates/tsconfig.root.json).` });
    }
  }
  if (spec.includeContains) {
    for (const entry of config.include ?? []) {
      const runtime = BASELINE.rootIncludeForbidden.find((prefix) => entry.startsWith(prefix.replace('/**', '/')) && !spec.includeContains.includes(entry));
      if (runtime) report.problem({ file, line: 1, rule: 'tsconfig-world', message: `include "${entry}" pulls app code into the Node/test program`, fix: 'Remove it; app code is checked by its own workspace tsconfig.' });
    }
  }
  if (!same(config.exclude ?? null, spec.exclude)) {
    report.problem({ file, line: 1, rule: 'tsconfig-world', message: `exclude is ${show(config.exclude ?? null)}, expected ${show(spec.exclude)}`, fix: spec.exclude === null ? 'Remove "exclude".' : `Set "exclude": ${show(spec.exclude)}.` });
  }
  const text = JSON.stringify(config);
  if (/expo-env\.d\.ts|\.expo\/types/.test(text)) {
    report.problem({ file, line: 1, rule: 'tsconfig-expo-env', message: 'includes expo-env.d.ts or .expo/types', fix: 'Remove it: expo/types augments React Native with web props and breaks TextStyle (TS2559).' });
  }
}

function checkTsconfigs(root, report) {
  checkBase(root, report);
  for (const spec of BASELINE.workspaceTsconfigs) {
    const files = workspaceFiles(root, spec);
    for (const file of files) {
      if (!existsSync(join(root, file))) {
        report.problem({ file, rule: 'tsconfig-missing', message: `${file} does not exist`, fix: 'Copy the matching tsconfig template; every workspace is its own tsc program.' });
        continue;
      }
      checkWorkspaceConfig(root, file, spec, report);
    }
  }
  const shell = join(root, 'packages/shell');
  if (existsSync(shell)) {
    const envFile = 'packages/shell/src/app-env.d.ts';
    const envPath = join(root, envFile);
    const text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    if (!/declare const process\s*:/.test(text) || !/EXPO_PUBLIC_APP_VARIANT\??\s*:/.test(text)) {
      report.problem({ file: envFile, line: 1, rule: 'app-env', message: existsSync(envPath) ? 'does not declare `process` and EXPO_PUBLIC_APP_VARIANT' : 'does not exist', fix: 'Copy templates/app-env.d.ts; app programs have no @types/node, so process and each EXPO_PUBLIC_* variable are declared there.' });
    }
  }
}

function checkEslint(root, report) {
  const spec = BASELINE.eslint;
  const path = join(root, spec.file);
  if (!existsSync(path)) {
    report.problem({ file: spec.file, rule: 'eslint-missing', message: 'eslint.config.mjs does not exist', fix: 'Copy templates/eslint.config.mjs to the repo root.' });
    return;
  }
  const raw = readFileSync(path, 'utf8');
  const scan = scanSource(raw);
  const code = scan.codeKeep;
  for (const item of spec.required) {
    if (!new RegExp(item.pattern, 'm').test(code)) {
      report.problem({ file: spec.file, rule: 'eslint-required', message: `missing ${item.what} [${item.id}]`, fix: 'Restore it from templates/eslint.config.mjs; the canonical config is the only place rules live.' });
    }
  }
  for (const limit of spec.limitValues) {
    for (const match of code.matchAll(new RegExp(limit.pattern, 'g'))) {
      const value = Number(match[1]);
      if (!limit.allowed.includes(value)) {
        report.problem({ file: spec.file, line: scan.lineOf(match.index), rule: 'eslint-limit-changed', message: `${limit.rule} is ${value}; the canonical values are ${limit.allowed.join(' or ')}`, fix: 'Put the limit back and split the code by responsibility instead; a limit change needs the owner and a Gate-Change trailer.' });
      }
    }
  }
  // Every rule switched off, in any spelling: 'rule': 'off', 'rule': ['off'], 'rule': 0, bare: 'off'.
  // offAllowed lists every "off" of the canonical config with its count; any other one is a weakening.
  const offHits = new Map();
  const offPattern = /(?:(['"])([^'"\n]+)\1\s*:\s*(?:\[\s*)?(?:'off'|"off"|0)|(?<![\w$'".-])([A-Za-z_$][\w$]*)\s*:\s*(?:\[\s*)?(?:'off'|"off"))(?![\w.])/g;
  for (const match of code.matchAll(offPattern)) {
    const rule = match[2] ?? match[3];
    offHits.set(rule, [...(offHits.get(rule) ?? []), match.index]);
  }
  for (const [rule, hits] of offHits) {
    const allowed = spec.offAllowed[rule] ?? 0;
    if (hits.length > allowed) {
      report.problem({ file: spec.file, line: scan.lineOf(hits[allowed] ?? hits[0]), rule: 'eslint-rule-off', message: `${rule} is switched off ${hits.length} times; the canonical config does it ${allowed} times`, fix: 'Remove the extra "off"; fix the code, or add a file-exact exception block that rebuilds the rule from the shared lists.' });
    }
  }
  for (const item of spec.maxOccurrences) {
    const hits = [...code.matchAll(new RegExp(item.pattern, 'g'))];
    if (hits.length > item.max) {
      report.problem({ file: spec.file, line: scan.lineOf(hits[item.max].index), rule: 'eslint-weakened', message: `${item.what} appears ${hits.length} times; the canonical config has ${item.max} [${item.id}]`, fix: 'Remove it; the canonical config is the only place rules are switched off, and only for named files.' });
    }
  }
  // A severity is the value of a rule key: 'rule': 'warn' or 'rule': ['warn', ...]. The only other
  // place 'warn' appears is no-console's { allow: ['warn', 'error'] }, which is not a severity.
  for (const match of code.matchAll(/(?:(['"])([^'"\n]+)\1|([A-Za-z_$][\w$]*))\s*:\s*(\[\s*)?(['"])warn\5/g)) {
    if (match[3] === 'allow') continue;
    report.problem({ file: spec.file, line: scan.lineOf(match.index), rule: 'eslint-warn', message: 'a rule uses the "warn" severity', fix: "Use 'error': every rule is an error and lint runs with --max-warnings 0." });
  }
  for (const name of spec.forbiddenImports) {
    const at = code.indexOf(`'${name}'`);
    if (at !== -1) report.problem({ file: spec.file, line: scan.lineOf(at), rule: 'eslint-forbidden-import', message: `imports ${name}`, fix: 'Prettier runs as its own check (format:check); eslint-config-prettier only turns conflicting rules off.' });
  }
}

function checkStray(root, report, area) {
  for (const name of BASELINE.strayConfigs) {
    const isEslint = name.includes('eslint');
    if ((area === 'eslint') !== isEslint && area !== undefined) continue;
    if (existsSync(join(root, name))) {
      report.problem({ file: name, rule: 'config-stray', message: `${name} is a second ${isEslint ? 'ESLint' : 'Prettier'} config`, fix: `Delete it; the only configs are ${isEslint ? 'eslint.config.mjs' : '.prettierrc.json and .prettierignore'}.` });
    }
  }
  if (area === 'eslint' || area === undefined) {
    for (const dir of [...subfolders(root, 'packages'), ...subfolders(root, 'apps')]) {
      for (const name of ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', '.eslintrc.json', '.eslintrc.js']) {
        if (existsSync(join(root, dir, name))) {
          report.problem({ file: `${dir}/${name}`, rule: 'config-stray', message: 'a workspace has its own ESLint config', fix: 'Delete it; one eslint.config.mjs at the repo root lints the whole monorepo.' });
        }
      }
    }
  }
}

function checkPrettier(root, report) {
  const spec = BASELINE.prettier;
  const path = join(root, spec.file);
  if (!existsSync(path)) {
    report.problem({ file: spec.file, rule: 'prettier-option', message: '.prettierrc.json does not exist', fix: 'Copy templates/.prettierrc.json to the repo root.' });
    return;
  }
  const config = readJsonc(path);
  for (const [key, want] of Object.entries(spec.options)) {
    if (!same(config[key], want)) {
      report.problem({ file: spec.file, line: 1, rule: 'prettier-option', message: `${key} is ${show(config[key])}, expected ${show(want)}`, fix: `Set "${key}": ${show(want)}.` });
    }
  }
}

/** Top-level entries that are not part of the monorepo layout (knowledge folders, design exports, notes). */
function preExistingEntries(root) {
  const layout = new Set(BASELINE.monorepoTopLevel);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && !layout.has(entry.name))
    .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

function ignoreLines(root) {
  const path = join(root, BASELINE.prettierIgnore.file);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('#'));
}

function checkPrettierIgnore(root, report) {
  const spec = BASELINE.prettierIgnore;
  const lines = ignoreLines(root);
  if (lines === null) {
    report.problem({ file: spec.file, rule: 'prettier-ignore', message: '.prettierignore does not exist', fix: 'Copy templates/.prettierignore and replace __PRE_EXISTING__ with one line per pre-existing top-level entry.' });
    return;
  }
  for (const line of spec.requiredLines) {
    if (!lines.includes(line)) report.problem({ file: spec.file, line: 1, rule: 'prettier-ignore', message: `.prettierignore lacks "${line}"`, fix: `Add the line ${line} (templates/.prettierignore): Prettier must not reformat generated, vendored or skill files.` });
  }
  if (lines.includes(spec.placeholder)) report.problem({ file: spec.file, line: 1, rule: 'prettier-ignore', message: `.prettierignore still holds the ${spec.placeholder} placeholder`, fix: 'Replace it with one line per pre-existing top-level entry (handbook/, README.md), or delete it when there is none.' });
}

function checkPreExisting(root, report, area) {
  const entries = preExistingEntries(root);
  if (entries.length === 0) return;
  const lines = area === 'eslint' ? null : ignoreLines(root);
  const eslintPath = join(root, BASELINE.eslint.file);
  const eslint = area === 'prettier' || !existsSync(eslintPath) ? null : scanSource(readFileSync(eslintPath, 'utf8')).codeKeep;
  // Prettier only formats files it has a parser for, and ESLint only lints JS/TS files.
  const PRETTIER_FILE = /\.(md|mdx|html?|json5?|jsonc|ya?ml|css|scss|less|[cm]?[jt]sx?|graphql|gql|hbs|vue)$/i;
  const ESLINT_FILE = /\.[cm]?[jt]sx?$/i;
  for (const entry of entries) {
    const shown = entry.isDir ? `${entry.name}/` : entry.name;
    const forms = [entry.name, `${entry.name}/`, `/${entry.name}`, `/${entry.name}/`, `${entry.name}/**`, `/${entry.name}/**`];
    if (lines !== null && (entry.isDir || PRETTIER_FILE.test(entry.name)) && !forms.some((form) => lines.includes(form))) {
      report.problem({ file: '.prettierignore', line: 1, rule: 'ignore-pre-existing', message: `the pre-existing ${entry.isDir ? 'folder' : 'file'} ${shown} is not ignored, so format:check would reformat the owner's files`, fix: `Add the line ${shown} to .prettierignore (or move it into the monorepo layout).` });
    }
    const glob = entry.isDir ? `${entry.name}/**` : entry.name;
    if (eslint !== null && (entry.isDir || ESLINT_FILE.test(entry.name)) && !eslint.includes(`'${glob}'`) && !eslint.includes(`'${entry.name}'`)) {
      report.problem({ file: BASELINE.eslint.file, line: 1, rule: 'ignore-pre-existing', message: `the pre-existing ${entry.isDir ? 'folder' : 'file'} ${shown} is not in PRE_EXISTING, so ESLint would lint it`, fix: `Add '${glob}' to the PRE_EXISTING list in eslint.config.mjs (a Gate-Change: trailer).` });
    }
  }
}

function checkPackage(root, report) {
  const path = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  for (const [name, allowed] of Object.entries(BASELINE.pins)) {
    const got = deps[name];
    if (got === undefined) {
      report.problem({ file: 'package.json', line: 1, rule: 'package-pin', message: `${name} is not a root devDependency`, fix: `npm install -D -E ${name}@${allowed[0]} (the verified version).` });
    } else if (!allowed.includes(got)) {
      report.problem({ file: 'package.json', line: 1, rule: 'package-pin', message: `${name} is "${got}", expected ${allowed.map((v) => `"${v}"`).join(' or ')}`, fix: `Pin ${name} to exactly ${allowed[0]} (the verified set; ESLint 10 and TypeScript 7 break it). Upgrades are deliberate changes: stop and ask.` });
    }
  }
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    if (!/(^|[\s&|;])(npx\s+)?eslint\s/.test(`${command} `)) continue;
    for (const segment of command.split(/&&|\|\||;/).filter((part) => /(^|\s)(npx\s+)?eslint\s/.test(` ${part} `))) {
      if (/--fix\b/.test(segment)) continue;
      for (const flag of BASELINE.lintScript.requires) {
        if (!segment.includes(flag)) report.problem({ file: 'package.json', line: 1, rule: 'lint-script', message: `script "${name}" runs eslint without ${flag}`, fix: `Add ${flag}: a warning must fail the run.` });
      }
      for (const flag of BASELINE.lintScript.forbids) {
        if (` ${segment} `.includes(flag.startsWith(' ') ? flag : ` ${flag}`)) report.problem({ file: 'package.json', line: 1, rule: 'lint-script', message: `script "${name}" passes ${flag.trim()} to eslint`, fix: 'Remove it; CLI overrides bypass eslint.config.mjs and the guardrail cannot see them.' });
      }
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (options.only !== undefined && !AREAS.includes(options.only)) {
    fail(`--only ${options.only} is not an area`, `Use one of: ${AREAS.join(', ')}.`);
  }
  const area = options.only;
  const wants = (name) => area === undefined || area === name;
  if (wants('package') && !existsSync(join(root, 'package.json'))) {
    fail(`nothing to check: ${root} has no package.json`, 'Run from the app repo root, or pass it as the argument.');
  }
  const report = createReporter({ name: 'check-configs', json: options.json });
  let checked = 0;
  if (wants('tsconfig')) {
    checkTsconfigs(root, report);
    checked += 1;
  }
  if (wants('eslint')) {
    checkEslint(root, report);
    checked += 1;
  }
  if (wants('prettier')) {
    checkPrettier(root, report);
    checkPrettierIgnore(root, report);
    checked += 1;
  }
  if (wants('eslint') || wants('prettier')) checkPreExisting(root, report, area);
  if (wants('eslint') || wants('prettier')) checkStray(root, report, area);
  if (wants('package')) {
    checkPackage(root, report);
    checked += 1;
  }
  return report.finish({ checked, unit: 'config areas' });
});
