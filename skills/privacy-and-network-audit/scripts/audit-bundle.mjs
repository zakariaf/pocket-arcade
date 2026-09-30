#!/usr/bin/env node
// audit-bundle.mjs: layer B of the spec N3 audit plus the JS half of the release audit, on the
// output of `npx expo export --platform ios --no-bytecode --source-maps true`. The source map
// names the owner of every shipped module, so findings are attributed per npm package.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/audit-bundle.mjs --export dist-audit/<game-id> [--variant store] .

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'audit-bundle',
  summary: 'Audits a shipped JS bundle (expo export output with its source map): first-party network code fails at once, third-party network capabilities must be in the reasoned baseline, and a store bundle must carry no test-only code, no StoreKit test code, no debug screens and no Google sample ad IDs outside the AdMob library.',
  usage: '--export <dir> [--baseline <json>] [--variant store|test] [--json] [repo-root]',
  options: {
    export: { type: 'string', value: 'dir', help: 'Output folder of npx expo export (holds _expo/static/js/ios/*.js.map)' },
    baseline: { type: 'string', value: 'file', help: 'JS baseline (default: <repo-root>/packages/tooling/network-audit/js-baseline.json)' },
    variant: { type: 'string', default: 'store', value: 'store|test', help: 'Which build the export is; store adds the release checks' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'repo-root (default .): the app repo, for the default baseline path.',
    'Rules: first-party-network, baseline-new, baseline-reason, sample-id, test-only-code, storekit-test-code, debug-screen.',
    'The remote URLs of packages/shell/src/config/external-links.ts (the file the lint URL rule exempts) are not first-party-network; any other finding in it is.',
    'STALE baseline entries (in the baseline, not found) are printed as notes and do not fail.',
    'Make the export with: APP_VARIANT=store EXPO_PUBLIC_APP_VARIANT=store ADS_MODE=off npx expo export --platform ios --no-bytecode --source-maps true --output-dir dist-audit/<game-id>',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'privacy-facts.json'), 'utf8'));
const PATTERNS = Object.entries(FACTS.jsPatterns).map(([category, source]) => [category, new RegExp(source)]);

/** Exactly packages/shell/src/config/external-links.ts, wherever the source map roots its paths. */
function isExternalLinks(source) {
  return source === FACTS.externalLinksFile || source.endsWith(`/${FACTS.externalLinksFile}`);
}

function packageOf(source) {
  return /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(source)?.[1] ?? null;
}

function readModules(exportDir) {
  const dir = join(exportDir, '_expo', 'static', 'js', 'ios');
  if (!existsSync(dir)) fail(`no iOS bundle in ${dir}`, 'Export with: npx expo export --platform ios --no-bytecode --source-maps true --output-dir <dir>.');
  const mapFile = readdirSync(dir).find((file) => file.endsWith('.js.map'));
  if (!mapFile) fail(`no source map in ${dir}`, 'Export with --source-maps true.');
  let map;
  try {
    map = JSON.parse(readFileSync(join(dir, mapFile), 'utf8'));
  } catch (error) {
    fail(`${mapFile} is not JSON (${error.message})`, 'Re-export the bundle.');
  }
  if (!Array.isArray(map.sources) || !Array.isArray(map.sourcesContent)) fail(`${mapFile} has no sourcesContent`, 'Export with --source-maps true (the map must embed the sources).');
  return { mapFile: `_expo/static/js/ios/${mapFile}`, modules: map.sources.map((source, i) => ({ source, content: map.sourcesContent[i] ?? '' })) };
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = positionals[0] ?? '.';
  if (!options.export) fail('--export is required', 'Pass the expo export output folder, for example --export dist-audit/line-siege.');
  if (!['store', 'test'].includes(options.variant)) fail(`--variant ${options.variant} is not store or test`, 'Use --variant store (default) or --variant test.');
  const exportDir = requireDir(options.export, 'export folder');
  const baselinePath = requireFile(options.baseline ?? resolve(root, 'packages', 'tooling', 'network-audit', 'js-baseline.json'), 'JS baseline');
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch (error) {
    fail(`the baseline is not JSON (${error.message})`, 'Restore it from the template.');
  }
  const { mapFile, modules } = readModules(exportDir);
  const report = createReporter({ name: 'audit-bundle', json: options.json });
  const findings = new Map();
  for (const { source, content } of modules) {
    const owner = packageOf(source);
    for (const [category, pattern] of PATTERNS) {
      if (!pattern.test(content)) continue;
      // The one file ESLint lets hold OS hand-off links; its URLs are fine, any other finding is not.
      if (owner === null && category === 'remoteUrl' && isExternalLinks(source)) continue;
      if (owner === null) report.problem({ file: source, rule: 'first-party-network', message: `shipped first-party module can open a connection (${category})`, fix: 'Our code never makes a network request (spec N3); remove it. First-party findings are never baselined.' });
      else findings.set(owner, new Set([...(findings.get(owner) ?? []), category]));
    }
  }
  for (const [owner, entry] of Object.entries(baseline)) {
    if (!Array.isArray(entry?.categories) || typeof entry?.reason !== 'string' || entry.reason.trim().length < 10) report.problem({ file: baselinePath, rule: 'baseline-reason', message: `baseline entry "${owner}" has no categories or no real reason`, fix: 'Every entry says which capability is present and why our code cannot reach it.' });
  }
  for (const [owner, categories] of findings) {
    const allowed = new Set(baseline[owner]?.categories ?? []);
    const extra = [...categories].filter((category) => !allowed.has(category));
    if (extra.length > 0) report.problem({ file: mapFile, rule: 'baseline-new', message: `NEW ${owner}: ${extra.join(', ')} (not in the baseline)`, fix: 'Find out why the package can open a connection. If it is unused and unreachable from our code, add a baseline entry with a reason, a Gate-Change trailer and the owner\'s approval; otherwise remove the package.' });
  }
  for (const owner of Object.keys(baseline)) if (!findings.has(owner)) report.note(`NOTE STALE ${owner}: in the baseline but not found (remove the entry when the package has left)`);
  if (options.variant === 'store') {
    const rel = FACTS.release;
    const sentinel = new RegExp(rel.sentinel);
    const storekit = new RegExp(rel.storekitTest);
    for (const { source, content } of modules) {
      if (content.includes(rel.samplePublisher) && packageOf(source) !== rel.sampleAllowedPackage) report.problem({ file: source, rule: 'sample-id', message: "Google's sample ad publisher ID outside the AdMob library", fix: 'Test IDs come only from TestIds inside the library; ads-config.ts keeps the sample app ID out of the JS bundle.' });
      if (sentinel.test(content)) report.problem({ file: source, rule: 'test-only-code', message: `test-only module shipped (${rel.sentinel})`, fix: 'Test-only code is reachable only through the literal EXPO_PUBLIC_APP_VARIANT gate in test-only.ts; export with the store variables and a fresh Metro cache.' });
      if (storekit.test(content)) report.problem({ file: source, rule: 'storekit-test-code', message: 'StoreKit test code shipped', fix: 'StoreKit testing lives only in the hosted XCTest harness, never in JS.' });
      if (source.includes(rel.debugScreens)) report.problem({ file: source, rule: 'debug-screen', message: 'a debug screen is in the store bundle', fix: 'Debug screens load only through the test-only entry.' });
    }
  }
  return report.finish({ checked: modules.length, unit: 'shipped modules' });
});
