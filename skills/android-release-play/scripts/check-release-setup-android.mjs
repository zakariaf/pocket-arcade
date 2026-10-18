#!/usr/bin/env node
// check-release-setup-android.mjs: checks the repo setup that release:android depends on: the npm
// script and the release tooling, the upload key kept outside the repo, .gitignore and the Claude
// Code deny rules for keystores and the service-account file, the service-account file read in one
// place only, every owner value a Play store build needs (G3 links, GP5 Android AdMob ids), and a
// complete Shell. A ship gate: it never skips; until the owner's steps are done it ends with the
// owner-placeholder lines and OWNER STEPS PENDING: ..., by design.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup-android.mjs .
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createReporter, fail, lineOf, maskComments, parseArgs, REPO_SCAN_IGNORES, requireDir, run, walk } from './check-lib.mjs';
import { ANDROID_AD_IDS_MISSING, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem, PLACEHOLDERS } from './lib/ship-placeholders.mjs';

const SCRIPT = 'node packages/tooling/src/release-android/release-android.ts';
const RELEASE_DIR = 'packages/tooling/src/release-android';
const RELEASE_FILES = ['release-android-plan.ts', 'aab-signing.ts', 'version-code.ts', 'play-credentials.ts', 'play-client.ts'];
const GITIGNORE = ['*.jks', '*.keystore', 'play-service-account.json'];
/** Google's sample AdMob publisher: its test ids belong to test builds (ads-config.ts), never in game.config.ts. */
const SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';
const DENY = ['Read(~/.android-keys/**)', 'Read(**/*.jks)', 'Read(**/*.keystore)', 'Read(**/play-service-account.json)'];

const SPEC = {
  name: 'check-release-setup-android',
  summary: 'Checks the repo setup that npm run release:android depends on: script and tooling, the upload key outside the repo, secrets ignored and denied, the service-account file read in one place, the owner values (G3, GP5), a complete Shell.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    `  npm-script         package.json release:android is exactly "${SCRIPT}" and that file exists`,
    `  release-files      ${RELEASE_DIR}/ holds ${RELEASE_FILES.join(', ')}`,
    '  keystore-outside   no *.jks or *.keystore inside the repo, and aab-signing.ts keeps the key in ~/.android-keys/',
    `  secrets-ignored    .gitignore lists ${GITIGNORE.join(', ')}; .claude/settings.json denies ${DENY.join(', ')}`,
    '  credentials-read   only play-credentials.ts names the service-account file (it reads it into memory, never prints it)',
    '  owner-placeholder  apps/<game>/game.config.ts: the example.com links (owner step G3) and, for a game with ads,',
    "                     ads.ids.android null, a placeholder or Google's sample (test) ids (owner step GP5); then",
    "                     'OWNER STEPS PENDING: ...'",
    '  shell-slice        shell-slice.json exists: a partial Shell never ships',
    '',
    'Exit 2 when the folder has no package.json and no apps/ (nothing to check).',
  ].join('\n'),
};

function read(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function checkScriptAndFiles(ctx) {
  let scripts = {};
  try {
    scripts = JSON.parse(read(ctx.root, 'package.json') ?? '{}').scripts ?? {};
  } catch (error) {
    fail(`package.json is not JSON (${error.message})`, 'Fix the root package.json.');
  }
  if (scripts['release:android'] !== SCRIPT) ctx.problem('package.json', 0, 'npm-script', `scripts["release:android"] is ${JSON.stringify(scripts['release:android'] ?? null)}`, `Set it to exactly "${SCRIPT}" (quality-gates' canonical script line).`);
  const target = SCRIPT.split(' ')[1];
  if (!existsSync(join(ctx.root, target))) ctx.problem(target, 0, 'npm-script', 'does not exist, so npm run release:android cannot start', `Copy templates/${target} (Android step 8).`);
  for (const name of RELEASE_FILES) {
    if (!existsSync(join(ctx.root, RELEASE_DIR, name))) ctx.problem(`${RELEASE_DIR}/${name}`, 0, 'release-files', 'is missing', `Copy templates/${RELEASE_DIR}/ with its tests (Android step 8).`);
  }
}

function checkKeystore(ctx) {
  for (const rel of walk(ctx.root, { include: ['*.jks', '*.keystore'], ignore: REPO_SCAN_IGNORES })) {
    ctx.problem(rel, 0, 'keystore-outside', 'a keystore inside the repo', 'Move it to ~/.android-keys/ (chmod 600) and never commit it; if it was ever committed, the key is burnt: ask the owner to reset the upload key in the Play Console.');
  }
  const signing = read(ctx.root, `${RELEASE_DIR}/aab-signing.ts`);
  if (signing !== null && !/join\(\s*home\s*,\s*'\.android-keys'/.test(maskComments(signing))) ctx.problem(`${RELEASE_DIR}/aab-signing.ts`, 0, 'keystore-outside', 'uploadKeyPathOf does not keep the key in ~/.android-keys/', 'Copy templates/packages/tooling/src/release-android/aab-signing.ts: the upload key lives outside the repo.');
}

function checkSecrets(ctx) {
  const lines = new Set((read(ctx.root, '.gitignore') ?? '').split('\n').map((line) => line.trim()));
  for (const entry of GITIGNORE) {
    if (!lines.has(entry)) ctx.problem('.gitignore', 0, 'secrets-ignored', `does not ignore ${entry}`, `Add the line ${entry}: a keystore or the service-account key must never reach git.`);
  }
  let deny = [];
  try {
    deny = JSON.parse(read(ctx.root, '.claude/settings.json') ?? '{}').permissions?.deny ?? [];
  } catch {
    deny = [];
  }
  for (const rule of DENY) {
    if (!deny.includes(rule)) ctx.problem('.claude/settings.json', 0, 'secrets-ignored', `permissions.deny lacks ${rule}`, 'Merge the deny rule into .claude/settings.json (the owner approves the edit); never opening the files is the real guard, the rule is defence in depth.');
  }
}

function checkCredentialReads(ctx) {
  for (const base of ['packages', 'apps']) {
    if (!existsSync(join(ctx.root, base))) continue;
    for (const rel of walk(join(ctx.root, base), { include: ['*.ts', '*.tsx', '*.mjs', '*.js'], ignore: [...REPO_SCAN_IGNORES, '*.test.ts'] })) {
      const full = `${base}/${rel}`;
      if (full === `${RELEASE_DIR}/play-credentials.ts`) continue;
      const code = maskComments(readFileSync(join(ctx.root, full), 'utf8'));
      const at = code.search(/play-service-account/);
      if (at >= 0) ctx.problem(full, lineOf(code, at), 'credentials-read', 'names the service-account key file', 'Only play-credentials.ts reads it (loadServiceAccount), into memory; take the account from there.');
    }
  }
}

async function checkOwnerValues(ctx) {
  // Node warns that an app's package.json has no "type" when it loads game.config.ts as ESM: noise here.
  process.removeAllListeners('warning');
  for (const game of ctx.apps) {
    const rel = `apps/${game}/game.config.ts`;
    if (!existsSync(join(ctx.root, rel))) continue;
    let config;
    try {
      config = (await import(pathToFileURL(join(ctx.root, rel)).href)).gameConfig;
    } catch (error) {
      ctx.problem(rel, 0, 'owner-placeholder', `cannot be loaded (${error.message})`, 'game.config.ts imports only the GameConfig type and exports const gameConfig.');
      continue;
    }
    const text = read(ctx.root, rel) ?? '';
    const lineAt = (word) => Math.max(1, lineOf(text, Math.max(0, text.indexOf(word))));
    for (const [field, value] of [['links.privacyPolicy.host', config.links?.privacyPolicy?.host], ['links.supportEmail', config.links?.supportEmail]]) {
      const entry = ownerPlaceholderOf(value);
      if (entry !== null) ctx.report.problem(ownerPlaceholderProblem({ entry, where: field, file: rel, line: lineAt(field.split('.').at(-1)) }));
    }
    if (config.ads?.isEnabled !== true) continue;
    const android = config.ads?.ids?.android ?? null;
    const ids = android === null ? [] : [android.appId, ...Object.values(android.units ?? {})];
    const placeholder = ids.find((id) => ownerPlaceholderOf(id) !== null);
    const sample = ids.find((id) => String(id).startsWith(SAMPLE_PUBLISHER));
    const at = { where: 'ads.ids.android', file: rel, line: lineAt('android:') };
    if (android === null) ctx.report.problem(ownerPlaceholderProblem({ entry: ANDROID_AD_IDS_MISSING, ...at }));
    else if (placeholder !== undefined) ctx.report.problem(ownerPlaceholderProblem({ entry: { ...ANDROID_AD_IDS_MISSING, name: PLACEHOLDERS.find((item) => item.matches(placeholder))?.name ?? 'a placeholder', value: placeholder }, ...at }));
    // A live build with Google's test ids shows test ads and earns nothing: GP5 is still pending.
    else if (sample !== undefined) ctx.report.problem(ownerPlaceholderProblem({ entry: { ...ANDROID_AD_IDS_MISSING, name: "Google's sample (test) AdMob id", value: sample }, ...at }));
  }
}

function listApps(root) {
  if (!existsSync(join(root, 'apps'))) return [];
  return walk(join(root, 'apps'), { include: ['*/package.json'], ignore: REPO_SCAN_IGNORES }).map((rel) => rel.split('/')[0]);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  if (!existsSync(join(root, 'package.json')) && !existsSync(join(root, 'apps'))) fail(`nothing to check: ${root} has no package.json or apps/`, 'Run from the repo root, or pass it as the first argument.');
  const report = createReporter({ name: 'check-release-setup-android', json: options.json });
  const ctx = { root, report, apps: listApps(root), problem: (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix }) };
  checkScriptAndFiles(ctx);
  checkKeystore(ctx);
  checkSecrets(ctx);
  checkCredentialReads(ctx);
  await checkOwnerValues(ctx);
  if (existsSync(join(root, 'shell-slice.json'))) ctx.problem('shell-slice.json', 0, 'shell-slice', 'the repo declares a partial Shell; a slice never ships', 'Build every Shell screen and delete shell-slice.json before a release.');
  return finishWithOwnerSteps(report, { checked: ctx.apps.length + 1, unit: 'apps and the release setup' });
});
