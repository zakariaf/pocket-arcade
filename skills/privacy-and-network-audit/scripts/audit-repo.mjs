#!/usr/bin/env node
// audit-repo.mjs: the static half of the spec N3 audit on a Pocket Arcade app repo:
// layer A (our code), layer D (vendor pods, when a Podfile.lock exists), layer E (build config),
// banned packages, the privacy-manifest config, the audit tooling wiring and secrets hygiene.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/audit-repo.mjs .

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, dueSkipReason, maskComments, parseArgs, readText, REPO_SCAN_IGNORES, requireDir, run, SHELL_DUE_TARGETS, walk } from './check-lib.mjs';
import { configFiles, isTestFile, lineAt, packageJsonFiles, parseImports, readRepoJson, readRepoText, runtimeSourceFiles } from './lib/repo-scan.mjs';

const SPEC = {
  name: 'audit-repo',
  summary: 'Audits a Pocket Arcade app repo for spec N3 ("our own code makes no network requests"): network calls and remote URLs in our code, banned and vendor imports, banned packages, build-config switches, vendor pods, the privacy-manifest config, the audit tooling wiring and secrets hygiene.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: network-call, network-global, remote-url, banned-import, vendor-import, iap-server-api, network-guard-import,',
    '  banned-package, config-updates, config-ats, att-config, config-iap-options, vendor-pod, banned-pod,',
    '  privacy-manifest, audit-wiring, baseline, gitignore-secrets, secret-file, private-key, deny-rules.',
    'att-config (owner decision O1, App Tracking Transparency): with ads enabled in a game.config.ts, shell-plugins.ts',
    '  lists expo-tracking-transparency with userTrackingPermission, with-shell.ts writes the localized',
    '  NSUserTrackingUsageDescription, and the en, de, fa and ckb catalogs hold consent.tracking.usage-description;',
    '  no other config file sets the text, and the AdMob plugin never gets userTrackingUsageDescription (one',
    '  source). Before Shell step 8 created shell-plugins.ts the plugin part is a not-yet-due SKIP.',
    'banned-import also covers expo-tracking-transparency outside packages/shell/src/services/consent/admob-consent-adapter.ts.',
    'Facts (allowlists, banned lists, required reasons) come from assets/privacy-facts.json.',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'privacy-facts.json'), 'utf8'));
const ADAPTER = new RegExp(FACTS.adapterGlob);
// Also the forms lint's no-restricted-globals cannot see: globalThis['fetch'](...), new globalThis.WebSocket(...).
const NETWORK_CALLS = [
  [/\bfetch\s*\(|\[\s*(['"`])fetch\1\s*\]\s*\(/g, 'fetch()'],
  [/\bnew\s+(?:[\w$]+\s*\.\s*)*XMLHttpRequest\b/g, 'new XMLHttpRequest'],
  [/\bnew\s+(?:[\w$]+\s*\.\s*)*WebSocket\s*\(/g, 'new WebSocket()'],
  [/\bnew\s+(?:[\w$]+\s*\.\s*)*EventSource\s*\(/g, 'new EventSource()'],
  [/\bsendBeacon\s*\(|\[\s*(['"`])sendBeacon\1\s*\]\s*\(/g, 'sendBeacon()'],
];
const REMOTE_URL = /(['"`])((?:https?|wss?|ftp):\/\/(?!localhost\b|127\.0\.0\.1\b)[^'"`\s]*)/gi;
// References that alias a network global without calling it (lint's no-restricted-globals, repeated
// here): const Socket = WebSocket; const send = globalThis.fetch. Calls are reported by NETWORK_CALLS.
const NETWORK_GLOBALS = [
  /(?<!new\s+)(?<![\w$.'"`])(XMLHttpRequest|WebSocket|EventSource)\b(?!\s*:)/g,
  /(?<!new\s+)\b(?:globalThis|window|global|self|navigator)\s*(?:\.\s*(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|\[\s*(['"`])(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\2\s*\])(?!\s*\()/g,
];

function bannedImportReason(specifier, rel) {
  const bare = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (FACTS.bannedImports[bare]) return FACTS.bannedImports[bare];
  const restricted = FACTS.restrictedImports[bare];
  if (restricted) return restricted.onlyIn.includes(rel) ? null : restricted.reason;
  const prefix = Object.keys(FACTS.bannedImportPrefixes).find((p) => specifier.startsWith(p));
  return prefix ? FACTS.bannedImportPrefixes[prefix] : null;
}

function layerA(files, sources, report) {
  const guard = FACTS.networkGuard;
  for (const rel of files) {
    const raw = sources.get(rel);
    const text = maskComments(raw);
    const isTest = isTestFile(rel);
    if (!isTest) {
      for (const [pattern, label] of NETWORK_CALLS) {
        for (const match of text.matchAll(pattern)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'network-call', message: `${label} in our code`, fix: 'Our code never opens a connection (spec N3); only the AdMob and StoreKit SDKs may, behind their adapters.' });
      }
      for (const pattern of NETWORK_GLOBALS) {
        for (const match of text.matchAll(pattern)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'network-global', message: `${match[1] ?? match[3] ?? match[4]} referenced in our code`, fix: 'Do not alias or pass around fetch, XMLHttpRequest, WebSocket, EventSource or sendBeacon: our code never opens a connection (spec N3).' });
      }
      if (rel !== FACTS.externalLinksFile) {
        for (const match of text.matchAll(REMOTE_URL)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'remote-url', message: `remote URL ${match[2]}`, fix: `Remote images, fonts and downloads make requests too; OS hand-off links (store page, privacy policy, mailto) live only in ${FACTS.externalLinksFile}.` });
      }
      for (const match of text.matchAll(new RegExp(`\\b(${FACTS.iapServerApis.join('|')})\\b`, 'g'))) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'iap-server-api', message: `${match[1]} (expo-iap server feature)`, fix: 'IAPKit and server verification are banned; StoreKit 2 verifies on the phone.' });
    }
    for (const imp of parseImports(raw)) {
      const reason = bannedImportReason(imp.specifier, rel);
      if (reason) report.problem({ file: rel, line: imp.line, rule: 'banned-import', message: `imports ${imp.specifier}`, fix: reason });
      const vendor = FACTS.vendorSdks.find((sdk) => imp.specifier === sdk || imp.specifier.startsWith(`${sdk}/`));
      if (vendor && !ADAPTER.test(rel) && !isTest) report.problem({ file: rel, line: imp.line, rule: 'vendor-import', message: `imports the vendor SDK ${vendor} outside an adapter`, fix: 'Vendor SDKs are imported only by packages/shell/src/services/<port>/<vendor>-adapter.ts.' });
      const guardBase = guard.file.split('/').pop().replace(/\.ts$/, '');
      if ((imp.specifier.endsWith(`/${guardBase}.ts`) || imp.specifier.endsWith(`/${guardBase}`) || imp.specifier === `./${guardBase}.ts`) && !imp.isType && !isTest && !guard.allowedImporters.some((allowed) => rel === allowed || (allowed.endsWith('/') && rel.startsWith(allowed)))) {
        report.problem({ file: rel, line: imp.line, rule: 'network-guard-import', message: 'imports the test-only network guard outside test-only code', fix: 'Install it only from the test-only entry, so store builds never contain it.' });
      }
    }
  }
}

function bannedPackages(root, report) {
  const rules = FACTS.bannedPackages.map((rule) => ({ ...rule, re: new RegExp(rule.pattern) }));
  for (const rel of packageJsonFiles(root)) {
    const json = readRepoJson(root, rel);
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(json?.[field] ?? {})) {
        const rule = rules.find((r) => r.re.test(name));
        if (rule) report.problem({ file: rel, rule: 'banned-package', message: `${field} has ${name}`, fix: rule.reason });
      }
    }
  }
  const lock = readRepoJson(root, 'package-lock.json');
  if (lock?.packages) {
    const seen = new Set();
    for (const path of Object.keys(lock.packages)) {
      const at = path.lastIndexOf('node_modules/');
      if (at === -1) continue;
      const name = path.slice(at + 'node_modules/'.length);
      const rule = rules.find((r) => r.scope === 'anywhere' && r.re.test(name));
      if (rule && !seen.has(name)) {
        seen.add(name);
        report.problem({ file: 'package-lock.json', rule: 'banned-package', message: `${name} is installed (${path})`, fix: `${rule.reason} Find who pulls it in with npm explain ${name}.` });
      }
    }
  }
}

function layerE(root, report) {
  const files = configFiles(root);
  let hasUpdatesOff = false;
  for (const rel of files) {
    const raw = readRepoText(root, rel);
    const text = rel.endsWith('.json') ? raw : maskComments(raw);
    if (/\bupdates\b['"]?\s*:\s*\{\s*['"]?enabled['"]?\s*:\s*false\b/.test(text)) hasUpdatesOff = true;
    for (const match of text.matchAll(/NSAllowsArbitraryLoads['"]?\s*:\s*true/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'config-ats', message: 'NSAllowsArbitraryLoads is true', fix: 'Remove the App Transport Security exception; the app loads nothing remote.' });
    // Tests may name the keys to prove where they are (or are not); only config code sets them.
    const isConfigCode = !isTestFile(rel);
    for (const match of isConfigCode ? text.matchAll(/\buserTrackingUsageDescription\b/g) : []) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'att-config', message: "the AdMob plugin's userTrackingUsageDescription is set", fix: `The tracking text has one source (owner decision O1): the ${FACTS.att.plugin} plugin's ${FACTS.att.pluginOption} in ${FACTS.att.pluginsFile} and withShell's locales, from the Shell catalogs (${FACTS.att.catalogKey}); remove the AdMob option.` });
    if (isConfigCode && rel !== FACTS.att.pluginsFile && rel !== FACTS.att.withShellFile) {
      for (const match of text.matchAll(/\b(NSUserTrackingUsageDescription|userTrackingPermission)\b/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'att-config', message: `${match[1]} is set outside ${FACTS.att.pluginsFile} and ${FACTS.att.withShellFile}`, fix: `Set the tracking text only there, from the Shell catalogs' ${FACTS.att.catalogKey} (so every language and every game get the same reviewed text).` });
    }
    for (const match of text.matchAll(/\[\s*['"]expo-iap['"]\s*,|\b(iapkitApiKey|alternativeBilling|onside|EXPO_IAP_ONSIDE)\b/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'config-iap-options', message: `expo-iap option or switch (${match[0].trim()})`, fix: "Use the bare plugin string 'expo-iap'; IAPKit and Onside add a server or the OnsideKit pod." });
    for (const match of text.matchAll(/['"](expo-updates|expo-dev-client)['"]/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'config-updates', message: `${match[1]} in the build config`, fix: 'OTA updates and dev clients are network components; remove them.' });
  }
  if (!hasUpdatesOff) report.problem({ file: 'packages/shell/src/config/with-shell.ts', rule: 'config-updates', message: 'no updates: { enabled: false } in the app config', fix: 'withShell must set updates: { enabled: false } (no OTA updates).' });
}

/** Whether any game enables ads (game.config.ts ads: { isEnabled: true }). */
function adsEnabledGames(root) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return [];
  return readdirSync(apps).sort().filter((name) => {
    const rel = `apps/${name}/game.config.ts`;
    return existsSync(join(root, rel)) && /\bisEnabled\s*:\s*true\b/.test(maskComments(readRepoText(root, rel)));
  });
}

/** Owner decision O1: with ads on, the ATT plugin, the localized text and the catalog strings exist. */
function attConfig(root, report) {
  const games = adsEnabledGames(root);
  if (games.length === 0) return;
  const { att } = FACTS;
  const problem = (file, message, fix) => report.problem({ file, rule: 'att-config', message, fix });
  const notYet = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (notYet !== null) report.skip({ file: att.pluginsFile, rule: 'att-config', message: notYet });
  else {
    const plugins = maskComments(readRepoText(root, att.pluginsFile));
    if (!new RegExp(`\\[\\s*['"]${att.plugin}['"]\\s*,\\s*\\{[^}]*\\b${att.pluginOption}\\s*:`).test(plugins)) problem(att.pluginsFile, `${games.join(', ')} enable ads, but the ${att.plugin} plugin with ${att.pluginOption} is not listed`, `Add ['${att.plugin}', { ${att.pluginOption}: <the en catalog's ${att.catalogKey}> }] to shellPlugins (Apple's prompt crashes the app without ${att.infoPlistKey}).`);
    const withShell = existsSync(join(root, att.withShellFile)) ? maskComments(readRepoText(root, att.withShellFile)) : '';
    if (!new RegExp(`\\b${att.infoPlistKey}\\b`).test(withShell)) problem(att.withShellFile, `withShell does not write locales.<lang>.ios.${att.infoPlistKey}`, `Write it for ${att.languages.join(', ')} from the Shell catalogs next to CFBundleDisplayName (Expo writes each InfoPlist.strings at prebuild).`);
  }
  for (const lang of att.languages) {
    const rel = `${att.catalogDir}/${lang}.json`;
    if (!existsSync(join(root, rel))) continue; // catalog-key rules belong to the i18n checks (Shell step 6)
    const catalog = readRepoJson(root, rel) ?? {};
    const text = catalog[att.catalogKey];
    if (typeof text !== 'string' || text.trim() === '') problem(rel, `has no ${att.catalogKey} (the ${lang} tracking prompt text)`, `Add the copy deck's ${att.catalogKey} text for ${lang} (the owner reviews fa and ckb; it never blocks the build).`);
  }
}

function layerD(root, report) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return;
  const allow = new Set(FACTS.vendorPodAllowlist);
  const families = FACTS.bannedPodFamilies.map((family) => ({ ...family, re: new RegExp(family.pattern) }));
  for (const name of readdirSync(apps).sort()) {
    const rel = `apps/${name}/ios/Podfile.lock`;
    if (!existsSync(join(root, rel))) continue;
    const lock = readRepoText(root, rel);
    const section = lock.split('\nSPEC REPOS:\n')[1]?.split('\n\n')[0] ?? '';
    const pods = section.split('\n').map((line) => /^ {4}- "?([^"\s]+)"?$/.exec(line)?.[1]).filter(Boolean);
    for (const pod of pods) {
      if (allow.has(pod)) continue;
      const family = families.find((f) => f.re.test(pod));
      report.problem({ file: rel, line: lineAt(lock, lock.indexOf(`- ${pod}`)), rule: family ? 'banned-pod' : 'vendor-pod', message: `trunk pod ${pod}${family ? ` (${family.family})` : ''} is not on the N3 allowlist`, fix: `Only ${FACTS.vendorPodAllowlist.join(', ')} may come from the CocoaPods trunk; find the npm package or plugin option that added it.` });
    }
  }
}

function privacyManifest(root, report) {
  const rel = FACTS.privacyManifestFile;
  if (!existsSync(join(root, rel))) return;
  const text = maskComments(readRepoText(root, rel));
  if (!/NSPrivacyTracking\s*:\s*false/.test(text)) report.problem({ file: rel, rule: 'privacy-manifest', message: 'NSPrivacyTracking is not false', fix: 'Our app tracks nothing; keep NSPrivacyTracking: false (only the Google pods declare tracking).' });
  for (const [category, reasons] of Object.entries(FACTS.requiredReasons)) {
    const at = text.indexOf(`'${category}'`) === -1 ? text.indexOf(`"${category}"`) : text.indexOf(`'${category}'`);
    const block = at === -1 ? '' : text.slice(at, text.indexOf(']', at) + 1);
    for (const reason of reasons) {
      if (!block.includes(reason)) report.problem({ file: rel, rule: 'privacy-manifest', message: `${category} ${reason} is not declared`, fix: 'Declare every reason the pods declare (run audit-privacy-manifest.mjs after a prebuild for the full list).' });
    }
  }
  const uses = configFiles(root).some((path) => /privacyManifests\s*:\s*PRIVACY_MANIFESTS/.test(readRepoText(root, path)));
  if (!uses) report.problem({ file: 'packages/shell/src/config/with-shell.ts', rule: 'privacy-manifest', message: 'ios.privacyManifests is not set from PRIVACY_MANIFESTS', fix: 'Set ios.privacyManifests: PRIVACY_MANIFESTS in withShell; never edit ios/ by hand.' });
}

function auditWiring(root, report) {
  for (const rel of FACTS.requiredFiles) {
    if (!existsSync(join(root, rel))) report.problem({ file: rel, rule: 'audit-wiring', message: 'missing', fix: 'Copy it from this skill (templates/ or templates/tooling-deps/).' });
  }
  const scripts = readRepoJson(root, 'package.json')?.scripts ?? {};
  for (const [name, command] of Object.entries(FACTS.npmScripts)) {
    if (scripts[name] !== command) report.problem({ file: 'package.json', rule: 'audit-wiring', message: `scripts["${name}"] is ${scripts[name] === undefined ? 'missing' : `"${scripts[name]}"`}`, fix: `Set it to "${command}".` });
  }
  for (const name of ['js-baseline.json', 'native-baseline.json']) {
    const rel = `packages/tooling/network-audit/${name}`;
    if (!existsSync(join(root, rel))) continue;
    const baseline = readRepoJson(root, rel);
    if (!baseline || typeof baseline !== 'object') {
      report.problem({ file: rel, rule: 'baseline', message: 'not valid JSON', fix: 'Restore it from the template.' });
      continue;
    }
    for (const [owner, entry] of Object.entries(baseline)) {
      if (!Array.isArray(entry?.categories) || entry.categories.length === 0 || typeof entry?.reason !== 'string' || entry.reason.trim().length < 10) {
        report.problem({ file: rel, rule: 'baseline', message: `entry "${owner}" has no categories or no real reason`, fix: 'Every baseline entry names its categories and why the capability is unused; baseline changes need the owner and a Gate-Change trailer.' });
      }
      if (!owner.includes('/') && !owner.startsWith('@') && /^\.|\//.test(owner)) report.problem({ file: rel, rule: 'baseline', message: `entry "${owner}" is a path`, fix: 'First-party code is never baselined.' });
    }
  }
  const pods = 'packages/tooling/src/audit/network-pods-layer.ts';
  if (existsSync(join(root, pods))) {
    const text = maskComments(readRepoText(root, pods));
    const list = /VENDOR_POD_ALLOWLIST[^=]*=\s*new Set\(\[([^\]]*)\]/s.exec(text)?.[1] ?? '';
    const names = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]).sort();
    if (names.join(',') !== [...FACTS.vendorPodAllowlist].sort().join(',')) report.problem({ file: pods, rule: 'audit-wiring', message: `VENDOR_POD_ALLOWLIST is [${names.join(', ')}]`, fix: `It is exactly ${FACTS.vendorPodAllowlist.join(', ')}; a change needs the owner's approval.` });
  }
}

// The shared repo-scan ignores, except the skill library and .claude/: a key file is allowed nowhere
// in the repo, and no skill fixture holds one (planted keys are written at run time and removed).
const SECRET_SCAN_IGNORES = REPO_SCAN_IGNORES.filter((glob) => glob !== 'skills/**' && glob !== '.claude/**');

function secrets(root, report) {
  const gitignore = existsSync(join(root, '.gitignore')) ? readRepoText(root, '.gitignore').split('\n').map((line) => line.trim()) : null;
  if (gitignore === null) report.problem({ file: '.gitignore', rule: 'gitignore-secrets', message: 'missing', fix: `Create it with ${FACTS.gitignorePatterns.join(', ')}.` });
  else for (const pattern of FACTS.gitignorePatterns) if (!gitignore.includes(pattern)) report.problem({ file: '.gitignore', rule: 'gitignore-secrets', message: `does not ignore ${pattern}`, fix: `Add the line ${pattern}.` });
  const secretFile = new RegExp(FACTS.secretFilePattern);
  // PEM armour only ("-----BEGIN [EC |RSA |ENCRYPTED ]PRIVATE KEY-----"), so prose that names the
  // marker (a release checklist's git grep, this skill's own docs under skills/) is not key material.
  const marker = new RegExp(['-----BEGIN ', '(?:[A-Z]+ )*', 'PRIVATE KEY-----'].join(''));
  for (const rel of walk(root, { ignore: [...SECRET_SCAN_IGNORES, 'dist', 'dist-audit', 'coverage', 'reports'] })) {
    if (secretFile.test(rel)) {
      report.problem({ file: rel, rule: 'secret-file', message: 'a key or signing file inside the repo', fix: 'Move it out (keys live in ~/.appstoreconnect/private_keys, mode 600); if it was ever committed, revoke the key.' });
      continue;
    }
    const text = readText(join(root, rel));
    const found = text === null || text === undefined ? null : marker.exec(text);
    if (found !== null) report.problem({ file: rel, line: lineAt(text, found.index), rule: 'private-key', message: 'contains private key material', fix: 'Remove it and revoke the key in App Store Connect (Users and Access -> Integrations).' });
  }
  const settings = readRepoJson(root, '.claude/settings.json');
  const deny = settings?.permissions?.deny ?? [];
  for (const rule of FACTS.denyRules) if (!deny.includes(rule)) report.problem({ file: '.claude/settings.json', rule: 'deny-rules', message: `permissions.deny lacks ${rule}`, fix: 'Add it so Claude Code never reads key or signing files.' });
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root (holds packages/shell)');
  requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'audit-repo', json: options.json });
  const files = runtimeSourceFiles(root);
  const sources = new Map(files.map((rel) => [rel, readRepoText(root, rel)]));
  layerA(files, sources, report);
  bannedPackages(root, report);
  layerE(root, report);
  attConfig(root, report);
  layerD(root, report);
  privacyManifest(root, report);
  auditWiring(root, report);
  secrets(root, report);
  return report.finish({ checked: files.length, unit: 'source files' });
});
