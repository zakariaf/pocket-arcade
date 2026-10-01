#!/usr/bin/env node
// check-premium.mjs: static checks of the Premium in-app purchase in a Pocket Arcade app repo.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-premium.mjs [--root .]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, dueSkipReason, maskComments, parseArgs, REPO_SCAN_IGNORES, requireDir, run, SHELL_DUE_TARGETS, walk } from './check-lib.mjs';
import { callRanges, configFiles, isTestFile, lineAt, packageJsonFiles, parseImports, readRepoJson, readRepoText, runtimeSourceFiles } from './lib/repo-scan.mjs';

const SPEC = {
  name: 'check-premium',
  summary: 'Checks the Premium purchase of a Pocket Arcade app repo: files in place, expo-iap pinned and imported only by its adapter, no server APIs or plugin options, the adapter facts, the store gated on connectivity, product IDs, no typed prices, catalog keys in four languages, S12 test IDs, and the StoreKit harness kept out of app code.',
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: required-file, sdk-pin, sdk-import, sdk-api, banned-api, plugin-entry, plugin-options,',
    '  adapter-facts, store-offline, debug-only, product-id, typed-price, catalog-keys, state-testids, harness-isolation,',
    '  storekit-config, family-sharing (the template, every generated apps/<id>/ios/*.storekit and the ASC',
    '  payloads), price-target (TARGET_EUR and every StoreKit displayPrice are the owner\'s 1.99, and the old spec target',
    '  is gone from the Premium files),',
    '  harness-maestro (the StoreKit harness builds every Maestro call with maestroGlobalArgs: the global --device <udid>',
    '  and its own --driver-host-port, never the per-command --udid).',
    'Facts (version, allowlists, keys, test IDs) come from assets/premium-facts.json; typed-price skips',
    'i18n/, testing/ and typedPriceAllowedIn (the parity harness\'s fixture store, test builds only).',
    'Not yet due (SKIP lines, a pass): plugin-entry until packages/shell/src/config/shell-plugins.ts exists',
    '(Shell step 8), catalog-keys until packages/shell/src/i18n/catalogs/en.json exists (Shell step 6).',
    'The repo scan skips REPO_SCAN_IGNORES (the in-repo skills/ library, .claude/, node_modules, Pods,',
    '.expo and each app\'s generated ios/, android/, build/, out/) and dist/, coverage/, reports/, tools/.',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'premium-facts.json'), 'utf8'));
const SDK = FACTS.sdk.package;
const PRICE = /(?:[€$£]\s?\d)|(?:\d+[.,]\d{2}\s?(?:€|EUR|USD|\$))|(?:\bEUR\s?\d)/;

function checkFilesAndPins(root, report) {
  for (const rel of FACTS.requiredFiles) {
    if (!existsSync(join(root, rel))) report.problem({ file: rel, rule: 'required-file', message: 'missing', fix: `Copy templates/${rel} from the premium-purchase skill.` });
  }
  for (const rel of packageJsonFiles(root)) {
    const json = readRepoJson(root, rel);
    for (const field of ['dependencies', 'devDependencies']) {
      const spec = json?.[field]?.[SDK];
      if (spec !== undefined && spec !== FACTS.sdk.version) report.problem({ file: rel, rule: 'sdk-pin', message: `${field}.${SDK} is "${spec}", not exactly "${FACTS.sdk.version}"`, fix: `Run npm install -E ${SDK}@${FACTS.sdk.version} in every app.` });
    }
    const scripts = JSON.stringify(json?.scripts ?? {});
    if (/EXPO_IAP_ONSIDE/.test(scripts)) report.problem({ file: rel, rule: 'plugin-options', message: 'a script sets EXPO_IAP_ONSIDE', fix: 'Remove it: it adds the OnsideKit pod from the CocoaPods trunk.' });
  }
}

function checkSources(root, files, sources, report) {
  const adapter = FACTS.adapter.file;
  const banned = new RegExp(`\\b(${FACTS.bannedApis.join('|')})\\b`, 'g');
  for (const rel of files) {
    const raw = sources.get(rel);
    const text = maskComments(raw);
    const isTest = isTestFile(rel);
    for (const imp of parseImports(raw)) {
      if (imp.specifier !== SDK && !imp.specifier.startsWith(`${SDK}/`)) continue;
      if (rel !== adapter) {
        report.problem({ file: rel, line: imp.line, rule: 'sdk-import', message: `imports ${imp.specifier} outside the adapter`, fix: 'Use PurchasePort (services context); only expo-iap-purchase-adapter.ts imports expo-iap.' });
        continue;
      }
      for (const name of imp.names) {
        if (!FACTS.adapter.allowedImports.includes(name)) report.problem({ file: rel, line: imp.line, rule: 'sdk-api', message: `imports ${name} from ${SDK}`, fix: 'Keep the adapter to the StoreKit functions the template uses.' });
      }
    }
    if (!isTest) {
      for (const match of text.matchAll(banned)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'banned-api', message: `${match[1]} is used`, fix: 'Remove it: it calls a server (IAPKit), hides finishing logic, or finishes before saving.' });
      for (const match of text.matchAll(/\b(SKTestSession|StoreKitTest)\b/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'harness-isolation', message: `${match[1]} in app code`, fix: 'StoreKit test code lives only in packages/tooling/src/storekit (a hosted XCTest bundle).' });
      if (!rel.includes('/i18n/') && !rel.includes('/testing/') && !FACTS.typedPriceAllowedIn.some((dir) => rel.startsWith(dir))) {
        const lines = text.split('\n');
        lines.forEach((line, index) => {
          const strings = line.match(/(['"`])(?:(?!\1).)*\1/g) ?? [];
          for (const literal of strings) {
            if (PRICE.test(literal)) report.problem({ file: rel, line: index + 1, rule: 'typed-price', message: `price-like text ${literal} in code`, fix: 'Show the store price via formatStorePrice(product, localeTag) and the {priceText} placeholder; never type a price.' });
          }
        });
      }
    }
  }
  if (existsSync(join(root, adapter))) {
    const text = maskComments(readRepoText(root, adapter));
    for (const [needle, why] of Object.entries(FACTS.adapter.mustContain)) {
      if (!text.replace(/\s+/g, ' ').includes(needle)) report.problem({ file: adapter, rule: 'adapter-facts', message: `missing "${needle}"`, fix: `The adapter must ${why}.` });
    }
    if (/onlyIncludeActiveItemsIOS\s*:\s*true/.test(text)) report.problem({ file: adapter, rule: 'adapter-facts', message: 'reads only active entitlements', fix: 'Pass onlyIncludeActiveItemsIOS: false so refunds (revocation dates) stay visible.' });
  }
}

// The store must follow ConnectivityPort (spec S12 offline state; the debug switch offline=1).
function checkStoreGate(files, sources, report) {
  const adapter = FACTS.adapter.file;
  for (const rel of files) {
    if (rel === adapter || isTestFile(rel)) continue;
    const text = maskComments(sources.get(rel));
    const gates = callRanges(text, ['withConnectivity']);
    for (const match of text.matchAll(/\bcreateExpoIapPurchaseAdapter\s*\(/g)) {
      if (gates.some((gate) => match.index > gate.start && match.index < gate.end)) continue;
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'store-offline', message: 'the expo-iap adapter is used without withConnectivity()', fix: 'Build the port as withConnectivity(createExpoIapPurchaseAdapter(), connectivity.isOnline) so offline (and the debug offline switch) shows "store unavailable".' });
    }
  }
}

// Premium without a purchase is a test-build tool (debug switch, debug link premium=0|1).
function checkDebugAction(files, sources, report) {
  const { name, allowedIn } = FACTS.debugAction;
  for (const rel of files) {
    if (isTestFile(rel) || allowedIn.some((allowed) => rel === allowed || (allowed.endsWith('/') && rel.startsWith(allowed)))) continue;
    const text = maskComments(sources.get(rel));
    for (const match of text.matchAll(new RegExp(`['"\`]${name}['"\`]`, 'g'))) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'debug-only', message: `${name} dispatched outside test-only code`, fix: 'Only the debug menu and the debug link (reached through the test-only entry) may set Premium without a purchase.' });
    }
  }
}

function checkConfig(root, report) {
  let hasEntry = false;
  const words = new RegExp(`\\b(${FACTS.bannedConfigWords.join('|')})\\b`, 'g');
  const extra = [];
  for (const dir of ['.', ...(existsSync(join(root, 'apps')) ? readdirSync(join(root, 'apps')).map((name) => `apps/${name}`) : [])]) {
    if (!existsSync(join(root, dir))) continue;
    for (const name of readdirSync(join(root, dir))) if (/^\.env/.test(name) || name === 'eas.json') extra.push(dir === '.' ? name : `${dir}/${name}`);
  }
  for (const rel of [...configFiles(root), ...extra]) {
    const text = rel.endsWith('.ts') ? maskComments(readRepoText(root, rel)) : readRepoText(root, rel);
    if (/['"]expo-iap['"]/.test(text)) hasEntry = true;
    const withOptions = /\[\s*['"]expo-iap['"]\s*,/.exec(text);
    if (withOptions) report.problem({ file: rel, line: lineAt(text, withOptions.index), rule: 'plugin-options', message: 'the expo-iap plugin gets an options object', fix: "Use the bare string 'expo-iap': every option (iapkitApiKey, onside modules, alternativeBilling, local dev) adds a server or an SDK." });
    for (const match of text.matchAll(words)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'plugin-options', message: `${match[1]} in the build config`, fix: 'Remove it: IAPKit and Onside add a server or the OnsideKit pod (spec N2/N3).' });
  }
  // The one plugin list arrives at Shell step 8: until then the entry is not due (a SKIP line).
  const pluginsDue = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (pluginsDue !== null) report.skip({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'plugin-entry', message: pluginsDue });
  else if (!hasEntry) report.problem({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'plugin-entry', message: "no 'expo-iap' plugin entry in the app config", fix: "Keep the bare string 'expo-iap' in shellPlugins (packages/shell/src/config/shell-plugins.ts, the one plugin list; architecture-and-boundaries ships it)." });
}

function checkProductIds(root, report) {
  for (const rel of configFiles(root).filter((path) => path.endsWith('/game.config.ts'))) {
    const text = maskComments(readRepoText(root, rel));
    const bundle = /\bbundleId\s*:\s*['"]([^'"]+)['"]/.exec(text)?.[1];
    const product = /\bproductId\s*:\s*['"]([^'"]+)['"]/.exec(text);
    if (!product) {
      report.problem({ file: rel, rule: 'product-id', message: 'premium.productId is missing', fix: `Set premium: { productId: '<bundleId>${FACTS.productIdSuffix}' }.` });
      continue;
    }
    if (bundle !== undefined && product[1] !== `${bundle}${FACTS.productIdSuffix}`) {
      report.problem({ file: rel, line: lineAt(text, product.index), rule: 'product-id', message: `productId "${product[1]}" is not "${bundle}${FACTS.productIdSuffix}"`, fix: 'One product per game: <bundleId>.premium, never changed or reused.' });
    }
  }
}

function checkCatalogs(root, report) {
  // The Shell catalogs arrive at Shell step 6 (the boot and i18n step): not due before.
  const catalogsDue = dueSkipReason(root, SHELL_DUE_TARGETS.catalogs);
  if (catalogsDue !== null) {
    report.skip({ file: SHELL_DUE_TARGETS.catalogs.file, rule: 'catalog-keys', message: catalogsDue });
    return;
  }
  const dir = join(root, FACTS.catalogDir);
  if (!existsSync(dir)) {
    report.problem({ file: FACTS.catalogDir, rule: 'catalog-keys', message: 'the Shell catalogs are missing', fix: 'Create the four catalogs (i18n work) and add the Premium keys from the copy deck.' });
    return;
  }
  for (const lang of FACTS.languages) {
    const rel = `${FACTS.catalogDir}/${lang}.json`;
    const catalog = readRepoJson(root, rel);
    if (!catalog) {
      report.problem({ file: rel, rule: 'catalog-keys', message: 'missing or not JSON', fix: 'Every language has a catalog with every Premium key.' });
      continue;
    }
    for (const key of FACTS.catalogKeys) {
      if (typeof catalog[key] !== 'string') report.problem({ file: rel, rule: 'catalog-keys', message: `no "${key}"`, fix: 'Take the text from the copy deck for this language; S12 text never comes from App Store Connect.' });
    }
    for (const key of FACTS.priceKeys) {
      if (typeof catalog[key] === 'string' && !catalog[key].includes('{priceText}')) report.problem({ file: rel, rule: 'typed-price', message: `"${key}" has no {priceText} placeholder`, fix: 'Prices come from the store through {priceText}; never type one into a catalog.' });
    }
    for (const [key, value] of Object.entries(catalog)) {
      if (/^(premium|settings\.premium|result\.premium)/.test(key) && typeof value === 'string' && PRICE.test(value)) report.problem({ file: rel, rule: 'typed-price', message: `"${key}" contains a typed price`, fix: 'Use {priceText}.' });
    }
  }
}

function checkScreen(root, report) {
  const dir = join(root, FACTS.premiumScreenDir);
  if (!existsSync(dir)) return;
  const text = walk(dir, { include: ['*.ts', '*.tsx'] }).filter((rel) => !isTestFile(rel)).map((rel) => readFileSync(join(dir, rel), 'utf8')).join('\n');
  for (const id of FACTS.stateTestIds) {
    if (!text.includes(`'${id}'`) && !text.includes(`"${id}"`) && !text.includes(`\`${id}\``)) report.problem({ file: FACTS.premiumScreenDir, rule: 'state-testids', message: `no element with testID "${id}"`, fix: 'Every S12 state has its container test ID (see the S12 table in references/premium-states.md).' });
  }
}

/** Generated or report folders the harness scan also skips (REPO_SCAN_IGNORES covers the rest). */
const HARNESS_SCAN_EXTRA = ['dist/**', 'apps/*/dist/**', 'coverage/**', 'reports/**', 'tools/**'];

function checkHarness(root, report) {
  const { template, allowedDir, flowsDir } = FACTS.storekit;
  const files = walk(root, { ignore: [...REPO_SCAN_IGNORES, ...HARNESS_SCAN_EXTRA] });
  for (const rel of files) {
    if (rel.startsWith(allowedDir)) continue;
    if (/\.(storekit|storekit\.template|xctest)$/.test(rel)) report.problem({ file: rel, rule: 'harness-isolation', message: 'StoreKit test artefact outside packages/tooling/src/storekit', fix: 'Keep the harness files in packages/tooling/src/storekit; they are added only to throwaway harness builds.' });
    if (/\.(entitlements|plist|json|ts|tsx|rb|yaml|yml)$/.test(rel) && !rel.startsWith('packages/tooling/')) {
      const text = readFileSync(join(root, rel), 'utf8');
      if (text.includes('get-task-allow')) report.problem({ file: rel, rule: 'harness-isolation', message: 'mentions get-task-allow', fix: 'get-task-allow is added only to the Debug config of a harness build by add-harness.rb; it must never ship.' });
    }
    if (rel.startsWith('packages/shell/e2e/flows/') && /\.ya?ml$/.test(rel) && /storekit|testArm/i.test(readFileSync(join(root, rel), 'utf8'))) {
      report.problem({ file: rel, rule: 'harness-isolation', message: 'a StoreKit flow inside e2e/flows/', fix: `Move it to ${flowsDir}: the normal E2E run must never run it against an unarmed build.` });
    }
  }
  checkStoreKitConfigs(root, template, report);
  const payloads = 'packages/tooling/src/asc/premium-iap-payloads.ts';
  if (existsSync(join(root, payloads))) {
    const text = maskComments(readRepoText(root, payloads));
    const match = /familySharable\s*:\s*(true|false)/.exec(text);
    if (!match || match[1] !== String(FACTS.familySharable)) report.problem({ file: payloads, rule: 'family-sharing', message: `familySharable is ${match?.[1] ?? 'not set'}, the owner's decision is ${FACTS.familySharable}`, fix: 'Family Sharing cannot be turned off once on: change it only when the owner decides, and record it in assets/premium-facts.json.' });
    if (!/NON_CONSUMABLE/.test(text)) report.problem({ file: payloads, rule: 'storekit-config', message: 'the product is not NON_CONSUMABLE', fix: 'Premium is one non-consumable product.' });
  }
}

/**
 * Every StoreKit configuration: the template (exactly one NonConsumable "__PRODUCT_ID__") and each
 * configuration the harness generated from it (apps/<id>/ios/*.storekit, exactly one NonConsumable
 * "<bundleId>.premium"), each with familyShareable as the owner decided (O3: false).
 */
function storeKitConfigs(root, template) {
  const found = existsSync(join(root, template)) ? [{ rel: template, productId: '__PRODUCT_ID__' }] : [];
  const apps = join(root, 'apps');
  for (const name of existsSync(apps) ? readdirSync(apps).sort() : []) {
    const ios = join(apps, name, 'ios');
    for (const file of existsSync(ios) ? readdirSync(ios).filter((entry) => entry.endsWith('.storekit')).sort() : []) {
      found.push({ rel: `apps/${name}/ios/${file}`, productId: null });
    }
  }
  return found;
}

function checkStoreKitConfigs(root, template, report) {
  for (const { rel, productId } of storeKitConfigs(root, template)) {
    let config = null;
    try {
      config = JSON.parse(readRepoText(root, rel));
    } catch {
      report.problem({ file: rel, rule: 'storekit-config', message: 'not valid JSON', fix: 'Copy the template from this skill; the harness generates the rest from it.' });
      continue;
    }
    const products = config?.products ?? [];
    const product = products[0] ?? {};
    const isPremiumId = productId === null ? typeof product.productID === 'string' && product.productID.endsWith(FACTS.productIdSuffix) : product.productID === productId;
    if (products.length !== 1 || product.type !== 'NonConsumable' || !isPremiumId) {
      report.problem({ file: rel, rule: 'storekit-config', message: `expects exactly one NonConsumable product "${productId ?? `<bundleId>${FACTS.productIdSuffix}`}"`, fix: 'One non-consumable Premium per game; the runner fills in <bundleId>.premium from the template.' });
    }
    if (product.displayPrice !== FACTS.price.targetEur.toFixed(2)) {
      report.problem({ file: rel, rule: 'price-target', message: `displayPrice is ${String(product.displayPrice)}, not the owner's EUR ${FACTS.price.targetEur.toFixed(2)} price point (O2)`, fix: `"displayPrice" : "${FACTS.price.targetEur.toFixed(2)}" in the template; the harness copies it into every generated configuration.` });
    }
    if (product.familyShareable !== FACTS.familySharable) {
      report.problem({ file: rel, rule: 'family-sharing', message: `familyShareable is ${String(product.familyShareable)}, the owner's decision (O3) is ${String(FACTS.familySharable)}`, fix: 'Family Sharing stays off for Premium (owner decision O3, 2026-09-30); fix the template and rerun the harness.' });
    }
  }
}

/**
 * The StoreKit harness shares the Mac with other sessions: every Maestro call names its simulator
 * with the global --device <udid> and its own driver port (maestroGlobalArgs from the repo's
 * packages/tooling/src/e2e/maestro-args.ts), never the per-command --udid, which leaves the XCTest
 * driver port shared with whichever simulator already listens there.
 */
function checkHarnessMaestro(root, report) {
  const rel = 'packages/tooling/src/storekit/storekit-harness.ts';
  if (!existsSync(join(root, rel))) return;
  const text = maskComments(readRepoText(root, rel));
  const fix = 'Build the Maestro arguments with maestroGlobalArgs({ udid, driverPort }) from packages/tooling/src/e2e/maestro-args.ts before the command (copy the harness template again).';
  if (!/\bmaestroGlobalArgs\s*\(/.test(text)) report.problem({ file: rel, line: 1, rule: 'harness-maestro', message: 'runs Maestro without maestroGlobalArgs (the global --device <udid> and its own --driver-host-port)', fix });
  for (const match of text.matchAll(/['"`]--udid['"`]/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'harness-maestro', message: "passes Maestro's per-command --udid, so the run shares the XCTest driver port with other sessions", fix });
}

/** The product spec's old "about EUR 1.9-0" target, in either decimal notation. */
const OLD_TARGET = new RegExp(`\\b1[.,]${'9'}0\\b`, 'g');
const OLD_TARGET_TEXT = `EUR 1.${'9'}0`;

/** The Premium code the price rule reads: the ASC tooling, the StoreKit files, S12's services and state. */
const PRICE_DIRS = ['packages/tooling/src/asc/', 'packages/tooling/src/storekit/', 'packages/shell/src/services/purchase/', 'packages/shell/src/stores/premium/'];

/**
 * Owner decision O2 (2026-09-30): Premium is the EUR 1.99 App Store price point. The ASC script
 * targets exactly 1.99, and no Premium file still carries the product spec's old target (built from
 * parts below, so this checker's own text never carries it).
 */
function checkPriceTarget(root, report) {
  const script = 'packages/tooling/src/asc/create-premium-iap.ts';
  if (existsSync(join(root, script))) {
    const text = maskComments(readRepoText(root, script));
    const target = /\bTARGET_EUR\s*=\s*([0-9.]+)/.exec(text);
    if (target === null || Number(target[1]) !== FACTS.price.targetEur) {
      report.problem({ file: script, line: target === null ? 1 : lineAt(text, target.index), rule: 'price-target', message: `TARGET_EUR is ${target?.[1] ?? 'not set'}, not the owner's EUR ${String(FACTS.price.targetEur)} price point`, fix: `const TARGET_EUR = ${String(FACTS.price.targetEur)}; // owner decision O2, 2026-09-30 (the script stops only if Apple no longer offers it)` });
    }
  }
  const files = walk(root, { include: ['*.ts', '*.tsx', '*.storekit', '*.template', '*.json'], ignore: [...REPO_SCAN_IGNORES] }).filter((rel) => PRICE_DIRS.some((dir) => rel.startsWith(dir)) || rel.endsWith('/game.config.ts'));
  for (const rel of files) {
    const text = readRepoText(root, rel);
    for (const match of text.matchAll(OLD_TARGET)) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'price-target', message: `"${match[0]}": the old ${OLD_TARGET_TEXT} target`, fix: 'Premium is the EUR 1.99 App Store price point (owner decision O2); the app shows the store\'s localised price, never a typed one.' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-premium', json: options.json });
  const files = runtimeSourceFiles(root);
  const sources = new Map(files.map((rel) => [rel, readRepoText(root, rel)]));
  checkFilesAndPins(root, report);
  checkSources(root, files, sources, report);
  checkStoreGate(files, sources, report);
  checkDebugAction(files, sources, report);
  checkConfig(root, report);
  checkProductIds(root, report);
  checkCatalogs(root, report);
  checkScreen(root, report);
  checkHarness(root, report);
  checkPriceTarget(root, report);
  checkHarnessMaestro(root, report);
  return report.finish({ checked: files.length, unit: 'files' });
});
