#!/usr/bin/env node
// check-ad-behaviour.mjs: runs the spec 8.8 decision table against the repo's own ad modules
// (ad-policy, ad-history, perk-offer, ad-gate, consent-moment-flow, ad-moments, fullscreen-ad,
// ads-config, app-variant) and runs the SDK adapters, the ads and consent factories and read-ads-extra
// against scripted stand-ins of the ads SDK, expo-tracking-transparency and react-native (lib/stubs/),
// all loaded with Node's type stripping. A weakened Jest test cannot hide a broken rule.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-ad-behaviour.mjs [repo-root]

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, parseArgs, requireDir, run } from './check-lib.mjs';
import { importRepoModule, setModuleStubs } from './lib/load-ts.mjs';
import { constantsStub } from './lib/stubs/expo-constants.mjs';
import { trackingStub } from './lib/stubs/expo-tracking-transparency.mjs';
import { reactNativeStub } from './lib/stubs/react-native.mjs';
import { sdkStub, TestIds } from './lib/stubs/react-native-google-mobile-ads.mjs';

const STUBS = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'stubs');
setModuleStubs({
  'react-native-google-mobile-ads': join(STUBS, 'react-native-google-mobile-ads.mjs'),
  react: join(STUBS, 'react.mjs'),
  'expo-constants': join(STUBS, 'expo-constants.mjs'),
  'expo-tracking-transparency': join(STUBS, 'expo-tracking-transparency.mjs'),
  'react-native': join(STUBS, 'react-native.mjs'),
});

const SPEC = {
  name: 'check-ad-behaviour',
  summary: "Loads the repo's ad modules (Node type stripping) and checks them against the spec 8.8 decision table: interstitial caps, banner screens, perk offers, ad history, the consent -> ATT -> initialize -> preload order, pausing around fullscreen ads, which IDs each ADS_MODE gets, and that an ADS_MODE=off build never asks Google for consent nor Apple for tracking.",
  usage: '[repo-root] [--json]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: module-load, interstitial-rules, banner-rules, perk-rules (the L11 continue offer: loading is shown, hidden ends the run), ad-history, consent-order,',
    '  consent-moment-flow, fullscreen-lifecycle, ads-config, variant-matrix, adapter-init,',
    '  adapter-interstitial, adapter-rewarded, adapter-rewarded-status, adapter-banner, ads-factory, read-ads-extra,',
    '  consent-adapter, tracking-adapter, consent-factory.',
    'The SDK, expo-tracking-transparency, react-native, react and expo-constants are replaced by the',
    'scripted stand-ins in lib/stubs/.',
    'Needs Node 22.18+ (type stripping). Modules must use erasable TypeScript and explicit .ts imports.',
  ].join('\n'),
};

const ADS = 'packages/shell/src/services/ads';
const FILES = {
  policy: `${ADS}/ad-policy.ts`,
  history: `${ADS}/ad-history.ts`,
  perk: `${ADS}/perk-offer.ts`,
  gate: `${ADS}/ad-gate.ts`,
  flow: `${ADS}/consent-moment-flow.ts`,
  moments: `${ADS}/ad-moments.ts`,
  fullscreen: `${ADS}/fullscreen-ad.ts`,
  config: 'packages/shell/src/config/ads-config.ts',
  variant: 'packages/shell/src/config/app-variant.ts',
  adapter: `${ADS}/admob-ads-adapter.ts`,
  factory: `${ADS}/ads-factory.ts`,
  extra: `${ADS}/read-ads-extra.ts`,
  consentAdapter: 'packages/shell/src/services/consent/admob-consent-adapter.ts',
  consentFactory: 'packages/shell/src/services/consent/consent-factory.ts',
};

const CONFIG = { isAdsEnabled: true, minLevelsCompletedBeforeFirst: 3, minMsBetweenInterstitials: 180_000, minLevelsCompletedBetween: 2 };
const READY = { isPremium: false, isOnline: true, canRequestAds: true, isTutorialDone: true, levelsCompletedTotal: 10 };
const EMPTY = { lastInterstitialAtMs: null, levelsCompletedSinceInterstitial: 0, didLastInterstitialFollowLoss: false };
const T0 = 1_000_000_000;
const PUB = '1234567890123456';
const LIVE_IDS = {
  ios: { appId: `ca-app-pub-${PUB}~1234567890`, units: { banner: `ca-app-pub-${PUB}/1111111111`, interstitial: `ca-app-pub-${PUB}/2222222222`, rewarded: `ca-app-pub-${PUB}/3333333333` } },
  android: null,
};

function fakeAds(calls, { interstitialResult = 'shown', rewardResult = 'rewarded', failShow = false } = {}) {
  return {
    // Resolves a tick later, like the SDK: a caller that preloads without awaiting it is caught.
    initialize: async () => { calls.push('initialize'); await new Promise((resolve) => setTimeout(resolve, 0)); calls.push('initialized'); },
    preloadInterstitial: () => { calls.push('preloadInterstitial'); },
    preloadRewarded: () => { calls.push('preloadRewarded'); },
    rewardedStatus: () => 'ready',
    subscribeRewardedStatus: () => () => undefined,
    showInterstitial: async () => { calls.push('showInterstitial'); if (failShow) throw new Error('show failed'); return interstitialResult; },
    showRewarded: async () => { calls.push('showRewarded'); return rewardResult; },
    renderBanner: () => null,
  };
}

/** tracking: the ATT status; 'not-determined' shows the prompt (recorded) and answers `answer`. */
function fakeConsent(calls, afterRefresh, afterForm, { tracking = 'not-determined', answer = 'denied' } = {}) {
  let status = tracking;
  return {
    refresh: async () => { calls.push('refresh'); return afterRefresh; },
    showFormIfRequired: async () => { calls.push('showFormIfRequired'); return afterForm; },
    showPrivacyOptions: async () => { calls.push('showPrivacyOptions'); return afterForm; },
    requestTracking: async () => {
      if (status === 'not-determined') { calls.push('attPrompt'); status = answer; }
      return status;
    },
  };
}

const lifecycle = (calls) => ({ suspend: () => calls.push('suspend'), resume: () => calls.push('resume') });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** A promise that never settles would end the process silently: report it as a result instead. */
const settled = (promise, ms = 200) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('never settled'), ms))]);
const UNITS = { banner: `ca-app-pub-${PUB}/1111111111`, interstitial: `ca-app-pub-${PUB}/2222222222`, rewarded: `ca-app-pub-${PUB}/3333333333` };
const CONSENT_REQUIRED = { status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED', isConsentFormAvailable: true };
const CONSENT_CACHED = { status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED', isConsentFormAvailable: false };

/** A fresh adapter over a reset SDK stand-in; errors reported to onAdError are collected. */
function freshAdapter(adapterModule, units = UNITS) {
  sdkStub.reset();
  const errors = [];
  const port = adapterModule.createAdmobAdsAdapter({ units, onAdError: (error) => errors.push(`${error.phase}:${error.reason}`) });
  return { port, errors };
}
/** An adapter after initialize (ads load only after it), with the SDK trace cleared. */
async function readyAdapter(adapterModule, units = UNITS) {
  const fresh = freshAdapter(adapterModule, units);
  await fresh.port.initialize();
  sdkStub.reset();
  return fresh;
}
const lastAd = (kind) => sdkStub.ads().filter((ad) => ad.kind === kind).at(-1);

/** Preload, fire LOADED, show, fire the given events, and return the result plus the SDK trace. */
async function showWith(port, kind, events) {
  if (kind === 'interstitial') port.preloadInterstitial();
  else port.preloadRewarded();
  const ad = lastAd(kind);
  sdkStub.emit(ad, kind === 'interstitial' ? 'loaded' : 'rewarded_loaded');
  const pending = kind === 'interstitial' ? port.showInterstitial() : port.showRewarded();
  await tick();
  for (const [type, payload] of events) sdkStub.emit(ad, type, payload);
  const result = await settled(pending);
  return { result, destroyed: ad.destroyed };
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-ad-behaviour', json: options.json });
  let checked = 0;
  const mods = {};
  for (const [key, rel] of Object.entries(FILES)) {
    const loaded = await importRepoModule(root, rel);
    if (loaded.error) report.problem({ file: rel, rule: 'module-load', message: loaded.error, fix: 'Copy the module from the admob-ads templates; keep erasable TypeScript and explicit .ts imports.' });
    else mods[key] = loaded.module;
  }
  const expect = async (rule, file, label, actualFn, expected, fix) => {
    checked += 1;
    let actual;
    try {
      actual = await actualFn();
    } catch (error) {
      actual = `threw ${String(error?.message ?? error).split('\n')[0]}`;
    }
    if (!same(actual, expected)) report.problem({ file, rule, message: `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`, fix });
  };

  const { policy, history, perk, gate, moments, fullscreen, config, variant } = mods;
  if (policy && history) {
    const show = (req) => policy.shouldShowInterstitial({ config: CONFIG, context: READY, history: EMPTY, trigger: { outcome: 'win', nowMs: T0 }, ...req });
    const shownAtT0 = history.recordInterstitialShown({ nowMs: T0, outcome: 'win' });
    const twoWins = history.recordLevelEnd(history.recordLevelEnd(shownAtT0, 'win'), 'win');
    const fix = 'Restore shouldShowInterstitial from the template (spec 8.8); the numbers come from config.';
    const cases = [
      ['first interstitial after 3 completed levels', { context: { ...READY, levelsCompletedTotal: 3 } }, true],
      ['no interstitial before 3 completed levels', { context: { ...READY, levelsCompletedTotal: 2 } }, false],
      ['Premium blocks it', { context: { ...READY, isPremium: true } }, false],
      ['offline blocks it', { context: { ...READY, isOnline: false } }, false],
      ['missing consent blocks it', { context: { ...READY, canRequestAds: false } }, false],
      ['the tutorial blocks it', { context: { ...READY, isTutorialDone: false } }, false],
      ['the master switch blocks it', { config: { ...CONFIG, isAdsEnabled: false } }, false],
      ['179 999 ms after the last one', { history: twoWins, trigger: { outcome: 'win', nowMs: T0 + 179_999 } }, false],
      ['180 000 ms and 2 levels after the last one', { history: twoWins, trigger: { outcome: 'win', nowMs: T0 + 180_000 } }, true],
      ['only 1 level since the last one', { history: history.recordLevelEnd(shownAtT0, 'win'), trigger: { outcome: 'win', nowMs: T0 + 999_999 } }, false],
      ['the same millisecond as the last one', { history: twoWins, trigger: { outcome: 'win', nowMs: T0 } }, false],
      ['a second one in a row after losses', { history: { ...twoWins, didLastInterstitialFollowLoss: true }, trigger: { outcome: 'lose', nowMs: T0 + 999_999 } }, false],
      ['a win after a loss-triggered one', { history: { ...twoWins, didLastInterstitialFollowLoss: true }, trigger: { outcome: 'win', nowMs: T0 + 999_999 } }, true],
      ['a last-shown time in the future is ignored', { history: twoWins, trigger: { outcome: 'win', nowMs: T0 - 5 } }, true],
    ];
    for (const [label, req, want] of cases) await expect('interstitial-rules', FILES.policy, label, () => show(req), want, fix);
    const gentle = { ...CONFIG, minLevelsCompletedBeforeFirst: 5, minMsBetweenInterstitials: 60_000, minLevelsCompletedBetween: 1 };
    const oneWin = history.recordLevelEnd(shownAtT0, 'win');
    await expect('interstitial-rules', FILES.policy, 'config minLevelsCompletedBeforeFirst=5 with 4 levels', () => show({ config: gentle, context: { ...READY, levelsCompletedTotal: 4 } }), false, 'Read every number from AdPolicyConfig; never hard-code 3, 180000 or 2.');
    await expect('interstitial-rules', FILES.policy, 'config 60 000 ms / 1 level after the last one', () => show({ config: gentle, history: oneWin, trigger: { outcome: 'win', nowMs: T0 + 60_000 } }), true, 'Read every number from AdPolicyConfig; never hard-code 3, 180000 or 2.');

    const bannerFix = 'Restore shouldShowBanner: canServeAds && tutorial done && screen in BANNER_SCREENS.';
    for (const screen of ['home', 'levels', 'stats']) await expect('banner-rules', FILES.policy, `banner on ${screen}`, () => policy.shouldShowBanner(CONFIG, READY, screen), true, bannerFix);
    for (const screen of ['game', 'pause', 'result', 'premium', 'settings', 'tutorial']) await expect('banner-rules', FILES.policy, `banner on ${screen}`, () => policy.shouldShowBanner(CONFIG, READY, screen), false, bannerFix);
    for (const [label, change] of [['Premium', { isPremium: true }], ['offline', { isOnline: false }], ['no consent', { canRequestAds: false }], ['tutorial running', { isTutorialDone: false }]]) {
      await expect('banner-rules', FILES.policy, `banner while ${label}`, () => policy.shouldShowBanner(CONFIG, { ...READY, ...change }, 'home'), false, bannerFix);
    }
    await expect('banner-rules', FILES.policy, 'banner with the master switch off', () => policy.shouldShowBanner({ ...CONFIG, isAdsEnabled: false }, READY, 'home'), false, bannerFix);

    const historyFix = 'Restore ad-history.ts: wins count, losses do not, a shown interstitial resets the counters.';
    await expect('ad-history', FILES.history, 'a win adds one completed level', () => history.recordLevelEnd(history.EMPTY_AD_HISTORY, 'win').levelsCompletedSinceInterstitial, 1, historyFix);
    await expect('ad-history', FILES.history, 'a loss adds nothing', () => history.recordLevelEnd(history.EMPTY_AD_HISTORY, 'lose'), EMPTY, historyFix);
    await expect('ad-history', FILES.history, 'a shown interstitial after a loss', () => history.recordInterstitialShown({ nowMs: 7, outcome: 'lose' }), { lastInterstitialAtMs: 7, levelsCompletedSinceInterstitial: 0, didLastInterstitialFollowLoss: true }, historyFix);
  }

  if (perk) {
    const offer = (p, context, rewardedStatus) => perk.perkOffer(p, { config: CONFIG, context, rewardedStatus });
    const hint0 = { kind: 'hint', freeHintsLeft: 0 };
    const hint1 = { kind: 'hint', freeHintsLeft: 1 };
    const cont = { kind: 'continue', isAllowedByGame: true, isUsedThisLevel: false };
    const fix = "Restore perkOffer from the template (L11): hidden when unavailable, free for Premium or free hints, watch-ad when servable and the rewarded ad is ready, 'loading' for a continue whose ad is still loading (hints never), hidden otherwise.";
    const cases = [
      ['hint, no free hints, ad ready', hint0, READY, 'ready', 'watch-ad'],
      ['hint, no free hints, ad loading (hints never wait)', hint0, READY, 'loading', 'hidden'],
      ['hint, no free hints, nothing can come', hint0, READY, 'unavailable', 'hidden'],
      ['hint with a free hint left', hint1, READY, 'unavailable', 'free'],
      ['continue for Premium offline', cont, { ...READY, isPremium: true, isOnline: false }, 'unavailable', 'free'],
      ['continue, ad ready', cont, READY, 'ready', 'watch-ad'],
      ['continue, ad loading (shown in its loading state)', cont, READY, 'loading', 'loading'],
      ['continue, nothing can come (the run ends at once)', cont, READY, 'unavailable', 'hidden'],
      ['continue offline, ad ready', cont, { ...READY, isOnline: false }, 'ready', 'hidden'],
      ['continue offline, ad loading', cont, { ...READY, isOnline: false }, 'loading', 'hidden'],
      ['continue without consent, ad ready', cont, { ...READY, canRequestAds: false }, 'ready', 'hidden'],
      ['continue without consent, ad loading', cont, { ...READY, canRequestAds: false }, 'loading', 'hidden'],
      ['continue already used, even for Premium', { ...cont, isUsedThisLevel: true }, { ...READY, isPremium: true }, 'ready', 'hidden'],
      ['continue the game forbids', { ...cont, isAllowedByGame: false }, READY, 'loading', 'hidden'],
    ];
    for (const [label, p, context, status, want] of cases) await expect('perk-rules', FILES.perk, label, () => offer(p, context, status), want, fix);
  }

  if (gate) {
    const granted = { canRequestAds: true, isPrivacyOptionsRequired: true };
    const denied = { canRequestAds: false, isPrivacyOptionsRequired: true };
    const input = { isPremium: false, isAdsEnabled: true, isTutorialDone: true, isOnline: true };
    // afterRefresh denied: a player where Google's form is required and not yet answered; on iOS
    // with the ATT answer not yet given ('attPrompt' marks the system prompt).
    const trace = async (fn, { afterRefresh = denied, afterForm = granted, tracking = 'not-determined', answer = 'denied' } = {}) => {
      const calls = [];
      const seen = [];
      const showIntro = async () => { calls.push('intro'); };
      const deps = { ads: fakeAds(calls), consent: fakeConsent(calls, afterRefresh, afterForm, { tracking, answer }), onConsent: (info) => seen.push(info), showIntro };
      const result = await fn(deps);
      return { calls, result, seen: seen.length };
    };
    const fix = 'Restore ad-gate.ts: refresh, then (where the form is required) the S3 intro, then Google\'s form; then Apple\'s ATT prompt (consent.requestTracking) once ads may be requested; only after the tutorial, online and not Premium; initialize only when canRequestAds, whatever the ATT answer, and await it before any preload.';
    const ready = ['initialize', 'initialized', 'preloadInterstitial', 'preloadRewarded'];
    await expect('consent-order', FILES.gate, 'prepareAds with consent: intro, form, ATT, then initialize', () => trace((deps) => gate.prepareAds(deps, input)), { calls: ['refresh', 'intro', 'showFormIfRequired', 'attPrompt', ...ready], result: true, seen: 2 }, fix);
    await expect('consent-order', FILES.gate, 'prepareAds where consent is not required (no intro, no form, ATT still first)', () => trace((deps) => gate.prepareAds(deps, input), { afterRefresh: granted }), { calls: ['refresh', 'attPrompt', ...ready], result: true, seen: 1 }, fix);
    for (const [label, tracking] of [['ATT declined earlier', 'denied'], ['ATT restricted', 'restricted'], ['ATT unavailable', 'unavailable'], ['ATT authorized earlier', 'authorized']]) {
      await expect('consent-order', FILES.gate, `prepareAds with ${label}: ads still initialize, no prompt`, () => trace((deps) => gate.prepareAds(deps, input), { afterRefresh: granted, tracking }), { calls: ['refresh', ...ready], result: true, seen: 1 }, fix);
    }
    await expect('consent-order', FILES.gate, 'prepareAds when the player declines ATT now: ads still initialize', () => trace((deps) => gate.prepareAds(deps, input), { answer: 'denied' }), { calls: ['refresh', 'intro', 'showFormIfRequired', 'attPrompt', ...ready], result: true, seen: 2 }, fix);
    await expect('consent-order', FILES.gate, 'prepareAds when consent does not allow ads (no ATT)', () => trace((deps) => gate.prepareAds(deps, input), { afterForm: denied }), { calls: ['refresh', 'intro', 'showFormIfRequired'], result: false, seen: 2 }, fix);
    for (const [label, change] of [['during the tutorial', { isTutorialDone: false }], ['for Premium', { isPremium: true }], ['offline', { isOnline: false }], ['with ads disabled', { isAdsEnabled: false }]]) {
      await expect('consent-order', FILES.gate, `prepareAds ${label} (no form, no ATT)`, () => trace((deps) => gate.prepareAds(deps, { ...input, ...change })), { calls: [], result: false, seen: 0 }, fix);
    }
    await expect('consent-order', FILES.gate, 'refreshConsentAtLaunch shows no form and no ATT', () => trace((deps) => gate.refreshConsentAtLaunch(deps, { ...input, isTutorialDone: false })), { calls: ['refresh'], seen: 1 }, fix);
    await expect('consent-order', FILES.gate, 'refreshConsentAtLaunch for Premium', () => trace((deps) => gate.refreshConsentAtLaunch(deps, { ...input, isPremium: true })), { calls: [], seen: 0 }, fix);
  }

  const { flow } = mods;
  if (flow) {
    const granted = { canRequestAds: true, isPrivacyOptionsRequired: false };
    const input = { isPremium: false, isAdsEnabled: true, isTutorialDone: true, isOnline: true };
    const fix = 'Restore consent-moment-flow.ts: a held S3 parity frame asks neither Google nor Apple, and the ATT prompt waits until a banner screen is open (never over a level).';
    const run = async ({ isHeld, leaveFirst = false }) => {
      const calls = [];
      const moment = flow.createConsentMomentFlow({ ads: fakeAds(calls), consent: fakeConsent(calls, granted, granted), isHeld, savedCanRequestAds: null, onConsent: () => undefined, onError: (error) => calls.push(`error:${String(error?.message ?? error)}`) });
      moment.updateInput(input);
      const close = moment.requestAdMoment();
      if (leaveFirst) close();
      moment.refreshAtLaunch();
      await tick();
      await tick();
      return calls;
    };
    await expect('consent-moment-flow', FILES.flow, 'the held S3 parity frame asks neither Google nor Apple', () => run({ isHeld: true }), [], fix);
    await expect('consent-moment-flow', FILES.flow, 'no ATT prompt while no banner screen is open (the player left for a level)', () => run({ isHeld: false, leaveFirst: true }), ['refresh'], fix);
    await expect('consent-moment-flow', FILES.flow, 'facts that change while the gate decides are used (the tutorial ended as Home opened)', async () => {
      const calls = [];
      const denied = { canRequestAds: false, isPrivacyOptionsRequired: true };
      const moment = flow.createConsentMomentFlow({ ads: fakeAds(calls), consent: fakeConsent(calls, denied, granted), isHeld: false, savedCanRequestAds: null, onConsent: () => undefined, onError: () => undefined });
      moment.updateInput({ ...input, isTutorialDone: false });
      moment.requestAdMoment();
      moment.updateInput(input);
      await tick();
      await tick();
      return { calls, isIntroShown: moment.getSnapshot().isIntroShown };
    }, { calls: ['refresh'], isIntroShown: true }, 'Restore consent-moment-flow.ts: when prepareAds ends without asking and the gate\'s facts changed meanwhile, decide again with the new facts.');
  }

  if (moments && fullscreen && history) {
    const request = { config: CONFIG, context: READY, history: EMPTY, trigger: { outcome: 'lose', nowMs: 42 } };
    const run1 = async (script, req = request) => {
      const calls = [];
      const result = await moments.showInterstitialIfDue({ ads: fakeAds(calls, script), lifecycle: lifecycle(calls) }, req);
      return { calls, result };
    };
    const fix = 'Restore ad-moments.ts and fullscreen-ad.ts: suspend -> show -> resume (in finally) -> preload; record history only when shown.';
    await expect('fullscreen-lifecycle', FILES.moments, 'a due interstitial', () => run1({}), { calls: ['suspend', 'showInterstitial', 'resume', 'preloadInterstitial'], result: { lastInterstitialAtMs: 42, levelsCompletedSinceInterstitial: 0, didLastInterstitialFollowLoss: true } }, fix);
    await expect('fullscreen-lifecycle', FILES.moments, 'an unavailable interstitial keeps the history', () => run1({ interstitialResult: 'unavailable' }), { calls: ['suspend', 'showInterstitial', 'resume', 'preloadInterstitial'], result: EMPTY }, fix);
    await expect('fullscreen-lifecycle', FILES.moments, 'no interstitial when the policy says no', () => run1({}, { ...request, context: { ...READY, isPremium: true } }), { calls: [], result: EMPTY }, fix);
    for (const [rewardResult, want] of [['rewarded', true], ['dismissed', false], ['unavailable', false]]) {
      await expect('fullscreen-lifecycle', FILES.moments, `rewarded result "${rewardResult}"`, async () => {
        const calls = [];
        const granted = await moments.earnRewardedPerk({ ads: fakeAds(calls, { rewardResult }), lifecycle: lifecycle(calls) });
        return { calls, granted };
      }, { calls: ['suspend', 'showRewarded', 'resume', 'preloadRewarded'], granted: want }, fix);
    }
    await expect('fullscreen-lifecycle', FILES.fullscreen, 'the game resumes even when showing throws', async () => {
      const calls = [];
      await fullscreen.runFullscreenAd(lifecycle(calls), async () => { calls.push('show'); throw new Error('boom'); }).catch(() => calls.push('rejected'));
      return calls;
    }, ['suspend', 'show', 'resume', 'rejected'], fix);
  }

  if (config) {
    const fix = 'Restore ads-config.ts: sample app ID and no units unless live; live IDs validated; no userTrackingUsageDescription.';
    for (const mode of ['test', 'off']) {
      await expect('ads-config', FILES.config, `${mode}: sample app ID`, () => config.admobPluginOptions(mode, LIVE_IDS, ['cstr6suwn9.skadnetwork']).iosAppId, 'ca-app-pub-3940256099942544~1458002511', fix);
      await expect('ads-config', FILES.config, `${mode}: no unit IDs in expo.extra`, () => config.adUnitsExtra(mode, LIVE_IDS), null, fix);
    }
    await expect('ads-config', FILES.config, 'live: the game app ID', () => config.admobPluginOptions('live', LIVE_IDS, []).iosAppId, LIVE_IDS.ios.appId, fix);
    await expect('ads-config', FILES.config, 'live: the game unit IDs', () => config.adUnitsExtra('live', LIVE_IDS), LIVE_IDS.ios.units, fix);
    await expect('ads-config', FILES.config, 'plugin options keys', () => Object.keys(config.admobPluginOptions('test', LIVE_IDS, [])).sort(), ['androidAppId', 'delayAppMeasurementInit', 'iosAppId', 'skAdNetworkItems'], fix);
    await expect('ads-config', FILES.config, 'delayAppMeasurementInit', () => config.admobPluginOptions('live', LIVE_IDS, []).delayAppMeasurementInit, true, fix);
    const sample = { ...LIVE_IDS, ios: { ...LIVE_IDS.ios, appId: 'ca-app-pub-3940256099942544~1458002511' } };
    const malformed = { ...LIVE_IDS, ios: { ...LIVE_IDS.ios, units: { ...LIVE_IDS.ios.units, banner: 'x' } } };
    await expect('ads-config', FILES.config, 'live with the sample app ID throws', () => { try { config.admobPluginOptions('live', sample, []); return 'accepted'; } catch { return 'threw'; } }, 'threw', fix);
    await expect('ads-config', FILES.config, 'live with a malformed unit ID throws', () => { try { config.admobPluginOptions('live', malformed, []); return 'accepted'; } catch { return 'threw'; } }, 'threw', fix);
  }

  if (variant) {
    const fix = 'Restore resolveBuildVariant: test pairs with test/off, store with live/off, and the inlined variant must match.';
    const outcome = (env) => { try { return variant.resolveBuildVariant(env); } catch { return 'threw'; } };
    await expect('variant-matrix', FILES.variant, 'defaults', () => outcome({}), { appVariant: 'test', adsMode: 'test' }, fix);
    await expect('variant-matrix', FILES.variant, 'store defaults to live', () => outcome({ APP_VARIANT: 'store', EXPO_PUBLIC_APP_VARIANT: 'store' }), { appVariant: 'store', adsMode: 'live' }, fix);
    for (const [app, ads] of [['test', 'live'], ['store', 'test']]) {
      await expect('variant-matrix', FILES.variant, `APP_VARIANT=${app} with ADS_MODE=${ads}`, () => outcome({ APP_VARIANT: app, EXPO_PUBLIC_APP_VARIANT: app, ADS_MODE: ads }), 'threw', fix);
    }
    await expect('variant-matrix', FILES.variant, 'mismatched inlined variant', () => outcome({ APP_VARIANT: 'store' }), 'threw', fix);
  }
  const { adapter, factory, extra, consentAdapter, consentFactory } = mods;
  if (adapter) {
    const file = FILES.adapter;
    const initFix = 'Restore the template adapter: nothing touches the SDK until initialize(); initialize() sets maxAdContentRating PG, then initializes, once.';
    await expect('adapter-init', file, 'creating the adapter touches the SDK', () => { freshAdapter(adapter); return sdkStub.calls(); }, [], initFix);
    await expect('adapter-init', file, 'initialize() twice', async () => {
      const { port } = freshAdapter(adapter);
      await port.initialize();
      await port.initialize();
      return sdkStub.calls();
    }, ['setRequestConfiguration:{"maxAdContentRating":"PG"}', 'initialize'], initFix);
    await expect('adapter-init', file, 'ADMOB_TEST_UNITS', () => adapter.ADMOB_TEST_UNITS, { banner: TestIds.ADAPTIVE_BANNER, interstitial: TestIds.INTERSTITIAL, rewarded: TestIds.REWARDED }, 'Read TestIds.ADAPTIVE_BANNER, TestIds.INTERSTITIAL and TestIds.REWARDED; never type test IDs.');

    const fsFix = 'Restore showInterstitial from the template: unavailable unless loaded; settle on CLOSED, on ERROR (a failed presentation sends no CLOSED) and on a rejected show(); destroy the ad.';
    await expect('adapter-interstitial', file, 'show before anything loaded', async () => {
      const { port } = await readyAdapter(adapter);
      port.preloadInterstitial();
      return { result: await settled(port.showInterstitial()), shows: sdkStub.calls().filter((c) => c.endsWith('.show')).length };
    }, { result: 'unavailable', shows: 0 }, fsFix);
    await expect('adapter-interstitial', file, 'preload uses the interstitial unit, once', async () => {
      const { port } = await readyAdapter(adapter);
      port.preloadInterstitial();
      port.preloadInterstitial();
      return sdkStub.calls();
    }, [`interstitial.create:${UNITS.interstitial}`, `interstitial.load:${UNITS.interstitial}`], fsFix);
    await expect('adapter-interstitial', file, 'shown, then closed', async () => showWith((await readyAdapter(adapter)).port, 'interstitial', [['closed']]), { result: 'shown', destroyed: true }, fsFix);
    await expect('adapter-interstitial', file, 'presentation fails (ERROR phase show, no CLOSED)', async () => {
      const { port, errors } = await readyAdapter(adapter);
      const outcome = await showWith(port, 'interstitial', [['error', { phase: 'show', reason: 'internal-error' }]]);
      return { ...outcome, errors };
    }, { result: 'unavailable', destroyed: true, errors: ['show:internal-error'] }, fsFix);
    await expect('adapter-interstitial', file, 'load-phase no-fill is silent and frees the slot', async () => {
      const { port, errors } = await readyAdapter(adapter);
      port.preloadInterstitial();
      sdkStub.emit(lastAd('interstitial'), 'error', { phase: 'load', reason: 'no-fill' });
      port.preloadInterstitial();
      return { errors, created: sdkStub.ads().length };
    }, { errors: [], created: 2 }, 'Only log load errors that are not no-fill; destroy the failed ad and clear its slot so the next quiet moment preloads again.');

    const rwFix = 'Restore showRewarded from the template: grant only after EARNED_REWARD; CLOSED alone is "dismissed"; ERROR or a rejected show() is "unavailable".';
    await expect('adapter-rewarded', file, 'closed without EARNED_REWARD', async () => showWith((await readyAdapter(adapter)).port, 'rewarded', [['closed']]), { result: 'dismissed', destroyed: true }, rwFix);
    await expect('adapter-rewarded', file, 'EARNED_REWARD, then closed', async () => showWith((await readyAdapter(adapter)).port, 'rewarded', [['rewarded_earned_reward', { type: 'perk', amount: 1 }], ['closed']]), { result: 'rewarded', destroyed: true }, rwFix);
    await expect('adapter-rewarded', file, 'presentation fails (ERROR phase show, no CLOSED)', async () => showWith((await readyAdapter(adapter)).port, 'rewarded', [['error', { phase: 'show', reason: 'internal-error' }]]), { result: 'unavailable', destroyed: true }, rwFix);
    const statusFix = "Restore the template's rewarded status (L11): 'unavailable' before initialize (a preload then starts nothing), 'loading' from a preload until LOADED, 'ready' after LOADED, 'unavailable' once the ad is shown or after a load error until the next preload; tell subscribeRewardedStatus listeners each change.";
    await expect('adapter-rewarded-status', file, 'before initialize a preload starts nothing', async () => {
      const { port } = freshAdapter(adapter);
      port.preloadRewarded();
      return { status: port.rewardedStatus(), sdk: sdkStub.calls() };
    }, { status: 'unavailable', sdk: [] }, statusFix);
    await expect('adapter-rewarded-status', file, 'loading, ready, then unavailable once shown', async () => {
      const { port } = await readyAdapter(adapter);
      const seen = [];
      port.subscribeRewardedStatus(() => seen.push(port.rewardedStatus()));
      port.preloadRewarded();
      sdkStub.emit(lastAd('rewarded'), 'rewarded_loaded');
      const pending = port.showRewarded();
      await tick();
      sdkStub.emit(lastAd('rewarded'), 'closed');
      await settled(pending);
      return { seen, create: sdkStub.calls()[0] };
    }, { seen: ['loading', 'ready', 'unavailable'], create: `rewarded.create:${UNITS.rewarded}` }, statusFix);
    await expect('adapter-rewarded-status', file, 'a load error until the next preload', async () => {
      const { port } = await readyAdapter(adapter);
      port.preloadRewarded();
      sdkStub.emit(lastAd('rewarded'), 'error', { phase: 'load', reason: 'no-fill' });
      const afterError = port.rewardedStatus();
      port.preloadRewarded();
      return { afterError, again: port.rewardedStatus() };
    }, { afterError: 'unavailable', again: 'loading' }, statusFix);

    await expect('adapter-banner', file, 'renderBanner element', () => {
      const { port } = freshAdapter(adapter);
      const onLoaded = () => undefined;
      const onFailed = () => undefined;
      const element = port.renderBanner({ onLoaded, onFailed });
      const props = element?.props ?? {};
      return { type: element?.type?.name, unitId: props.unitId, size: props.size, loaded: props.onAdLoaded === onLoaded, failed: props.onAdFailedToLoad === onFailed };
    }, { type: 'BannerAd', unitId: UNITS.banner, size: 'LARGE_ANCHORED_ADAPTIVE_BANNER', loaded: true, failed: true }, 'renderBanner returns createElement(BannerAd, { unitId: units.banner, size: BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER, onAdLoaded, onAdFailedToLoad }).');
  }

  if (factory) {
    const file = FILES.factory;
    const fix = 'Restore createAdsPort: off -> the fake (nothing is ever requested), test -> ADMOB_TEST_UNITS, live -> extra.adUnits (throw when missing).';
    await expect('ads-factory', file, 'ADS_MODE=off requests nothing and shows nothing', async () => {
      sdkStub.reset();
      const port = factory.createAdsPort({ adsMode: 'off', adUnits: UNITS }, () => undefined);
      await port.initialize();
      port.preloadInterstitial();
      port.preloadRewarded();
      return { interstitial: await settled(port.showInterstitial()), rewarded: await settled(port.showRewarded()), status: port.rewardedStatus(), sdk: sdkStub.calls() };
    }, { interstitial: 'unavailable', rewarded: 'unavailable', status: 'unavailable', sdk: [] }, fix);
    await expect('ads-factory', file, 'ADS_MODE=test uses Google test units', async () => {
      const port = factory.createAdsPort({ adsMode: 'test', adUnits: null }, () => undefined);
      await port.initialize();
      sdkStub.reset();
      port.preloadInterstitial();
      return sdkStub.calls()[0];
    }, `interstitial.create:${TestIds.INTERSTITIAL}`, fix);
    await expect('ads-factory', file, 'ADS_MODE=live uses the game units', async () => {
      const port = factory.createAdsPort({ adsMode: 'live', adUnits: UNITS }, () => undefined);
      await port.initialize();
      sdkStub.reset();
      port.preloadRewarded();
      return sdkStub.calls()[0];
    }, `rewarded.create:${UNITS.rewarded}`, fix);
    await expect('ads-factory', file, 'ADS_MODE=live without units', () => { try { factory.createAdsPort({ adsMode: 'live', adUnits: null }, () => undefined); return 'accepted'; } catch { return 'threw'; } }, 'threw', fix);
  }

  if (extra) {
    const file = FILES.extra;
    const fix = "Restore readAdsExtra: anything unexpected falls back to 'off' and adUnits null; units only when all three are strings.";
    const cases = [
      ['live with units', { adsMode: 'live', adUnits: UNITS }, { adsMode: 'live', adUnits: UNITS }],
      ['test without units', { adsMode: 'test' }, { adsMode: 'test', adUnits: null }],
      ['an unknown mode', { adsMode: 'LIVE', adUnits: UNITS }, { adsMode: 'off', adUnits: UNITS }],
      ['no extra at all', null, { adsMode: 'off', adUnits: null }],
      ['incomplete units', { adsMode: 'live', adUnits: { banner: UNITS.banner } }, { adsMode: 'live', adUnits: null }],
    ];
    for (const [label, input, want] of cases) await expect('read-ads-extra', file, label, () => extra.readAdsExtra(input), want, fix);
    await expect('read-ads-extra', file, 'reads Constants.expoConfig.extra by default', () => {
      constantsStub.extra = { adsMode: 'test' };
      return extra.readAdsExtra();
    }, { adsMode: 'test', adUnits: null }, 'Default the argument to Constants.expoConfig?.extra (embedded at build time).');
  }

  if (consentAdapter) {
    const file = FILES.consentAdapter;
    const fix = "Restore admob-consent-adapter.ts: map privacyOptionsRequirementStatus REQUIRED to the privacy row, fall back to getConsentInfo() when a call fails, pass debugGeography only when set.";
    const refresh = async (answers, options = {}) => {
      sdkStub.reset(answers);
      const errors = [];
      const info = await settled(consentAdapter.createAdmobConsentAdapter({ ...options, onError: (error) => errors.push(String(error?.message ?? error)) }).refresh());
      return { info, errors, sdk: sdkStub.calls() };
    };
    await expect('consent-adapter', file, 'refresh where consent is required', () => refresh({ requestInfoUpdate: CONSENT_REQUIRED }), { info: { canRequestAds: false, isPrivacyOptionsRequired: true }, errors: [], sdk: ['AdsConsent.requestInfoUpdate:{}'] }, fix);
    await expect('consent-adapter', file, 'refresh offline falls back to the cached answer', () => refresh({ requestInfoUpdate: new Error('offline'), getConsentInfo: CONSENT_CACHED }), { info: { canRequestAds: true, isPrivacyOptionsRequired: false }, errors: ['offline'], sdk: ['AdsConsent.requestInfoUpdate:{}', 'AdsConsent.getConsentInfo'] }, fix);
    await expect('consent-adapter', file, 'debug geography EEA', async () => (await refresh({ requestInfoUpdate: CONSENT_REQUIRED }, { debugGeography: 'eea' })).sdk, ['AdsConsent.requestInfoUpdate:{"debugGeography":1}'], fix);
    await expect('consent-adapter', file, 'the form never resets consent', async () => {
      sdkStub.reset({ loadAndShowConsentFormIfRequired: CONSENT_CACHED });
      await settled(consentAdapter.createAdmobConsentAdapter({ onError: () => undefined }).showFormIfRequired());
      return sdkStub.calls();
    }, ['AdsConsent.loadAndShowConsentFormIfRequired'], fix);
  }

  if (consentAdapter) {
    const file = FILES.consentAdapter;
    const fix = 'Restore requestTracking in admob-consent-adapter.ts: off iOS \'unavailable\' without touching the module; read the status first and ask (requestTrackingPermissionsAsync) only while it is undetermined and the app is active; map granted to authorized and denied (Expo also reports restricted so) to denied; a failure is logged and answers \'unavailable\', never a rejection.';
    const ask = async ({ status = 'undetermined', answer = 'denied', fail = false, os = 'ios', appState = 'active', becomeActive = false } = {}) => {
      trackingStub.reset({ status, answer, fail });
      reactNativeStub.reset({ os, appState });
      const errors = [];
      const pending = consentAdapter.createAdmobConsentAdapter({ onError: (error) => errors.push(String(error?.message ?? error)) }).requestTracking();
      await tick();
      const beforeActive = trackingStub.calls();
      if (becomeActive) reactNativeStub.setAppState('active');
      const result = await settled(pending);
      return { result, errors, beforeActive, calls: trackingStub.calls() };
    };
    await expect('tracking-adapter', file, 'not-determined: the system prompt, once, then the answer', () => ask(), { result: 'denied', errors: [], beforeActive: ['getTrackingPermissionsAsync', 'requestTrackingPermissionsAsync'], calls: ['getTrackingPermissionsAsync', 'requestTrackingPermissionsAsync'] }, fix);
    await expect('tracking-adapter', file, 'an accepted prompt gives authorized', async () => (await ask({ answer: 'granted' })).result, 'authorized', fix);
    await expect('tracking-adapter', file, 'answered before: no prompt', () => ask({ status: 'denied' }), { result: 'denied', errors: [], beforeActive: ['getTrackingPermissionsAsync'], calls: ['getTrackingPermissionsAsync'] }, fix);
    await expect('tracking-adapter', file, 'in the background: waits for the app to be active', () => ask({ appState: 'background', becomeActive: true }), { result: 'denied', errors: [], beforeActive: ['getTrackingPermissionsAsync'], calls: ['getTrackingPermissionsAsync', 'requestTrackingPermissionsAsync'] }, fix);
    await expect('tracking-adapter', file, 'a failing read resolves unavailable and is logged', () => ask({ fail: true }), { result: 'unavailable', errors: ['tracking module unavailable'], beforeActive: ['getTrackingPermissionsAsync'], calls: ['getTrackingPermissionsAsync'] }, fix);
    await expect('tracking-adapter', file, 'off iOS: unavailable, the module untouched', () => ask({ os: 'android' }), { result: 'unavailable', errors: [], beforeActive: [], calls: [] }, fix);
  }

  if (consentFactory) {
    const file = FILES.consentFactory;
    const fix = 'Restore consent-factory.ts: ADS_MODE=off returns a consent port that never calls the SDK (canRequestAds false, no privacy row); test and live return the AdMob consent adapter with the options passed through.';
    const none = { canRequestAds: false, isPrivacyOptionsRequired: false };
    await expect('consent-factory', file, 'ADS_MODE=off never asks Google UMP (a network request)', async () => {
      sdkStub.reset({ requestInfoUpdate: CONSENT_CACHED, loadAndShowConsentFormIfRequired: CONSENT_CACHED, showPrivacyOptionsForm: CONSENT_CACHED });
      const consent = consentFactory.createConsentPort('off', { onError: () => undefined });
      const infos = [await settled(consent.refresh()), await settled(consent.showFormIfRequired()), await settled(consent.showPrivacyOptions())];
      return { infos, sdk: sdkStub.calls() };
    }, { infos: [none, none, none], sdk: [] }, fix);
    await expect('consent-factory', file, 'ADS_MODE=off never shows Apple\'s tracking prompt (every E2E build)', async () => {
      trackingStub.reset({ status: 'undetermined' });
      reactNativeStub.reset();
      const status = await settled(consentFactory.createConsentPort('off', { onError: () => undefined }).requestTracking());
      return { status, tracking: trackingStub.calls() };
    }, { status: 'unavailable', tracking: [] }, 'Restore consent-factory.ts: the ADS_MODE=off port answers requestTracking with \'unavailable\' and never calls expo-tracking-transparency.');
    await expect('consent-factory', file, 'ADS_MODE=test uses the AdMob consent adapter', async () => {
      sdkStub.reset({ requestInfoUpdate: CONSENT_CACHED });
      const info = await settled(consentFactory.createConsentPort('test', { debugGeography: 'eea', onError: () => undefined }).refresh());
      return { info, sdk: sdkStub.calls() };
    }, { info: { canRequestAds: true, isPrivacyOptionsRequired: false }, sdk: ['AdsConsent.requestInfoUpdate:{"debugGeography":1}'] }, fix);
    await expect('consent-factory', file, 'ADS_MODE=live uses the AdMob consent adapter', async () => {
      sdkStub.reset({ requestInfoUpdate: CONSENT_REQUIRED });
      const info = await settled(consentFactory.createConsentPort('live', { onError: () => undefined }).refresh());
      return { info, sdk: sdkStub.calls() };
    }, { info: { canRequestAds: false, isPrivacyOptionsRequired: true }, sdk: ['AdsConsent.requestInfoUpdate:{}'] }, fix);
  }
  return report.finish({ checked, unit: 'scenarios' });
});
