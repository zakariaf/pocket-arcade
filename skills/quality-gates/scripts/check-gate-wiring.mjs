#!/usr/bin/env node
// check-gate-wiring.mjs: checks, without running any tool, that the repo's quality gates are wired
// and not weakened: the canonical npm scripts, lefthook.yml, .claude/settings.json hooks and
// permissions, quality-gates.json (no value weaker than this skill's baseline), .npmrc policy lines,
// ESLint linter options, Jest thresholds, and the tooling files the gates run.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-gate-wiring.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHELL_DUE_TARGETS, createReporter, dueSkipReason, fail, parseArgs, readShellSlice, requireDir, run } from './check-lib.mjs';
import { findWeaker } from './lib/not-weaker.mjs';

const SPEC = {
  name: 'check-gate-wiring',
  summary: 'Checks that every quality gate is present, wired into the hooks, and no weaker than the baseline in this skill\'s templates.',
  usage: '[options] [repo-root]',
  options: {
    pending: { type: 'string', multiple: true, value: 'path', help: 'A script target another skill has not built yet (a note instead of its not-yet-due SKIP line; still accepted, no longer needed)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  gate-file-missing       a gate file or a tooling file this skill ships is missing',
    '  script-target           a canonical npm script runs a file that does not exist. A target a later Shell',
    '                          build step creates prints a not-yet-due SKIP instead (dueSkipReason): i18n:verify',
    '                          (step 6), audit:network, audit:privacy and build:ios:sim (step 8), e2e:ios and',
    '                          screenshots:ios (step 10, SHELL_DUE_TARGETS.e2e), release:ios (step 11,',
    '                          SHELL_DUE_TARGETS.release); every other target (verify, audit:licenses, new-game)',
    '                          exists from Shell step 1 and is a problem when missing',
    '  npm-script              a canonical npm script is missing or differs from the baseline',
    '  gate-weakened           quality-gates.json holds a value weaker than the baseline, or lost an entry',
    '  claude-settings         .claude/settings.json lost a deny/ask rule, a hook, or allows a bypass',
    '  lefthook                a pre-commit, commit-msg or pre-push job is missing, changed or skipped',
    '  npmrc                   .npmrc lacks min-release-age=7, engine-strict=true or save-exact=true',
    '  eslint-linter-options   eslint.config.mjs no longer makes inline disables inert and reported',
    '  jest-thresholds         jest.config.js coverage thresholds are below 90/90/90/85 or 95/95/95/90',
    '  gate-scope              a gate reaches into skills/ or .claude/: the commit-msg rules lack the folder',
    '                          exclusion, or an Edit(**/...) ask rule prompts for skill files',
    '  gate-script-changed     a canonical gate script differs from this skill\'s template: the verify steps',
    '                          (verify-plan.ts, run-verify.ts), the shell-slice.json reader or the device-only',
    '                          coverage helper',
    '  shell-slice             shell-slice.json exists but is malformed (verify would stop on it)',
    '  knip-ignores            knip.json adds an ignoreBinaries, ignoreDependencies or other ignore entry the',
    '                          baseline does not have (each baseline entry has a documented reason)',
    '',
    'The repo root is the optional positional argument (default "."). A fresh skeleton (Shell step 1) passes',
    'with seven script-target SKIP lines, one per target a later step builds; each disappears at its step:',
    '  node check-gate-wiring.mjs .',
    '--pending <path> is still accepted: it turns that target\'s SKIP line into a note.',
    '',
    'The baseline quality-gates.json names the pilot app __GAME_ID__; the repo\'s own gate-probe app stands in.',
    'The baseline is this skill\'s templates/ (package-scripts.json, quality-gates.json, claude-settings.json, lefthook.yml).',
  ].join('\n'),
};

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, '..', 'templates');
const SHIPPED = [
  'packages/tooling/src/quality/check-quality-gates.ts',
  'packages/tooling/src/quality/gate-diff.ts',
  'packages/tooling/src/hooks/after-edit.ts',
  'packages/tooling/src/git/check-commit-message.ts',
  'packages/tooling/src/git/commit-message-rules.ts',
  'packages/tooling/src/git/commit-trailer-rules.ts',
  'packages/tooling/src/quality/run-verify.ts',
  'packages/tooling/src/quality/verify-plan.ts',
  'packages/tooling/src/quality/shell-slice.ts',
  'packages/tooling/src/quality/device-only.ts',
  'packages/tooling/src/deps/check-deps.ts',
  'packages/tooling/src/deps/app-lockstep.ts',
  'packages/tooling/src/deps/release-age-excludes.ts',
  'packages/tooling/src/clock/system-clock.ts',
  'packages/tooling/src/audit/audit-licenses.ts',
  'packages/tooling/src/audit/license-policy.ts',
];
const GATE_FILES = ['package.json', 'lefthook.yml', 'quality-gates.json', '.claude/settings.json', '.npmrc', 'eslint.config.mjs', 'knip.json', '.prettierrc.json', 'jest.config.js', 'tsconfig.base.json'];
/**
 * Script targets a later Shell build step creates, with that step and the skill that builds it: the
 * script-target rule SKIPs them through dueSkipReason while they are missing. Every other target of a
 * canonical script is written at Shell step 1 and must exist.
 */
const DUE_SCRIPT_TARGETS = [
  { target: { file: 'packages/tooling/src/i18n/verify-catalogs.ts', step: 6 }, owner: 'i18n-strings-and-catalogs' },
  { target: { file: 'packages/tooling/src/audit/audit-network.ts', step: 8 }, owner: 'privacy-and-network-audit' },
  { target: { file: 'packages/tooling/src/audit/audit-privacy.ts', step: 8 }, owner: 'privacy-and-network-audit' },
  { target: { file: 'packages/tooling/src/build/build-ios-sim.ts', step: 8 }, owner: 'ios-simulator-build' },
  { target: SHELL_DUE_TARGETS.e2e, owner: 'e2e-maestro' },
  { target: { file: 'packages/tooling/src/e2e/capture-screenshots-ios.ts', step: SHELL_DUE_TARGETS.e2e.step }, owner: 'e2e-maestro' },
  { target: SHELL_DUE_TARGETS.release, owner: 'ios-release-testflight' },
];
const NODE_TARGET = /^node\s+(\S+\.(?:ts|mjs|js))(?:\s|$)/;
const LINTER_OPTIONS = [/noInlineConfig:\s*true/, /reportUnusedDisableDirectives:\s*'error'/, /reportUnusedInlineConfigs:\s*'error'/];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function tryJson(root, rel, report) {
  try {
    return readJson(join(root, rel));
  } catch (error) {
    report.problem({ file: rel, line: 1, rule: rel.includes('settings') ? 'claude-settings' : 'gate-weakened', message: `is not valid JSON (${error.message.split('\n')[0]})`, fix: 'Restore the file from this skill\'s template and re-apply only agreed changes.' });
    return null;
  }
}

function checkScripts(root, report) {
  const baseline = readJson(join(TEMPLATES, 'package-scripts.json'));
  const pkg = tryJson(root, 'package.json', report);
  if (!pkg) return;
  for (const [name, command] of Object.entries(baseline)) {
    const actual = pkg.scripts?.[name];
    if (actual === undefined) report.problem({ file: 'package.json', line: 1, rule: 'npm-script', message: `script "${name}" is missing`, fix: `Add "${name}": ${JSON.stringify(command)}.` });
    else if (actual !== command) report.problem({ file: 'package.json', line: 1, rule: 'npm-script', message: `script "${name}" is ${JSON.stringify(actual)}`, fix: `Restore it to ${JSON.stringify(command)} (the guardrail compares it byte for byte).` });
  }
}

/**
 * script-target: every canonical script that runs `node <file>` names a file that exists. A target a
 * later Shell build step creates prints a not-yet-due SKIP while it is missing (or a note with
 * --pending); any other missing target is a problem, because the bootstrap writes it at step 1.
 */
function checkScriptTargets(root, pending, report) {
  const baseline = readJson(join(TEMPLATES, 'package-scripts.json'));
  let checked = 0;
  for (const [name, command] of Object.entries(baseline)) {
    const rel = NODE_TARGET.exec(command)?.[1];
    if (rel === undefined) continue;
    checked += 1;
    if (existsSync(join(root, rel))) continue;
    const due = DUE_SCRIPT_TARGETS.find((item) => item.target.file === rel);
    if (due && pending.has(rel)) {
      report.note(`note: ${rel} is pending (${due.owner} builds it at Shell step ${due.target.step}); npm run ${name} fails until it exists`);
      continue;
    }
    const reason = due ? dueSkipReason(root, due.target) : null;
    if (reason) report.skip({ file: 'package.json', rule: 'script-target', message: `npm run ${name}: ${reason} (${due.owner} copies it)` });
    else report.problem({ file: 'package.json', line: 1, rule: 'script-target', message: `npm run ${name} runs ${rel}, which does not exist`, fix: `Copy ${rel} from the skill that ships it (the bootstrap writes it at Shell step 1); a script must never point at a missing file.` });
  }
  return checked;
}

// The template names the pilot app __GAME_ID__ (the eslint probe apps/__GAME_ID__/src/rules/gate-probe.ts).
const GAME_PLACEHOLDER = '__GAME_ID__';
const APP_PROBE = /^apps\/([^/]+)\/src\/rules\/gate-probe\.ts$/;

/** The baseline with the repo's pilot app in place of __GAME_ID__ (the placeholder stays when none is found). */
function baselineGates(actual) {
  const pilot = Object.keys(actual?.eslint?.probes ?? {}).map((key) => APP_PROBE.exec(key)?.[1]).find((id) => id !== undefined && id !== GAME_PLACEHOLDER);
  const text = readFileSync(join(TEMPLATES, 'quality-gates.json'), 'utf8');
  return JSON.parse(pilot === undefined ? text : text.replaceAll(GAME_PLACEHOLDER, pilot));
}

function checkQualityGates(root, report) {
  const actual = tryJson(root, 'quality-gates.json', report);
  if (!actual) return;
  if (JSON.stringify(actual).includes(GAME_PLACEHOLDER)) report.problem({ file: 'quality-gates.json', line: 1, rule: 'gate-weakened', message: `still holds the ${GAME_PLACEHOLDER} placeholder`, fix: 'Replace __GAME_ID__ with the pilot app id (the folder under apps/ that holds src/rules/gate-probe.ts).' });
  for (const { path, message } of findWeaker(baselineGates(actual), actual)) {
    report.problem({ file: 'quality-gates.json', line: 1, rule: 'gate-weakened', message: `${path} ${message}`, fix: 'Restore the baseline value; a gate changes only with the owner\'s agreement, in one commit with the gate and a Gate-Change: trailer.' });
  }
}

function hookCommands(settings, event) {
  return (settings.hooks?.[event] ?? []).flatMap((entry) => (entry.hooks ?? []).map((hook) => ({ matcher: entry.matcher ?? '', text: [hook.command ?? '', ...(hook.args ?? [])].join(' ') })));
}

function checkSettings(root, report) {
  const actual = tryJson(root, '.claude/settings.json', report);
  if (!actual) return;
  const baseline = readJson(join(TEMPLATES, 'claude-settings.json'));
  const problem = (message, fix) => report.problem({ file: '.claude/settings.json', line: 1, rule: 'claude-settings', message, fix });
  for (const kind of ['deny', 'ask']) {
    for (const rule of baseline.permissions[kind]) {
      if (!(actual.permissions?.[kind] ?? []).includes(rule)) problem(`permissions.${kind} lost "${rule}"`, `Put "${rule}" back into permissions.${kind}.`);
    }
  }
  for (const rule of actual.permissions?.allow ?? []) {
    if (/no-verify|LEFTHOOK=0|hooksPath/.test(rule)) problem(`permissions.allow has "${rule}", which bypasses the git hooks`, 'Remove the rule; hooks are the only reviewer.');
  }
  if (actual.disableAllHooks === true) problem('disableAllHooks is true', 'Remove disableAllHooks; the PostToolUse and Stop hooks are gates.');
  const post = hookCommands(actual, 'PostToolUse').find((hook) => /(^|\|)Edit(\||$)/.test(hook.matcher) && /(^|\|)Write(\||$)/.test(hook.matcher) && hook.text.includes('packages/tooling/src/hooks/after-edit.ts'));
  if (!post) problem('no PostToolUse hook runs packages/tooling/src/hooks/after-edit.ts on Edit|Write', 'Restore the PostToolUse entry from templates/claude-settings.json.');
  const stop = hookCommands(actual, 'Stop').find((hook) => hook.text.includes('check:fast') && /exit 2/.test(hook.text));
  if (!stop) problem('no Stop hook runs npm run -s check:fast and exits 2 on failure', 'Restore the Stop entry from templates/claude-settings.json.');
}

// Gate scripts whose content is canonical: a repo copy that differs has changed a gate.
const CANONICAL_SCRIPTS = [
  'packages/tooling/src/quality/verify-plan.ts',
  'packages/tooling/src/quality/run-verify.ts',
  'packages/tooling/src/quality/shell-slice.ts',
  'packages/tooling/src/quality/device-only.ts',
];
const squash = (text) => text.replace(/\s+/g, '');

function checkCanonicalScripts(root, report) {
  for (const rel of CANONICAL_SCRIPTS) {
    if (!existsSync(join(root, rel))) continue;
    if (squash(readFileSync(join(root, rel), 'utf8')) === squash(readFileSync(join(TEMPLATES, rel), 'utf8'))) continue;
    report.problem({ file: rel, line: 1, rule: 'gate-script-changed', message: 'differs from the template: the verify steps, the partial-Shell rules and the coverage policy are canonical', fix: `Restore it from this skill's templates/${rel}; changing a step is a gate change (the owner's agreement, a Gate-Change trailer, and the template changed with it).` });
  }
}

/**
 * knip.json's ignore lists (ignoreBinaries, ignoreDependencies, ... at the top and per workspace) may
 * hold only the baseline's entries: each one has a documented reason, and a new entry silences knip.
 * The top-level "ignore" glob list is check-monorepo's (only skills/** and pre-existing folders).
 */
function ignoreLists(config) {
  const lists = [];
  const collect = (prefix, block) => {
    for (const [key, value] of Object.entries(block ?? {})) {
      if (/^ignore./.test(key) && Array.isArray(value)) lists.push({ path: `${prefix}${key}`, entries: value });
    }
  };
  collect('', config);
  for (const [name, block] of Object.entries(config.workspaces ?? {})) collect(`workspaces["${name}"].`, block);
  return lists;
}

function checkKnipIgnores(root, report) {
  const actual = tryJson(root, 'knip.json', report);
  if (!actual) return;
  const baseline = new Map(ignoreLists(readJson(join(TEMPLATES, 'knip.json'))).map(({ path, entries }) => [path, new Set(entries)]));
  for (const { path, entries } of ignoreLists(actual)) {
    for (const entry of entries.filter((item) => !(baseline.get(path)?.has(item) ?? false))) {
      report.problem({ file: 'knip.json', line: 1, rule: 'knip-ignores', message: `${path} adds "${entry}", which is not in the baseline: knip no longer reports it`, fix: 'Remove it and fix the finding (delete the dead code, add the missing dependency). A tool that is only spawned by name or imported by a root mock joins the list only with the owner\'s agreement, in this skill\'s template and quality-gates root-files reference, with a Gate-Change: trailer.' });
    }
  }
}

function checkShellSlice(root, report) {
  try {
    const slice = readShellSlice(root);
    if (slice) report.note(`note: shell-slice.json declares a partial Shell (${[...slice.screens].join(', ') || 'no Shell app'}): verify runs knip without the export and type kinds and skips test:sim until a sim exists; a slice never ships`);
  } catch (error) {
    report.problem({ file: 'shell-slice.json', line: 1, rule: 'shell-slice', message: error.message, fix: error.fix ?? 'Fix shell-slice.json or delete it (the full Shell).' });
  }
}

/** Skills and Claude Code files are knowledge, not gates: no gate may reach them through a wildcard. */
function checkGateScope(root, report) {
  const rel = 'packages/tooling/src/git/commit-trailer-rules.ts';
  const rules = existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null;
  if (rules !== null && !/UNGATED_FOLDERS = \['skills\/', '\.claude\/'\]/.test(rules)) report.problem({ file: rel, line: 1, rule: 'gate-scope', message: 'gated-path matching does not exclude skills/ and .claude/, so a skill edit matching a "**/" pattern demands a Gate-Change trailer', fix: 'Restore commit-trailer-rules.ts, commit-message-rules.ts and their test from this skill\'s templates (UNGATED_FOLDERS, isGatedFile).' });
  const settings = existsSync(join(root, '.claude/settings.json')) ? tryJson(root, '.claude/settings.json', report) : null;
  for (const rule of settings?.permissions?.ask ?? []) {
    if (/^Edit\(\*\*\//.test(rule)) report.problem({ file: '.claude/settings.json', line: 1, rule: 'gate-scope', message: `permissions.ask has ${rule}, which also prompts the owner for matching files under skills/`, fix: 'Anchor the rule at the repo root (Edit(/tsconfig*.json), Edit(/apps/**/tsconfig*.json), Edit(/packages/**/tsconfig*.json)), in .claude/settings.json and quality-gates.json together.' });
  }
}

function checkLefthook(root, report) {
  const text = readFileSync(join(root, 'lefthook.yml'), 'utf8');
  const lines = text.split('\n').map((line) => line.trim());
  const baseline = readFileSync(join(TEMPLATES, 'lefthook.yml'), 'utf8').split('\n').map((line) => line.trim());
  const wanted = baseline.filter((line) => /^(- name:|run:|assert_lefthook_installed:|parallel:|pre-commit:|commit-msg:|pre-push:)/.test(line));
  for (const line of wanted) {
    if (!lines.includes(line)) report.problem({ file: 'lefthook.yml', line: 1, rule: 'lefthook', message: `lost the line "${line}"`, fix: 'Restore lefthook.yml from this skill\'s template; the guardrail compares `lefthook dump` with quality-gates.json.' });
  }
  text.split('\n').forEach((line, index) => {
    if (/^\s*(skip|only)\s*:/.test(line)) report.problem({ file: 'lefthook.yml', line: index + 1, rule: 'lefthook', message: `"${line.trim()}" switches a hook job off`, fix: 'Remove it; a hook that is skipped is a gate that no longer runs.' });
  });
}

function checkTextGates(root, report) {
  const npmrc = readFileSync(join(root, '.npmrc'), 'utf8').split('\n').map((line) => line.trim());
  for (const line of ['min-release-age=7', 'engine-strict=true', 'save-exact=true']) {
    if (!npmrc.includes(line)) report.problem({ file: '.npmrc', line: 1, rule: 'npmrc', message: `lacks "${line}"`, fix: `Add the line "${line}" (the dependency policy the guardrail checks).` });
  }
  const eslint = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');
  for (const pattern of LINTER_OPTIONS) {
    if (!pattern.test(eslint)) report.problem({ file: 'eslint.config.mjs', line: 1, rule: 'eslint-linter-options', message: `linterOptions lacks ${pattern.source.replace(/\\s\*/g, ' ').replace(/\\/g, '')}`, fix: 'Keep linterOptions { noInlineConfig: true, reportUnusedDisableDirectives: \'error\', reportUnusedInlineConfigs: \'error\' }.' });
  }
  const jest = readFileSync(join(root, 'jest.config.js'), 'utf8');
  const blocks = [
    { name: 'global', re: /global\s*:\s*\{([^}]*)\}/, floor: { statements: 90, lines: 90, functions: 90, branches: 85 } },
    { name: 'logic folders', re: /LOGIC\s*=\s*\{([^}]*)\}/, floor: { statements: 95, lines: 95, functions: 95, branches: 90 } },
  ];
  for (const block of blocks) {
    const body = block.re.exec(jest)?.[1];
    for (const [key, floor] of Object.entries(block.floor)) {
      const value = body ? Number(new RegExp(`${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)`).exec(body)?.[1]) : Number.NaN;
      if (!(value >= floor)) report.problem({ file: 'jest.config.js', line: 1, rule: 'jest-thresholds', message: `${block.name} ${key} threshold is ${Number.isNaN(value) ? 'missing' : value} (at least ${floor})`, fix: 'Restore the coverage thresholds; add tests for uncovered behaviour instead of lowering them.' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!existsSync(join(root, 'package.json'))) fail(`no package.json in ${root}: this is not the repo root`, 'Run from the monorepo root or pass its path.');
  const report = createReporter({ name: 'check-gate-wiring', json: options.json });
  const pending = new Set(options.pending ?? []);
  let checked = 0;
  const present = new Set();
  for (const rel of [...GATE_FILES, ...SHIPPED]) {
    checked += 1;
    if (existsSync(join(root, rel))) present.add(rel);
    else report.problem({ file: rel, line: 0, rule: 'gate-file-missing', message: 'is missing', fix: `Copy it from this skill's templates/ (${rel.startsWith('packages/') ? rel : 'see the Files table'}).` });
  }
  if (present.has('package.json')) {
    checkScripts(root, report);
    checked += checkScriptTargets(root, pending, report);
  }
  if (present.has('quality-gates.json')) checkQualityGates(root, report);
  if (present.has('.claude/settings.json')) checkSettings(root, report);
  if (present.has('lefthook.yml')) checkLefthook(root, report);
  if (present.has('knip.json')) checkKnipIgnores(root, report);
  checkGateScope(root, report);
  checkCanonicalScripts(root, report);
  checkShellSlice(root, report);
  if (present.has('.npmrc') && present.has('eslint.config.mjs') && present.has('jest.config.js')) checkTextGates(root, report);
  return report.finish({ checked, unit: 'gate files' });
});
