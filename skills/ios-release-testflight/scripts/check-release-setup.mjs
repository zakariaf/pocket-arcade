#!/usr/bin/env node
// check-release-setup.mjs: checks the app repo's release setup before release:ios is trusted with
// the owner's App Store Connect key: the ExportOptions files, one build number per game, the npm
// script, API-key signing, the key never read or printed outside asc-credentials.ts, no key
// material or signing files in the repo, the .gitignore and Claude Code deny rules for them, and a
// complete Shell: a partial Shell (shell-slice.json, a route on NotBuiltScreen) never ships.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-release-setup.mjs .
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, isBinary, lineOf, maskComments, parseArgs, REPO_SCAN_IGNORES, requireDir, run, walk } from './check-lib.mjs';
import { partialShellProblems } from './lib/shell-complete.mjs';
import { readPlist } from './lib/plist.mjs';

const SPEC = {
  name: 'check-release-setup',
  summary: 'Checks the repo setup that release:ios depends on: ExportOptions plists, game.config.ts version and build number, the npm script, API-key signing, key and token hygiene, .gitignore and the Claude Code deny rules.',
  usage: '[options] [repo-root]',
  options: { json: { type: 'boolean', help: 'Also print the problems as JSON' } },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  export-options      packages/tooling/config/export-options-{test,store}.plist: method app-store-connect, destination export,',
    '                      signingStyle automatic, manageAppVersionAndBuildNumber false, uploadSymbols true,',
    '                      testFlightInternalTestingOnly true (test) / false (store)',
    "  game-config         every apps/<game>/game.config.ts has one `version: 'X.Y.Z'` and exactly one `buildNumber: <int>,` line",
    '  npm-script          root package.json release:ios runs packages/tooling/src/release/release-ios.ts',
    '  release-prereqs     root package.json has the verify, audit:privacy and audit:network scripts release:ios runs',
    '  api-key-signing     the archive uses -allowProvisioningUpdates and the three -authenticationKey* flags; no .p12 or security import',
    '  key-read            only packages/tooling/src/asc/asc-credentials.ts reads AuthKey_*.p8',
    '  token-printed       no console output of a token, JWT, private key or Authorization header',
    '  key-material        no private key text and no .p8/.p12/.mobileprovision/AuthKey_* files inside the repo',
    '  upload-wait         the upload uses --wait and processing is polled until VALID',
    '  wall-clock          packages/tooling/src/clock/system-clock.ts exports nowEpochSeconds (the JWT needs it)',
    '  gitignore-secrets   .gitignore ignores *.p8, AuthKey_*, ApiKey_*, *.p12, *.mobileprovision, *.xcarchive, *.ipa',
    '  claude-deny         .claude/settings.json denies Read of ~/.appstoreconnect/**, **/*.p8, **/AuthKey_*, **/*.p12, **/*.mobileprovision',
    '  no-xcode-select     tooling never runs xcode-select --switch/-s or sudo',
    '  shell-complete      a slice never ships: shell-slice.json exists, or a route in packages/shell/src/navigation/ still',
    '                      points at NotBuiltScreen',
  ].join('\n'),
};

const IGNORE = ['node_modules', 'ios', 'android', 'build', 'dist', '.expo', 'coverage', 'reports', 'tools', '.git'];
const EXPORT_BASE = { method: 'app-store-connect', destination: 'export', signingStyle: 'automatic', manageAppVersionAndBuildNumber: false, uploadSymbols: true };
const PREREQ_SCRIPTS = ['verify', 'audit:privacy', 'audit:network'];
const SECRET_LINES = ['*.p8', 'AuthKey_*', 'ApiKey_*', '*.p12', '*.mobileprovision', '*.xcarchive', '*.ipa'];
const DENY_RULES = ['Read(~/.appstoreconnect/**)', 'Read(**/*.p8)', 'Read(**/AuthKey_*)', 'Read(**/*.p12)', 'Read(**/*.mobileprovision)'];
// Built from parts so this checker's own source never contains the text it hunts for.
const PRIVATE_KEY_TEXT = new RegExp(['-----BEGIN ', '(?:EC |RSA )?', 'PRIVATE KEY-----'].join(''));
const SECRET_FILE = /(^|\/)(AuthKey_[^/]*|ApiKey_[^/]*|[^/]+\.p8|[^/]+\.p12|[^/]+\.mobileprovision)$/;

function read(root, rel) {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

function checkExportOptions(ctx) {
  for (const variant of ['test', 'store']) {
    const rel = `packages/tooling/config/export-options-${variant}.plist`;
    if (!existsSync(join(ctx.root, rel))) {
      ctx.problem(rel, 0, 'export-options', 'file is missing', `Copy templates/packages/tooling/config/export-options-${variant}.plist.`);
      continue;
    }
    const plist = readPlist(join(ctx.root, rel));
    const want = { ...EXPORT_BASE, testFlightInternalTestingOnly: variant === 'test' };
    for (const [key, value] of Object.entries(want)) {
      if (plist[key] !== value) ctx.problem(rel, 0, 'export-options', `${key} is ${JSON.stringify(plist[key] ?? null)}, expected ${JSON.stringify(value)}`, key === 'testFlightInternalTestingOnly' ? 'Test builds are internal-only so they can never reach the App Store; store builds are not.' : 'Use the template values: app-store is deprecated, destination export keeps altool in charge, and manageAppVersionAndBuildNumber defaults to YES (Xcode would rewrite our numbers).');
    }
  }
}

function checkGameConfigs(ctx) {
  const apps = join(ctx.root, 'apps');
  if (!existsSync(apps)) return;
  for (const rel of walk(apps, { include: ['*/game.config.ts'], ignore: IGNORE })) {
    const full = `apps/${rel}`;
    const source = maskComments(readFileSync(join(apps, rel), 'utf8'));
    const builds = [...source.matchAll(/^(\s*buildNumber: )(\d+)(,)$/gm)];
    if (builds.length !== 1) ctx.problem(full, 0, 'game-config', `has ${builds.length} "buildNumber: <int>," lines, expected exactly 1`, 'Keep one `buildNumber: <int>,` line: release:ios bumps it with a line-exact edit.');
    else if (Number(builds[0][2]) < 1) ctx.problem(full, lineOf(source, builds[0].index), 'game-config', 'buildNumber is below 1', 'Build numbers start at 1 and only go up.');
    if (!/^\s*version: '\d+\.\d+\.\d+',$/m.test(source)) ctx.problem(full, 0, 'game-config', "has no `version: 'MAJOR.MINOR.PATCH',` line", 'The version lives only in game.config.ts as SemVer.');
  }
}

function checkScriptsAndSigning(ctx) {
  let scripts = {};
  try {
    scripts = JSON.parse(read(ctx.root, 'package.json') ?? '{}').scripts ?? {};
  } catch {
    scripts = {};
  }
  const script = scripts['release:ios'];
  if (script !== 'node packages/tooling/src/release/release-ios.ts') ctx.problem('package.json', 0, 'npm-script', `scripts["release:ios"] is ${JSON.stringify(script ?? null)}`, 'Set it to exactly "node packages/tooling/src/release/release-ios.ts".');
  for (const name of PREREQ_SCRIPTS) {
    if (typeof scripts[name] !== 'string' || scripts[name].trim() === '') ctx.problem('package.json', 0, 'release-prereqs', `scripts["${name}"] is missing, and release:ios runs it (verify in the preflight, the audits right after the prebuild)`, 'Set up verify with the quality-gates skill and audit:privacy / audit:network with the privacy-and-network-audit skill before the first release; never delete the step from the pipeline.');
  }
  const optionsRel = 'packages/tooling/src/release/release-options.ts';
  const options = read(ctx.root, optionsRel) ?? '';
  const flags = ['-allowProvisioningUpdates', '-authenticationKeyPath', '-authenticationKeyID', '-authenticationKeyIssuerID'];
  const missing = flags.filter((flag) => !options.includes(`'${flag}'`));
  if (missing.length > 0) ctx.problem(optionsRel, 0, 'api-key-signing', `the archive/export arguments lack ${missing.join(', ')}`, 'Sign only with the team API key (automatic signing, cloud-managed distribution certificate); copy the template.');
  if (!options.includes("'--wait'")) ctx.problem(optionsRel, 0, 'upload-wait', 'the altool upload does not pass --wait', 'Pass --wait (it returns once Apple is PROCESSING) and then poll processing until VALID.');
  const processing = read(ctx.root, 'packages/tooling/src/release/processing.ts') ?? '';
  if (!processing.includes('processingState')) ctx.problem('packages/tooling/src/release/processing.ts', 0, 'upload-wait', 'nothing reads the build processingState', 'An upload is done only at VALID; copy processing.ts and poll it (release-upload.ts).');
  const clock = read(ctx.root, 'packages/tooling/src/clock/system-clock.ts') ?? '';
  if (!/export\s+function\s+nowEpochSeconds\b/.test(clock)) ctx.problem('packages/tooling/src/clock/system-clock.ts', 0, 'wall-clock', 'nowEpochSeconds() is not exported', 'Add it next to todayIso(): the JWT is signed with the current time, and only this file reads the clock.');
}

// A read (fs call, cat, copy) whose argument names the key: its path helper, a key-file variable or the file name,
// as an fs call, an exec argument list (`'openssl', ['pkey', '-in', ascKeyPath(id)]`), or a shell command string
// (`cat .../AuthKey_${id}.p8`, `cat ${keyPath}`).
const KEY_NAME = String.raw`(?:ascKeyPath|ascKeyFile|[kK]eyFile|[kK]eyPath|AuthKey_|ApiKey_|\.p8\b)`;
const KEY_READ = new RegExp([
  String.raw`(?:readFileSync|readFile|createReadStream|copyFileSync|cpSync)\(\s*[^)]*?${KEY_NAME}`,
  String.raw`['"](?:cat|cp|mv|base64|openssl|xxd|head|tail|less|pbcopy|security)['"]\s*,\s*\[[^\]]*?${KEY_NAME}`,
  String.raw`\b(?:cat|cp|mv|base64|openssl|xxd|head|tail|less|pbcopy)\s[^\n;|&]*?(?:AuthKey_|ApiKey_|\.p8\b|\$\{\s*(?:ascKeyPath|ascKeyFile|[kK]eyFile|[kK]eyPath))`,
].join('|'));

const TOOLING_BANS = [
  [/\.p12\b|security['"]?\s*,\s*\[?\s*['"]import['"]|security\s+import\b/, 'api-key-signing', 'handles a .p12 or imports a certificate', 'Never export or import signing files; automatic signing with the API key creates what is needed.'],
  [/xcode-select['"]?\s*,?\s*\[?\s*['"]?\s*(?:-s|--switch)\b|xcode-select\s+(?:-s|--switch)\b/, 'no-xcode-select', 'switches the global Xcode with xcode-select', 'Select Xcode per process with DEVELOPER_DIR.'],
  [/['"]sudo['"]|\bsudo\s/, 'no-xcode-select', 'runs sudo', 'Tooling never needs sudo; licence and keychain steps are the owner\'s.'],
  [/console\.(?:log|info|warn|error)\([^;]*\b(token|jwt|privateKeyPem|authorization)\b/i, 'token-printed', 'prints a token, JWT, private key or Authorization header', 'Never log credentials; error messages carry the API error codes only.'],
];

function checkTooling(ctx) {
  const tooling = join(ctx.root, 'packages', 'tooling', 'src');
  if (!existsSync(tooling)) return;
  for (const rel of walk(tooling, { include: ['*.ts', '*.mts', '*.sh'] })) {
    const full = `packages/tooling/src/${rel}`;
    const source = maskComments(readFileSync(join(tooling, rel), 'utf8'));
    for (const [pattern, rule, message, fix] of TOOLING_BANS) {
      const match = pattern.exec(source);
      if (match) ctx.problem(full, lineOf(source, match.index), rule, message, fix);
    }
    const keyRead = KEY_READ.exec(source);
    if (keyRead && full !== 'packages/tooling/src/asc/asc-credentials.ts') ctx.problem(full, lineOf(source, keyRead.index), 'key-read', 'reads the App Store Connect key file', 'Only asc-credentials.ts reads the key, into memory; other code gets ASC_KEY_ID, ASC_ISSUER_ID and APPLE_TEAM_ID, and altool finds the key itself.');
  }
}

/** A release carries the whole Shell: shell-slice.json and routes on NotBuiltScreen are build-time states. */
function checkShellComplete(ctx) {
  for (const found of partialShellProblems(ctx.root)) ctx.problem(found.file, found.line, 'shell-complete', found.message, found.fix);
}

function checkSecrets(ctx) {
  // The shared scan ignores (skills/, .claude/, node_modules, Pods, generated ios/android/build/out):
  // skill fixtures are checked by their own self-tests.
  for (const rel of walk(ctx.root, { ignore: [...REPO_SCAN_IGNORES, 'dist', 'coverage', 'reports', 'tools'] })) {
    if (SECRET_FILE.test(rel)) {
      ctx.problem(rel, 0, 'key-material', 'a key or signing file is inside the repo', 'Move it out (keys live in ~/.appstoreconnect/private_keys, mode 600) and, if it was ever committed, ask the owner to revoke the key.');
      continue;
    }
    const buffer = readFileSync(join(ctx.root, rel));
    if (isBinary(buffer)) continue;
    const text = buffer.toString('utf8');
    const match = PRIVATE_KEY_TEXT.exec(text);
    if (match) ctx.problem(rel, lineOf(text, match.index), 'key-material', 'contains private key text', 'Delete it from the file (and from history if committed) and ask the owner to revoke and replace the key.');
  }
  const lines = new Set((read(ctx.root, '.gitignore') ?? '').split('\n').map((line) => line.trim()));
  for (const entry of SECRET_LINES) {
    if (!lines.has(entry)) ctx.problem('.gitignore', 0, 'gitignore-secrets', `does not ignore ${entry}`, `Add the line ${entry}.`);
  }
  let deny = [];
  try {
    deny = JSON.parse(read(ctx.root, '.claude/settings.json') ?? '{}').permissions?.deny ?? [];
  } catch {
    deny = [];
  }
  for (const rule of DENY_RULES) {
    if (!deny.includes(rule)) ctx.problem('.claude/settings.json', 0, 'claude-deny', `permissions.deny lacks ${rule}`, 'Merge the deny rule into .claude/settings.json (the owner approves the edit); it is defence in depth, the rule never to open the key is the real guard.');
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const report = createReporter({ name: 'check-release-setup', json: options.json });
  if (!existsSync(join(root, 'package.json')) && !existsSync(join(root, 'packages'))) return report.finish({ checked: 0, unit: 'repo files' });
  const ctx = { root, problem: (file, line, rule, message, fix) => report.problem({ file, line, rule, message, fix }) };
  checkExportOptions(ctx);
  checkGameConfigs(ctx);
  checkScriptsAndSigning(ctx);
  checkTooling(ctx);
  checkSecrets(ctx);
  checkShellComplete(ctx);
  return report.finish({ checked: 1, unit: 'repo' });
});
