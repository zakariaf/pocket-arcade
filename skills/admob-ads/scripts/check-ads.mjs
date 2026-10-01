#!/usr/bin/env node
// check-ads.mjs: static checks of the AdMob integration in a Pocket Arcade app repo.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-ads.mjs [repo-root]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHELL_DUE_TARGETS, createReporter, dueSkipReason, maskComments, parseArgs, readShellSlice, requireDir, run, sliceSkipReason } from './check-lib.mjs';
import { callRanges, configFiles, isTestFile, lineAt, packageJsonFiles, parseImports, readRepoJson, readRepoText, runtimeSourceFiles } from './lib/repo-scan.mjs';

const SPEC = {
  name: 'check-ads',
  summary: 'Checks the AdMob integration of a Pocket Arcade app repo: files in place, the SDK pinned and imported only by its adapters, no banned SDK APIs, consent and test-only tools kept apart, IDs, the ATT prompt (only in the consent adapter, after the Google form, before initialize, with its plugin and four localised texts), SKAdNetwork list, policy numbers, banner placement and interstitial triggers.',
  usage: '[repo-root] [--json]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: required-file, sdk-pin, sdk-import, sdk-api, deprecated-banner-size, error-code-branch,',
    '  reward-on-earned, content-rating, test-only-api, debug-adapter-import, debug-geography-test-only, consent-factory,',
    '  rewarded-status, sample-id, hard-coded-id,',
    '  att-adapter-only, att-order, att-plugin, plugin-entry, extra-ad-units, skadnetwork, game-config-ids,',
    '  policy-numbers, banner-placement, ad-in-effect, pure-policy, root-mock, level-end-recorded, consent-moment,',
    '  free-hints-config.',
    'Facts (versions, allowlists, minimums) come from assets/admob-facts.json.',
    '',
    'Rules whose target a later Shell build step creates print SKIP lines until it exists (they count as a',
    'pass): plugin-entry and att-plugin until packages/shell/src/config/shell-plugins.ts (step 8); level-end-recorded until',
    'packages/shell/src/app/create-shell-parts.ts and consent-moment until packages/shell/src/app/shell-features.tsx',
    '(step 7). With shell-slice.json "screens": [] (no Shell app) those two skip as well.',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'admob-facts.json'), 'utf8'));
const SDK = FACTS.sdk.package;
const APP_ID = new RegExp(FACTS.idPatterns.appId);
const UNIT_ID = new RegExp(FACTS.idPatterns.unitId);

function checkRequiredFiles(root, report) {
  for (const rel of FACTS.requiredFiles) {
    if (!existsSync(join(root, rel))) report.problem({ file: rel, rule: 'required-file', message: 'missing', fix: `Copy templates/${rel} from the admob-ads skill and adapt it.` });
  }
}

function checkPins(root, report) {
  for (const rel of packageJsonFiles(root)) {
    const json = readRepoJson(root, rel);
    if (!json) continue;
    for (const field of ['dependencies', 'devDependencies']) {
      const spec = json[field]?.[SDK];
      if (spec !== undefined && spec !== FACTS.sdk.version) {
        report.problem({ file: rel, rule: 'sdk-pin', message: `${field}.${SDK} is "${spec}", not exactly "${FACTS.sdk.version}"`, fix: `Run npm install -E ${SDK}@${FACTS.sdk.version} in every app (npx expo install writes a caret).` });
      }
    }
  }
}

function checkImports(root, files, sources, report) {
  const adapters = FACTS.adapters;
  for (const rel of files) {
    const source = sources.get(rel);
    for (const imp of parseImports(source)) {
      if (imp.specifier !== SDK) continue;
      if (!(rel in adapters)) {
        report.problem({ file: rel, line: imp.line, rule: 'sdk-import', message: `imports ${SDK} outside its adapters`, fix: 'Go through AdsPort/ConsentPort (useServices()); only admob-ads-adapter.ts, admob-consent-adapter.ts and the test-only admob-consent-debug-adapter.ts import the SDK.' });
        continue;
      }
      for (const name of imp.names) {
        if (!adapters[rel].includes(name)) {
          const banned = FACTS.bannedSdkNames.includes(name);
          report.problem({ file: rel, line: imp.line, rule: 'sdk-api', message: `imports ${name} from ${SDK}${banned ? ' (v17 hooks, pools and other formats are not used)' : ''}`, fix: 'Keep the classic create/load/show API the template uses; frequency caps live in ad-policy.ts.' });
        }
      }
    }
  }
  const debug = FACTS.debugAdapter;
  const debugBase = debug.file.split('/').pop().replace(/\.ts$/, '');
  for (const rel of files) {
    if (rel === debug.file || isTestFile(rel)) continue;
    for (const imp of parseImports(sources.get(rel))) {
      if (!imp.specifier.endsWith(`${debugBase}.ts`) && !imp.specifier.endsWith(debugBase)) continue;
      // `import type { ConsentDebugTools }` (test-only-api.ts) is erased by the compiler: no code reaches a bundle.
      if (imp.isType) continue;
      if (!debug.allowedImporters.some((allowed) => rel === allowed || (allowed.endsWith('/') && rel.startsWith(allowed)))) {
        report.problem({ file: rel, line: imp.line, rule: 'debug-adapter-import', message: 'imports the consent debug adapter outside test-only code', fix: 'Import it only from packages/shell/src/app/test-only-entry.ts (compiled out of store builds).' });
      }
    }
  }
}

function checkSourceRules(files, sources, report) {
  const testOnly = FACTS.testOnlyCalls.map((call) => new RegExp(`\\b${call.replace('.', '\\s*\\.\\s*')}\\s*\\(`));
  for (const rel of files) {
    const raw = sources.get(rel);
    const text = maskComments(raw);
    const isTest = isTestFile(rel);
    const add = (index, rule, message, fix) => report.problem({ file: rel, line: lineAt(text, index), rule, message, fix });
    for (const match of text.matchAll(/(?<!LARGE_)\bANCHORED_ADAPTIVE_BANNER\b/g)) add(match.index, 'deprecated-banner-size', 'ANCHORED_ADAPTIVE_BANNER is deprecated in 17.2.0', 'Use BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER.');
    if (!isTest) {
      for (const name of FACTS.bannedRequestOptions) {
        for (const match of text.matchAll(new RegExp(`\\b${name}\\b`, 'g'))) add(match.index, 'content-rating', `${name} is set`, 'Remove it: D8 = general audience; UMP writes the TCF string the SDK reads.');
      }
      if (rel !== FACTS.debugAdapter.file) {
        for (const re of testOnly) {
          const match = re.exec(text);
          if (match) add(match.index, 'test-only-api', `${match[0].replace(/\s+/g, '')}...) outside the test-only debug adapter`, 'Move it into admob-consent-debug-adapter.ts, reachable only from the test-only entry.');
        }
      }
      if (/\/services\/(ads|consent)\//.test(rel)) {
        for (const match of text.matchAll(/\.code\b/g)) add(match.index, 'error-code-branch', 'reads error.code', 'Branch on error.phase, then error.reason (code is deprecated and removed in v18).');
      }
      if (!rel.startsWith('packages/shell/src/services/ads/ad-moments.ts')) {
        for (const effect of callRanges(text, ['useEffect', 'useLayoutEffect', 'useFocusEffect', 'useInsertionEffect'])) {
          const body = text.slice(effect.start, effect.end);
          for (const call of ['showInterstitialIfDue', 'earnRewardedPerk', 'showInterstitial', 'showRewarded']) {
            const at = body.search(new RegExp(`\\b${call}\\s*\\(`));
            if (at !== -1) add(effect.start + at, 'ad-in-effect', `${call}() runs inside ${effect.name}()`, 'Call it only from the Next / Replay / Try again or "Watch an ad" press handler, never on mount.');
          }
        }
      }
    }
    if (rel.endsWith('/game.config.ts')) continue; // its IDs are checked by game-config-ids
    const inSampleAllowed = FACTS.sampleAllowedIn.includes(rel) || isTest;
    if (!inSampleAllowed) {
      for (const match of raw.matchAll(new RegExp(FACTS.samplePublisher, 'g'))) add(match.index, 'sample-id', "Google's sample publisher ID in app code", 'Read TestIds.* in the adapter and GOOGLE_SAMPLE_APP_IDS in ads-config.ts; never type test IDs.');
    }
    if (!isTest) {
      for (const match of raw.matchAll(/ca-app-pub-\d{16}[~/]\d{10}/g)) {
        if (!match[0].includes(FACTS.samplePublisher)) add(match.index, 'hard-coded-id', `AdMob ID ${match[0]} in app code`, 'Real IDs live only in apps/<game>/game.config.ts and reach the runtime through expo.extra.adUnits.');
      }
    }
  }
}

// R4G-G09: UMP's debug geography (and its test devices) makes any network answer as the EEA or as
// elsewhere. Only test-build code may set it: S15's debug services build their own consent port with
// it (the debug link's geo=eea|other, compiled out of store builds with the test-only entry), and the
// adapter reads it. Anywhere else it would reach a store build's consent moment.
function checkDebugGeography(files, sources, report) {
  const { adapter, allowedIn } = FACTS.debugGeography;
  const isAllowed = (rel) => rel === adapter || isTestFile(rel) || allowedIn.some((allowed) => rel === allowed || (allowed.endsWith('/') && rel.startsWith(allowed)));
  for (const rel of files.filter((file) => !isAllowed(file))) {
    const text = maskComments(sources.get(rel));
    for (const match of text.matchAll(/\b(debugGeography|testDeviceIdentifiers)\s*:|\b(AdsConsentDebugGeography)\b/g)) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'debug-geography-test-only', message: `${match[1] ?? match[2]} is set outside test-only code, so a store build could ask UMP with a debug geography`, fix: "Pass only { onError } to createConsentPort on the store path. A test build sets the geography through debugServices.setConsentGeography (the debug link's geo=eea|other), whose services build their own port with createConsentPort(adsMode, { debugGeography, onError })." });
    }
  }
}

// L11 (D64): the AdsPort reports where the rewarded ad stands ('loading' | 'ready' | 'unavailable'),
// never a loaded flag. With a flag, "not loaded" meant both "still loading" and "cannot come", so a
// lost run could neither show its offer's loading state nor end at once (a stranded finished run).
function checkRewardedStatus(root, files, sources, report) {
  const { port, adapter, statusType, members, retired } = FACTS.rewardedStatus;
  const portText = existsSync(join(root, port)) ? maskComments(readRepoText(root, port)) : null;
  if (portText !== null) {
    if (!portText.includes(statusType)) report.problem({ file: port, rule: 'rewarded-status', message: `does not export ${statusType}`, fix: "Restore ads-port.ts from the template: export type RewardedStatus = 'loading' | 'ready' | 'unavailable' (L11)." });
    for (const member of members.filter((name) => !new RegExp(`\\b${name}\\s*:`).test(portText))) {
      report.problem({ file: port, rule: 'rewarded-status', message: `AdsPort has no ${member} member`, fix: 'Restore ads-port.ts from the template: rewardedStatus(): RewardedStatus and subscribeRewardedStatus(listener) (L11, D64).' });
    }
  }
  const adapterText = existsSync(join(root, adapter)) ? maskComments(readRepoText(root, adapter)) : null;
  if (adapterText !== null) {
    for (const member of members.filter((name) => !new RegExp(`\\b${name}\\s*:`).test(adapterText))) {
      report.problem({ file: adapter, rule: 'rewarded-status', message: `the adapter does not report ${member}`, fix: "Restore admob-ads-adapter.ts from the template: a status cell set to 'loading' by a preload, 'ready' on LOADED, 'unavailable' on a load error, once shown and before initialize." });
    }
  }
  for (const rel of files) {
    const text = maskComments(sources.get(rel));
    for (const match of text.matchAll(new RegExp(`\\b(${retired.join('|')})\\b`, 'g'))) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'rewarded-status', message: `uses ${match[1]}, the round-4 loaded flag (it hides a continue that is still loading)`, fix: "Use AdsPort.rewardedStatus() and subscribeRewardedStatus(); perkOffer gives a continue 'loading' while its ad loads and 'hidden' only when no ad can come (L11)." });
    }
  }
}

// ADS_MODE=off builds (screenshots, E2E, the runtime network audit) must never ask Google's UMP:
// only createConsentPort() may build the real consent adapter.
function checkConsentFactory(files, sources, report) {
  const { file: factory, adapter } = FACTS.consentFactory;
  for (const rel of files) {
    if (rel === factory || rel === adapter || isTestFile(rel)) continue;
    const text = maskComments(sources.get(rel));
    for (const match of text.matchAll(/\bcreateAdmobConsentAdapter\s*\(/g)) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'consent-factory', message: 'createAdmobConsentAdapter() is called directly', fix: 'Build the ConsentPort with createConsentPort(readAdsExtra().adsMode, options): an ADS_MODE=off build must never ask Google UMP (a network request from the app).' });
    }
  }
}

/**
 * Owner decision O1 (Apple 5.1.2(i)): Apple's tracking prompt goes through the ConsentPort. Only
 * admob-consent-adapter.ts imports expo-tracking-transparency (the other ports, screens and the
 * fake never ask), and it imports only the permission calls.
 */
function checkTrackingImports(files, sources, report) {
  const { package: pkg, adapter, allowedNames } = FACTS.tracking;
  for (const rel of files) {
    for (const imp of parseImports(sources.get(rel))) {
      if (imp.specifier !== pkg && !imp.specifier.startsWith(`${pkg}/`)) continue;
      if (rel !== adapter) {
        report.problem({ file: rel, line: imp.line, rule: 'att-adapter-only', message: `imports ${pkg} outside the consent adapter`, fix: `Ask through ConsentPort.requestTracking() (useServices().consent); only ${adapter} imports ${pkg}.` });
        continue;
      }
      for (const name of imp.names.filter((item) => !allowedNames.includes(item))) {
        report.problem({ file: rel, line: imp.line, rule: 'att-adapter-only', message: `imports ${name} from ${pkg}`, fix: `Use only ${allowedNames.join(', ')}; the IDFA itself is Google's SDK's business, never the app's.` });
      }
    }
  }
}

/** The body of `export async function prepareAds` (masked), or ''. */
function prepareAdsBody(text) {
  const start = text.search(/export\s+async\s+function\s+prepareAds\b/);
  if (start < 0) return { body: '', start: -1 };
  const end = text.indexOf('\n}', start);
  return { body: text.slice(start, end < 0 ? undefined : end), start };
}

/**
 * The D43 order inside prepareAds: Google's form (consentThroughIntro / showFormIfRequired) and the
 * canRequestAds check come first, then requestTracking(), then initialize(). So Apple's prompt
 * never appears before Google's form, and no ad request leaves before the player answered it.
 */
function checkTrackingOrder(root, report) {
  const rel = FACTS.tracking.gate;
  if (!existsSync(join(root, rel))) return; // required-file reports it
  const text = maskComments(readRepoText(root, rel));
  const { body, start } = prepareAdsBody(text);
  const add = (index, message, fix) => report.problem({ file: rel, line: lineAt(text, Math.max(start, 0) + Math.max(index, 0)), rule: 'att-order', message, fix });
  if (start < 0) {
    add(0, 'no prepareAds() in the ad gate', 'Copy templates/packages/shell/src/services/ads/ad-gate.ts.');
    return;
  }
  const at = (re) => body.search(re);
  const tracking = at(/\.requestTracking\s*\(/);
  const form = Math.max(at(/\bconsentThroughIntro\s*\(/), at(/\.showFormIfRequired\s*\(/));
  const allowed = at(/\bcanRequestAds\b/);
  const initialize = at(/\.initialize\s*\(/);
  const fix = 'In prepareAds: refresh, then (where required) the S3 intro and Google\'s form, then `if (!info.canRequestAds) return false;`, then `await deps.consent.requestTracking();`, then `await deps.ads.initialize();` and the preloads.';
  if (tracking < 0) add(0, 'prepareAds never asks Apple\'s tracking prompt (ConsentPort.requestTracking)', fix);
  else {
    if (form >= 0 && tracking < form) add(tracking, 'requestTracking() runs before Google\'s form', fix);
    if (allowed >= 0 && tracking < allowed) add(tracking, 'requestTracking() runs before the canRequestAds check (a player who allowed no ads would be asked)', fix);
    if (initialize >= 0 && tracking > initialize) add(tracking, 'requestTracking() runs after initialize(): the SDK may request an ad before the ATT answer', fix);
  }
}

/**
 * Apple's prompt needs NSUserTrackingUsageDescription (without it expo-tracking-transparency stops
 * the app): the plugin entry with the en text in shell-plugins.ts, the four localised texts in
 * withShell's locales from the Shell catalogs, and the package in every app. One writer only: the
 * AdMob plugin's own userTrackingUsageDescription stays unset.
 */
function checkTrackingPlugin(root, report) {
  const facts = FACTS.tracking;
  const read = (rel) => (existsSync(join(root, rel)) ? maskComments(readRepoText(root, rel)) : '');
  const plugins = read(facts.plugins);
  if (!new RegExp(`\\[\\s*['"]${facts.package}['"]\\s*,\\s*\\{[^}]*userTrackingPermission\\s*:`).test(plugins)) {
    report.problem({ file: facts.plugins, rule: 'att-plugin', message: `no ['${facts.package}', { userTrackingPermission }] entry in the plugin list`, fix: `Add ['${facts.package}', { userTrackingPermission: TRACKING_USAGE_DESCRIPTIONS.en }] to shellPlugins (architecture-and-boundaries' shell-plugins.ts template).` });
  }
  const withShell = read(facts.withShell);
  if (!/\bNSUserTrackingUsageDescription\s*:/.test(withShell)) {
    report.problem({ file: facts.withShell, rule: 'att-plugin', message: 'withShell writes no localised NSUserTrackingUsageDescription', fix: 'In localizedNames: ios: { CFBundleDisplayName, NSUserTrackingUsageDescription: TRACKING_USAGE_DESCRIPTIONS[lang] } for en, de, fa and ckb.' });
  }
  for (const lang of facts.languages) {
    const rel = `${facts.catalogDir}/${lang}.json`;
    const text = readRepoJson(root, rel)?.[facts.catalogKey];
    if (typeof text !== 'string' || text.trim() === '') report.problem({ file: rel, rule: 'att-plugin', message: `no "${facts.catalogKey}" text in ${lang}`, fix: 'Add the copy deck\'s consent.tracking.usage-description text to the Shell catalog (i18n-strings-and-catalogs).' });
  }
  const apps = join(root, 'apps');
  for (const name of existsSync(apps) ? readdirSync(apps).sort() : []) {
    const rel = `apps/${name}/package.json`;
    const json = readRepoJson(root, rel);
    if (json === null || json === undefined) continue;
    if (json.dependencies?.[facts.package] === undefined) report.problem({ file: rel, rule: 'att-plugin', message: `${facts.package} is not installed in this app (its plugin cannot resolve)`, fix: `Plan it with the dependency-management skill (plan-dependency, --online), then install "${facts.appSpec}" in every app.` });
  }
}

/** The AdMob plugin's own ATT string would be a second writer of NSUserTrackingUsageDescription. */
function checkNoSecondTrackingWriter(files, sources, report) {
  for (const rel of files.filter((file) => !isTestFile(file))) {
    const text = maskComments(sources.get(rel));
    for (const match of text.matchAll(/\buserTrackingUsageDescription\b/g)) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'att-plugin', message: 'userTrackingUsageDescription is set (a second writer of the ATT text)', fix: 'Remove it: the expo-tracking-transparency plugin and withShell\'s locales write NSUserTrackingUsageDescription, from the Shell catalogs.' });
    }
  }
}

function checkAdapterContent(root, report) {
  const adsAdapter = 'packages/shell/src/services/ads/admob-ads-adapter.ts';
  if (existsSync(join(root, adsAdapter))) {
    const text = maskComments(readRepoText(root, adsAdapter));
    if (!/addAdEventListener\(\s*RewardedAdEventType\.EARNED_REWARD\b/.test(text)) report.problem({ file: adsAdapter, rule: 'reward-on-earned', message: 'no RewardedAdEventType.EARNED_REWARD listener', fix: 'Grant the reward only on EARNED_REWARD; CLOSED alone resolves "dismissed".' });
    if (!/maxAdContentRating\s*:\s*MaxAdContentRating\.PG\b/.test(text)) report.problem({ file: adsAdapter, rule: 'content-rating', message: 'setRequestConfiguration does not set maxAdContentRating: MaxAdContentRating.PG', fix: 'Set it in initialize(), before mobileAds().initialize(), matching the console setting (A4).' });
  }
  const mock = '__mocks__/react-native-google-mobile-ads.ts';
  if (existsSync(join(root, mock)) && !readRepoText(root, mock).includes('LARGE_ANCHORED_ADAPTIVE_BANNER')) {
    report.problem({ file: mock, rule: 'root-mock', message: 'the root mock lacks BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER', fix: 'Copy the template mock; without the key a banner test passes undefined as the size.' });
  }
  for (const rel of FACTS.purePolicyFiles) {
    if (!existsSync(join(root, rel))) continue;
    const raw = readRepoText(root, rel);
    const text = maskComments(raw);
    for (const imp of parseImports(raw)) {
      if (!imp.specifier.startsWith('./')) report.problem({ file: rel, line: imp.line, rule: 'pure-policy', message: `imports ${imp.specifier}`, fix: 'The ad policy is pure: import only its sibling policy modules; pass facts in as arguments.' });
    }
    for (const match of text.matchAll(/\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bMath\s*\.\s*random\b/g)) report.problem({ file: rel, line: lineAt(text, match.index), rule: 'pure-policy', message: `${match[0]} in the ad policy`, fix: 'Take nowMs from ClockPort as an argument.' });
  }
}

function checkConfig(root, report) {
  const files = configFiles(root);
  const pluginsDue = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
  if (pluginsDue !== null) {
    report.skip({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'plugin-entry', message: pluginsDue });
    report.skip({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'att-plugin', message: pluginsDue });
  } else {
    checkPluginEntry(root, files, report);
    checkTrackingPlugin(root, report);
  }
  checkUnitsExtra(root, files, report);
}

/** The one native plugin list (shell-plugins.ts) gives the SDK admobPluginOptions(...), never literals. */
function checkPluginEntry(root, files, report) {
  let hasEntry = false;
  for (const rel of files) {
    const text = maskComments(readRepoText(root, rel));
    const at = text.indexOf(`'${SDK}'`) === -1 ? text.indexOf(`"${SDK}"`) : text.indexOf(`'${SDK}'`);
    if (at === -1) continue;
    const window = text.slice(at, at + 200);
    if (/admobPluginOptions\s*\(/.test(window)) hasEntry = true;
    else if (/iosAppId|skAdNetworkItems/.test(window)) report.problem({ file: rel, line: lineAt(text, at), rule: 'plugin-entry', message: 'the plugin gets literal options', fix: `Pass admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS) so every variant gets the right app ID.` });
  }
  if (!hasEntry) report.problem({ file: SHELL_DUE_TARGETS.plugins.file, rule: 'plugin-entry', message: `no ['${SDK}', admobPluginOptions(...)] plugin entry in the app config`, fix: "Add ['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)] to shellPlugins (architecture-and-boundaries' shell-plugins.ts; withShell spreads it)." });
}

/** Real unit IDs may reach expo.extra only through adUnitsExtra (null unless ADS_MODE=live). */
function checkUnitsExtra(root, files, report) {
  let hasUnitsExtra = false;
  for (const rel of files.filter((path) => !isTestFile(path))) {
    const text = maskComments(readRepoText(root, rel));
    if (/\badUnitsExtra\s*\(/.test(text) && !rel.endsWith('/ads-config.ts')) hasUnitsExtra = true;
    for (const match of text.matchAll(/\badUnits\s*:\s*(?!adUnitsExtra\s*\()/g)) {
      report.problem({ file: rel, line: lineAt(text, match.index), rule: 'extra-ad-units', message: 'expo.extra.adUnits is written without adUnitsExtra()', fix: 'Compute const adUnits = adUnitsExtra(adsMode, game.ads.ids) and spread ...(adUnits === null ? {} : { adUnits }): real IDs only in live builds, and never a null key.' });
    }
  }
  if (!hasUnitsExtra) report.problem({ file: 'packages/shell/src/config/with-shell.ts', rule: 'extra-ad-units', message: 'withShell does not write expo.extra.adUnits through adUnitsExtra()', fix: 'In withShell: const adUnits = adUnitsExtra(adsMode, game.ads.ids); extra: { appVariant, adsMode, ...(adUnits === null ? {} : { adUnits }) }.' });
}

function checkSkadnetwork(root, report) {
  const rel = FACTS.skadnetwork.file;
  if (!existsSync(join(root, rel))) return;
  const text = maskComments(readRepoText(root, rel));
  const ids = [...text.matchAll(/['"]([^'"]+)['"]/g)].map((match) => ({ id: match[1], line: lineAt(text, match.index) }));
  const pattern = new RegExp(FACTS.skadnetwork.idPattern);
  const seen = new Set();
  const malformed = ids.filter(({ id }) => !pattern.test(id));
  if (malformed.length > 0) {
    const [first] = malformed;
    report.problem({ file: rel, line: first.line, rule: 'skadnetwork', message: `"${first.id}" is not a full SKAdNetwork identifier (${malformed.length} such entries)`, fix: 'Each entry is "<10 characters>.skadnetwork"; regenerate with refresh-skadnetwork.ts.' });
  }
  for (const { id, line } of ids) {
    if (seen.has(id)) report.problem({ file: rel, line, rule: 'skadnetwork', message: `duplicate "${id}"`, fix: 'Regenerate the list with refresh-skadnetwork.ts.' });
    seen.add(id);
  }
  if (ids.length < FACTS.skadnetwork.minCount) report.problem({ file: rel, rule: 'skadnetwork', message: `${ids.length} identifiers (Google lists at least ${FACTS.skadnetwork.minCount})`, fix: 'Run node packages/tooling/src/ads/refresh-skadnetwork.ts and commit the result.' });
  if (ids.length > 0 && malformed.length === 0 && ids[0].id !== FACTS.skadnetwork.first) report.problem({ file: rel, line: ids[0].line, rule: 'skadnetwork', message: `the list starts with "${ids[0].id}", not Google's first entry ${FACTS.skadnetwork.first}`, fix: 'Regenerate the list with refresh-skadnetwork.ts.' });
}

function numberAfter(text, key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*([0-9_]+)`).exec(text);
  return match ? { value: Number(match[1].replace(/_/g, '')), index: match.index } : null;
}

function checkGameConfigs(root, report) {
  const apps = join(root, 'apps');
  for (const name of existsSync(apps) ? readdirSync(apps).sort() : []) {
    if (existsSync(join(apps, name, 'package.json')) && !existsSync(join(apps, name, 'game.config.ts'))) {
      report.problem({ file: `apps/${name}/game.config.ts`, rule: 'game-config-ids', message: 'missing (every game keeps its ads section there)', fix: 'Create it from the new-game scaffold and fill ads.policy and ads.ids.' });
    }
  }
  for (const rel of configFiles(root).filter((path) => path.endsWith('/game.config.ts'))) {
    const raw = readRepoText(root, rel);
    const text = maskComments(raw);
    for (const [key, min] of Object.entries(FACTS.policyMinimums)) {
      const found = numberAfter(text, key);
      if (found === null) report.problem({ file: rel, rule: 'policy-numbers', message: `ads.policy.${key} is missing`, fix: `Set it (spec 8.8 default: ${min}).` });
      else if (found.value < min) report.problem({ file: rel, line: lineAt(text, found.index), rule: 'policy-numbers', message: `ads.policy.${key} = ${found.value} is below the spec 8.8 minimum ${min}`, fix: `Use ${min} or more; the spec numbers are floors, a game may only be gentler.` });
    }
    const idsAt = text.search(/\bids\s*:\s*\{/);
    if (idsAt === -1) {
      report.problem({ file: rel, rule: 'game-config-ids', message: 'no ads.ids section', fix: 'Add ads.ids.ios { appId, units { banner, interstitial, rewarded } } and android: null.' });
      continue;
    }
    const section = text.slice(idsAt);
    const checks = [['appId', APP_ID], ['banner', UNIT_ID], ['interstitial', UNIT_ID], ['rewarded', UNIT_ID]];
    for (const [key, pattern] of checks) {
      const match = new RegExp(`\\b${key}\\s*:\\s*['"]([^'"]*)['"]`).exec(section);
      if (!match) {
        report.problem({ file: rel, rule: 'game-config-ids', message: `ads.ids.ios ${key} is missing`, fix: 'Ask the owner for the AdMob IDs (console step A2).' });
        continue;
      }
      const line = lineAt(text, idsAt + match.index);
      if (/^__[A-Z0-9_]+__$/.test(match[1])) report.problem({ file: rel, line, rule: 'game-config-ids', message: `${key} is still the placeholder ${match[1]}`, fix: 'Write the real ID from the owner (A2) or a documented-format placeholder until then.' });
      else if (match[1].includes(FACTS.samplePublisher)) report.problem({ file: rel, line, rule: 'game-config-ids', message: `${key} is Google's sample ID`, fix: "The game's own IDs go here; test builds pick the samples automatically." });
      else if (!pattern.test(match[1])) report.problem({ file: rel, line, rule: 'game-config-ids', message: `${key} "${match[1]}" is not in AdMob's format`, fix: key === 'appId' ? 'Use ca-app-pub-<16 digits>~<10 digits>.' : 'Use ca-app-pub-<16 digits>/<10 digits>.' });
    }
  }
}

/** Every <Name ...> opening tag, braces and quotes respected (so arrows inside props are fine). */
function jsxTags(text, name) {
  const tags = [];
  for (const start of text.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = start.index + name.length + 1; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) {
        end = i;
        break;
      }
    }
    tags.push({ 0: text.slice(start.index, end === -1 ? text.length : end + 1), index: start.index });
  }
  return tags;
}

/** Screens ('home', 'levels', 'stats') for which some runtime code asks shouldShowBanner(..., '<screen>'). */
function policyScreens(files, sources) {
  const screens = new Set();
  for (const rel of files) {
    if (isTestFile(rel) || rel.startsWith('packages/shell/src/services/ads/')) continue;
    const text = maskComments(sources.get(rel));
    for (const call of callRanges(text, ['shouldShowBanner'])) {
      for (const literal of text.slice(call.start, call.end).matchAll(/['"]([a-z-]+)['"]/g)) screens.add(literal[1]);
    }
  }
  // useBannerSlot('<screen>') (app/use-ad-context.ts) asks the policy for its placement, as long as
  // its definition really calls shouldShowBanner.
  const isSlotHookPolicy = files.some((rel) => !isTestFile(rel) && slotHookAsksPolicy(maskComments(sources.get(rel))));
  if (!isSlotHookPolicy) return screens;
  for (const rel of files) {
    if (isTestFile(rel)) continue;
    const text = maskComments(sources.get(rel));
    for (const call of callRanges(text, ['useBannerSlot'])) {
      for (const literal of text.slice(call.start, call.end).matchAll(/['"]([a-z-]+)['"]/g)) screens.add(literal[1]);
    }
  }
  return screens;
}

/** True when this file defines useBannerSlot and its body computes isAllowed with shouldShowBanner(). */
function slotHookAsksPolicy(text) {
  const body = /export\s+function\s+useBannerSlot\b[\s\S]*?(?=\nexport\s|$)/.exec(text)?.[0] ?? '';
  return /\bshouldShowBanner\s*\(/.test(body);
}

function checkBanners(files, sources, report) {
  const asked = policyScreens(files, sources);
  for (const rel of files) {
    const text = maskComments(sources.get(rel));
    if (isTestFile(rel)) continue;
    for (const match of jsxTags(text, 'AdBannerSlot')) {
      const slot = Object.entries(FACTS.bannerSlots).find(([folder]) => rel.startsWith(folder));
      const testID = /testID\s*=\s*["']([^"']+)["']/.exec(match[0])?.[1];
      const line = lineAt(text, match.index);
      if (!slot) report.problem({ file: rel, line, rule: 'banner-placement', message: 'a banner outside Home, Levels and Statistics', fix: 'Banners appear only at the bottom of Home, Levels and Statistics (spec 8.8).' });
      else if (testID !== slot[1]) report.problem({ file: rel, line, rule: 'banner-placement', message: `banner testID is "${testID ?? '(none)'}"`, fix: `Use testID="${slot[1]}".` });
      const screen = slot?.[1].split('.')[0];
      const isInline = /isAllowed\s*=\s*\{[^}]*shouldShowBanner\s*\(/s.test(match[0]);
      // A view that gets the flag from its props or view model (isAllowed={model.banner.isAllowed && ...}).
      const isPassedIn = /isAllowed\s*=\s*\{\s*(?:[\w$]+\s*\??\.\s*)*is[A-Z]\w*\b/.test(match[0]);
      if (!isInline && !isPassedIn) {
        report.problem({ file: rel, line, rule: 'banner-placement', message: 'isAllowed is not computed from shouldShowBanner()', fix: 'Pass isAllowed={shouldShowBanner(config, context, <screen>)}, or a flag from the view model that the screen container computes with shouldShowBanner().' });
      } else if (screen !== undefined && !asked.has(screen)) {
        report.problem({ file: rel, line, rule: 'banner-placement', message: `no runtime code asks shouldShowBanner(config, context, '${screen}') for this slot`, fix: `Take the slot's model from useBannerSlot('${screen}') (app/use-ad-context.ts, which asks shouldShowBanner) in the screen's model hook, or call shouldShowBanner(adConfig, adContext, '${screen}') there; never a hand-made boolean.` });
      }
    }
  }
}

/** The source of a top-level function or const arrow named `name` in `text` (masked), or ''. */
function definitionOf(text, name) {
  const start = text.search(new RegExp(`(?:function\\s+${name}\\b|const\\s+${name}\\s*=)`));
  if (start < 0) return '';
  const end = text.indexOf('\n}', start);
  return text.slice(start, end < 0 ? undefined : end);
}

/** A composition-root rule's SKIP reason: no Shell app yet (slice []) or its target not yet built. */
function rootSkipReason(root, slice, target) {
  return sliceSkipReason(slice) ?? dueSkipReason(root, target);
}

const ROOT_TARGET = { file: 'packages/shell/src/app/create-shell-parts.ts', step: 7 };
const FEATURES_TARGET = { file: 'packages/shell/src/app/shell-features.tsx', step: 7 };

/**
 * Spec 8.8: every finished level counts toward the interstitial caps in the ONE run-end update.
 * The composition root passes extendRunEnd to createGameHost, and that function calls
 * recordLevelEnd; without it no second interstitial can ever be due.
 */
function checkLevelEndRecorded(root, slice, files, sources, report) {
  const reason = rootSkipReason(root, slice, ROOT_TARGET);
  if (reason !== null) {
    report.skip({ file: ROOT_TARGET.file, rule: 'level-end-recorded', message: reason });
    return;
  }
  const rel = files.find((file) => file.startsWith('packages/shell/src/app/') && !isTestFile(file) && /\bcreateGameHost\s*\(/.test(maskComments(sources.get(file)))) ?? ROOT_TARGET.file;
  const text = sources.has(rel) ? maskComments(sources.get(rel)) : '';
  const passed = /\bextendRunEnd\s*:\s*([A-Za-z_$][\w$]*)/.exec(text);
  const fix = 'Pass extendRunEnd: recordAdLevelEnd to createGameHost, where recordAdLevelEnd(doc, summary) returns the doc with ads.history = recordLevelEnd(doc.ads.history, summary.isWon ? \'win\' : \'lose\') for level runs (game-host-integration\'s create-shell-parts.ts template).';
  if (passed === null) {
    report.problem({ file: rel, line: 1, rule: 'level-end-recorded', message: 'createGameHost gets no extendRunEnd: a finished level never counts in the ad history, so after the first interstitial none is ever due again', fix });
  } else if (!/\brecordLevelEnd\s*\(/.test(definitionOf(text, passed[1]))) {
    report.problem({ file: rel, line: lineAt(text, passed.index), rule: 'level-end-recorded', message: `extendRunEnd: ${passed[1]} does not call recordLevelEnd`, fix });
  }
}

/**
 * Spec S3: the Shell's consent moment (app/consent-moment.tsx) is mounted around the navigator, it is
 * the one caller of prepareAds (through consent-moment-flow.ts), and a banner screen asks it for the
 * ad moment (useBannerSlot). Otherwise Google's form opens without S3, or ads are never initialised.
 */
function checkConsentMoment(root, slice, files, sources, report) {
  const reason = rootSkipReason(root, slice, FEATURES_TARGET);
  if (reason !== null) {
    report.skip({ file: FEATURES_TARGET.file, rule: 'consent-moment', message: reason });
    return;
  }
  const flow = 'packages/shell/src/services/ads/consent-moment-flow.ts';
  const add = (file, message, fix) => report.problem({ file, line: 1, rule: 'consent-moment', message, fix });
  const runtime = files.filter((file) => !isTestFile(file));
  const texts = new Map(runtime.map((file) => [file, maskComments(sources.get(file))]));
  if (!runtime.includes('packages/shell/src/app/consent-moment.tsx')) add('packages/shell/src/app/consent-moment.tsx', 'the consent moment host is missing', 'Copy templates/packages/shell/src/app/consent-moment.tsx, consent-moment-context.tsx and use-consent-moment.ts from this skill.');
  if (![...texts.values()].some((text) => /<ConsentMoment\b/.test(text))) add(FEATURES_TARGET.file, 'no app file renders <ConsentMoment> around the navigator', 'In ShellFeatures: <ConsentMoment isHeld={isConsentMomentHeld} debug={debug.services}> around <ShellNavigator /> (game-host-integration\'s shell-features.tsx template).');
  for (const [file, text] of texts) {
    if (file === flow || file.endsWith('/services/ads/ad-gate.ts')) continue;
    const call = /\bprepareAds\s*\(/.exec(text);
    if (call) report.problem({ file, line: lineAt(text, call.index), rule: 'consent-moment', message: 'prepareAds() is called outside the consent moment: Google\'s form would open without S3', fix: 'Let consent-moment-flow.ts call prepareAds (its showIntro step shows ConsentIntroScreen first); screens only ask for the ad moment through useBannerSlot.' });
  }
  if (!/\bprepareAds\s*\(/.test(texts.get(flow) ?? '')) add(flow, 'nothing prepares ads: the SDK is never initialised and no ad ever loads', 'Copy templates/packages/shell/src/services/ads/consent-moment-flow.ts: it runs prepareAds (with the S3 intro step) the first time a banner screen is open.');
  const slot = definitionOf(texts.get('packages/shell/src/app/use-ad-context.ts') ?? '', 'useBannerSlot');
  if (slot !== '' && !/\brequestAdMoment\b/.test(slot)) add('packages/shell/src/app/use-ad-context.ts', 'useBannerSlot does not ask the consent moment for its ad moment', 'In useBannerSlot: const requestAdMoment = useOptionalConsentMoment()?.requestAdMoment; useEffect(() => requestAdMoment?.(), [requestAdMoment]).');
}

/** Number of top-level arguments in the call whose parentheses span [open, close]. */
function argumentCount(text, open, close) {
  const inner = text.slice(open + 1, close).trim();
  if (inner === '') return 0;
  let depth = 0;
  let count = 1;
  for (const ch of inner) {
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) count += 1;
  }
  return inner.endsWith(',') ? count - 1 : count;
}

/**
 * Spec 8.5 and 8.8: the free hints come from game.config's hints.freePerDay (0 for a game without
 * solver hints). The hint perk is useHintPerk(today), never a count that ignores the config.
 */
function checkFreeHints(files, sources, report) {
  for (const rel of files.filter((file) => !isTestFile(file) && !file.startsWith('packages/shell/src/stores/'))) {
    const text = maskComments(sources.get(rel));
    for (const call of callRanges(text, ['selectFreeHintsLeft']).filter((range) => argumentCount(text, range.start, range.end) < 3)) {
      report.problem({ file: rel, line: lineAt(text, call.start), rule: 'free-hints-config', message: 'selectFreeHintsLeft(state, today) ignores game.config hints.freePerDay', fix: 'Take the hint perk from useHintPerk(today) (app/use-ad-context.ts), which passes extra.hints.freePerDay: a game whose config gives 0 free hints never offers one.' });
    }
    if (rel.startsWith('packages/shell/src/services/ads/')) continue;
    for (const call of callRanges(text, ['perkOffer']).filter((range) => /^\(\s*\{\s*kind\s*:\s*'hint'/.test(text.slice(range.start, range.end)))) {
      report.problem({ file: rel, line: lineAt(text, call.start), rule: 'free-hints-config', message: "perkOffer gets a hand-built { kind: 'hint', freeHintsLeft } perk", fix: 'Pass useHintPerk(today) (app/use-ad-context.ts): its free-hint count follows game.config hints.freePerDay.' });
    }
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-ads', json: options.json });
  const files = [...runtimeSourceFiles(root, { includeTooling: false }), ...configFiles(root).filter((rel) => rel.startsWith('apps/'))];
  const unique = [...new Set(files)];
  const sources = new Map(unique.map((rel) => [rel, readRepoText(root, rel)]));
  checkRequiredFiles(root, report);
  checkPins(root, report);
  checkImports(root, unique, sources, report);
  checkConsentFactory(unique, sources, report);
  checkDebugGeography(unique, sources, report);
  checkRewardedStatus(root, unique, sources, report);
  checkTrackingImports(unique, sources, report);
  checkTrackingOrder(root, report);
  const withConfig = [...new Set([...unique, ...configFiles(root)])];
  checkNoSecondTrackingWriter(withConfig, new Map(withConfig.map((rel) => [rel, sources.get(rel) ?? readRepoText(root, rel)])), report);
  checkSourceRules(unique, sources, report);
  checkAdapterContent(root, report);
  checkConfig(root, report);
  checkSkadnetwork(root, report);
  checkGameConfigs(root, report);
  checkBanners(unique, sources, report);
  const slice = readShellSlice(root);
  checkLevelEndRecorded(root, slice, unique, sources, report);
  checkConsentMoment(root, slice, unique, sources, report);
  checkFreeHints(unique, sources, report);
  return report.finish({ checked: unique.length, unit: 'files' });
});
