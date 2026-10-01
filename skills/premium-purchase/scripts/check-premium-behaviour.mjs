#!/usr/bin/env node
// check-premium-behaviour.mjs: runs the repo's own Premium modules (reducer, view, notice, evidence,
// service, store flow, price formatter) through Node's type stripping against the S12 state table
// and the StoreKit rules (persist before finish, listen first, restore, revocation evidence, the
// connectivity gate), and runs
// the expo-iap adapter against a scripted expo-iap stand-in (lib/stubs/expo-iap.mjs). It also reads
// the composition root (packages/shell/src/app/) for the two reloads the store needs after startup.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-premium-behaviour.mjs [repo-root]

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, maskComments, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { importRepoModule, setModuleStubs } from './lib/load-ts.mjs';
import { iapStub } from './lib/stubs/expo-iap.mjs';

setModuleStubs({ 'expo-iap': join(dirname(fileURLToPath(import.meta.url)), 'lib', 'stubs', 'expo-iap.mjs') });

const SPEC = {
  name: 'check-premium-behaviour',
  summary: "Loads the repo's Premium modules (Node type stripping) and checks every S12 state, the restore toasts, the entitlement-evidence rule, the service order (subscribe first; persist -> grant -> finish), restore and revocation, the store going unavailable offline, and the store price formatting.",
  usage: '[options] [repo-root]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: 'Rules: module-load, s12-states, restore-notices, evidence, service-order, restore-flow, revocation, store-flow, price-format,\n  adapter-errors, adapter-restore, adapter-transactions, adapter-calls, offline-gate, result-nudge, store-reloads.\nstore-reloads: the composition root (packages/shell/src/app/, not tests) must call shouldReloadStore on a\n  connectivity change (then recheckPremium once online) and recheckPremium when the app comes back to the\n  foreground (startPremium runs before the first network state, so without them the price never loads and\n  a refund is never revoked after an offline start).\nexpo-iap is replaced by the scripted stand-in lib/stubs/expo-iap.mjs.\nNeeds Node 22.18+ (type stripping).',
};

const STORES = 'packages/shell/src/stores/premium';
const PURCHASE = 'packages/shell/src/services/purchase';
const FILES = {
  reducer: `${STORES}/premium-reducer.ts`,
  state: `${STORES}/premium-state.ts`,
  view: `${STORES}/premium-view.ts`,
  notice: `${STORES}/premium-notice.ts`,
  evidence: `${STORES}/entitlement-evidence.ts`,
  service: `${PURCHASE}/premium-service.ts`,
  flow: `${PURCHASE}/premium-store-flow.ts`,
  price: `${PURCHASE}/format-store-price.ts`,
  adapter: `${PURCHASE}/expo-iap-purchase-adapter.ts`,
  gate: `${PURCHASE}/connectivity-gated-purchase.ts`,
  nudge: `${STORES}/premium-nudge.ts`,
};

const ID = 'io.applander.demogame.premium';
const PRODUCT = { productId: ID, displayPrice: '€1.99', price: 1.9899999999999998, currency: 'EUR' };
const tx = (overrides = {}) => ({ productId: ID, transactionId: 't1', state: 'purchased', revocationDateMs: null, handle: null, ...overrides });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A scripted PurchasePort plus deps that log every call in order. */
function harness({ isConnected = true, product = PRODUCT, restoreResult = 'synced', transactions = [], connectThrows = false, readThrows = false, finishThrows = false } = {}) {
  const log = [];
  const listeners = new Set();
  const port = {
    connect: async () => { log.push('connect'); if (connectThrows) throw new Error('offline'); return isConnected; },
    fetchProduct: async () => { log.push('fetchProduct'); return product; },
    requestPurchase: async () => { log.push('requestPurchase'); },
    finish: async (t) => { log.push(`finish:${t.transactionId}`); if (finishThrows) throw new Error('finish failed'); },
    restore: async () => { log.push('restore'); return restoreResult; },
    readTransactions: async () => { log.push('readTransactions'); if (readThrows) throw new Error('read failed'); return transactions; },
    subscribe: (listener) => { log.push('subscribe'); listeners.add(listener); return () => listeners.delete(listener); },
  };
  const deps = {
    port,
    productId: ID,
    dispatch: (action) => log.push(`dispatch:${action.type}${action.evidence ? `:${action.evidence}` : ''}${action.failure ? `:${action.failure}` : ''}`),
    persistPremium: (change) => log.push(change.isPremium ? 'persist:true' : `persist:false@${change.revokedAtMs}`),
    formatPrice: (p) => p.displayPrice,
    onError: () => log.push('onError'),
  };
  const emit = (event) => listeners.forEach((listener) => listener(event));
  return { log, deps, emit };
}

const APP_DIR = 'packages/shell/src/app';
const RELOADS = [
  { call: 'shouldReloadStore', message: 'no composition-root file reloads the store on a connectivity change (shouldReloadStore)', fix: 'Copy game-host-integration\'s app/connect-premium-reloads.ts and call connectPremiumReloads(connectivity, stores, premiumDeps) right after startPremium: connectivity.subscribe -> shouldReloadStore -> loadStore.' },
  { call: 'recheckPremium', message: 'no composition-root file re-checks Premium when the app comes back to the foreground (recheckPremium)', fix: "In connectPremiumReloads: AppState 'change' to 'active' while online -> recheckPremium(premiumDeps) (a refund or an Ask to Buy approval arrives while the app is away)." },
];

/** S-G34: startPremium runs before the first network state, so the root must reload the store later. */
function checkStoreReloads(root, report) {
  const dir = join(root, APP_DIR);
  const sources = existsSync(dir) ? walk(dir, { include: ['*.ts', '*.tsx'] }).filter((rel) => !/\.test\.tsx?$/.test(rel)).map((rel) => maskComments(readFileSync(join(dir, rel), 'utf8'))) : [];
  for (const need of RELOADS) {
    if (!sources.some((text) => new RegExp(`\\b${need.call}\\s*\\(`).test(text))) report.problem({ file: APP_DIR, rule: 'store-reloads', message: need.message, fix: need.fix });
  }
  // The launch re-check runs offline (absence is not evidence): the connectivity subscription that
  // reloads the store must also re-check Premium once online, or a refund waits for a foreground.
  const reloader = sources.find((text) => /\bshouldReloadStore\s*\(/.test(text)) ?? '';
  const subscribeAt = reloader.search(/\.subscribe\s*\(/);
  const subscription = subscribeAt < 0 ? '' : reloader.slice(subscribeAt, reloader.indexOf('\n  });', subscribeAt) + 1);
  if (reloader !== '' && !/\brecheckPremium\s*\(/.test(subscription)) {
    report.problem({ file: APP_DIR, rule: 'store-reloads', message: 'the connectivity subscription reloads the store but never re-checks Premium once online (a refund stays unrevoked after an offline launch)', fix: 'In connectPremiumReloads: after loadStore on an online change, run recheckPremium(premiumDeps) (StoreKit harness flow 02, 2026-09-30).' });
  }
  return RELOADS.length + 1;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  requireDir(join(root, 'packages', 'shell', 'src'), 'Shell source folder (packages/shell/src)');
  const report = createReporter({ name: 'check-premium-behaviour', json: options.json });
  const mods = {};
  for (const [key, rel] of Object.entries(FILES)) {
    const loaded = await importRepoModule(root, rel);
    if (loaded.error) report.problem({ file: rel, rule: 'module-load', message: loaded.error, fix: 'Copy the module from the premium-purchase templates; keep erasable TypeScript and explicit .ts imports.' });
    else mods[key] = loaded.module;
  }
  let checked = 0;
  const expect = async (rule, file, label, fn, expected, fix) => {
    checked += 1;
    let actual;
    try {
      actual = await fn();
    } catch (error) {
      actual = `threw ${String(error?.message ?? error).split('\n')[0]}`;
    }
    if (!same(actual, expected)) report.problem({ file, rule, message: `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`, fix });
  };
  const { reducer, state, view, notice, evidence, service, flow, price, adapter, gate, nudge } = mods;

  if (reducer && state && view) {
    const run1 = (actions, isPremium = false) => actions.reduce(reducer.premiumReducer, state.initialPremiumState(isPremium));
    const viewOf = (actions, isPremium) => view.premiumView(run1(actions, isPremium));
    const READY = [{ type: 'price-loaded', price: '€1.99' }];
    const BUYING = [...READY, { type: 'buy-tapped' }];
    const fail = (failure) => ({ type: 'purchase-failed', failure });
    const restoreWith = (e) => [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: e }];
    const fix = 'Restore the reducer, transitions and view from the templates; every S12 state must stay reachable exactly as in the table.';
    const cases = [
      ['Loading price', [], 'loading-price'],
      ['Store unavailable', [{ type: 'store-unavailable' }], 'store-unavailable'],
      ['normal page', READY, 'ready'],
      ['Purchase in progress', BUYING, 'purchase-in-progress'],
      ['Pending (deferred failure)', [...BUYING, fail('deferred')], 'pending'],
      ['Pending (pending transaction)', [...BUYING, { type: 'purchase-pending' }], 'pending'],
      ['Success', [...BUYING, { type: 'premium-granted' }], 'success'],
      ['Success after an approved Ask to Buy', [...BUYING, { type: 'purchase-pending' }, { type: 'premium-granted' }], 'success'],
      ['Cancelled by player', [...BUYING, fail('cancelled')], 'ready'],
      ['Error', [...BUYING, fail('failed')], 'error'],
      ['offline during the purchase', [...BUYING, fail('unavailable')], 'store-unavailable'],
      ['already owned runs restore', [...BUYING, fail('already-owned')], 'restoring'],
      ['Already owned after the thank-you', [...BUYING, { type: 'premium-granted' }, { type: 'thanks-shown' }], 'already-owned'],
      ['a purchase delivered at launch shows no thank-you', [{ type: 'premium-granted' }], 'already-owned'],
      ['nothing to restore after a successful sync', restoreWith('unknown'), 'restore-empty'],
      ['restore failed', restoreWith('sync-failed'), 'restore-failed'],
      ['restored', restoreWith('owned'), 'already-owned'],
      ['a duplicated failure is ignored', [...BUYING, fail('deferred'), fail('failed')], 'pending'],
      ['BUY is ignored while the store is unavailable', [{ type: 'store-unavailable' }, { type: 'buy-tapped' }], 'store-unavailable'],
      ['a late price after "unavailable" is ignored', [{ type: 'store-unavailable' }, { type: 'price-loaded', price: '€1.99' }], 'store-unavailable'],
      ['connect-started returns to loading', [...READY, { type: 'connect-started' }], 'loading-price'],
      ['a restore after a purchase shows "owned", not the thank-you', [...BUYING, { type: 'premium-granted' }, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'owned' }], 'already-owned'],
      ['the debug switch turns Premium on without a purchase', [...READY, { type: 'debug-premium-set', isPremium: true }], 'already-owned'],
      ['the debug switch turns Premium off', [...BUYING, { type: 'premium-granted' }, { type: 'debug-premium-set', isPremium: false }], 'ready'],
    ];
    for (const [label, actions, want] of cases) await expect('s12-states', FILES.reducer, label, () => viewOf(actions), want, fix);
    await expect('s12-states', FILES.reducer, 'BUY is ignored when already Premium', () => run1([...READY, { type: 'buy-tapped' }], true).flow.kind, 'ready', fix);
    await expect('s12-states', FILES.reducer, 'no evidence keeps Premium', () => run1([{ type: 'entitlements-checked', evidence: 'unknown' }], true).isPremium, true, 'Only explicit revocation evidence may turn Premium off.');
    await expect('s12-states', FILES.reducer, 'revocation evidence revokes', () => run1([{ type: 'entitlements-checked', evidence: 'revoked' }], true).isPremium, false, fix);
    await expect('s12-states', FILES.reducer, 'owned evidence grants', () => run1([{ type: 'entitlements-checked', evidence: 'owned' }]).isPremium, true, fix);
    await expect('s12-states', FILES.reducer, '"nothing to restore" never shows for an owner', () => viewOf(restoreWith('unknown'), true), 'already-owned', fix);

    if (notice) {
      const nfix = 'Restore premium-notice.ts: restoring / restore-empty / restore-failed from the flow, restore-success once from didJustRestore.';
      await expect('restore-notices', FILES.notice, 'normal page', () => notice.premiumNotice(run1(READY)), null, nfix);
      await expect('restore-notices', FILES.notice, 'while restoring', () => notice.premiumNotice(run1([...READY, { type: 'restore-tapped' }])), 'restoring', nfix);
      for (const [e, want] of [['unknown', 'restore-empty'], ['sync-failed', 'restore-failed'], ['owned', 'restore-success']]) {
        await expect('restore-notices', FILES.notice, `restore finished with ${e}`, () => notice.premiumNotice(run1(restoreWith(e))), want, nfix);
      }
      await expect('restore-notices', FILES.notice, 'the restored toast shows once', () => notice.premiumNotice(run1([...restoreWith('owned'), { type: 'restore-notice-shown' }])), null, nfix);
    }
  }

  if (evidence) {
    const fix = 'Restore entitlement-evidence.ts: owned beats revoked, absence is "unknown", other products are ignored.';
    const cases = [
      ['no transactions', [], 'unknown'],
      ['a purchase', [tx()], 'owned'],
      ['a pending purchase only', [tx({ state: 'pending' })], 'unknown'],
      ['a refunded purchase', [tx({ revocationDateMs: 1_700_000_000_000 })], 'revoked'],
      ['a newer purchase after a refund', [tx({ revocationDateMs: 1_700_000_000_000 }), tx({ transactionId: 't2' })], 'owned'],
      ['another product', [tx({ productId: 'io.applander.other.premium' })], 'unknown'],
    ];
    for (const [label, list, want] of cases) await expect('evidence', FILES.evidence, label, () => evidence.entitlementEvidence(list, ID), want, fix);
    await expect('evidence', FILES.evidence, 'latest revocation date', () => evidence.latestRevocationMs([tx({ revocationDateMs: 5 }), tx({ transactionId: 't2', revocationDateMs: 9 })], ID), 9, fix);
  }

  if (service && flow) {
    const sfix = 'Restore premium-service.ts / premium-store-flow.ts from the templates.';
    await expect('store-flow', FILES.flow, 'startPremium subscribes before connecting, then re-checks', async () => {
      const h = harness();
      await flow.startPremium(h.deps);
      return h.log.filter((entry) => !entry.startsWith('dispatch'));
    }, ['subscribe', 'connect', 'fetchProduct', 'readTransactions'], 'Subscribe first: StoreKit replays unfinished and approved transactions right after connecting.');
    for (const [label, script] of [['an empty product list', { product: null }], ['no connection', { isConnected: false }], ['a connection error', { connectThrows: true }]]) {
      await expect('store-flow', FILES.flow, `${label} -> store unavailable`, async () => {
        const h = harness(script);
        await flow.loadStore(h.deps);
        return h.log.filter((entry) => entry.startsWith('dispatch'));
      }, ['dispatch:connect-started', 'dispatch:store-unavailable'], 'An empty product list or a failed connect is "store unavailable", never an error dialog.');
    }
    await expect('service-order', FILES.service, 'a purchase: persist -> grant -> finish', async () => {
      const h = harness();
      await flow.startPremium(h.deps);
      await flow.buyPremium(h.deps);
      h.emit({ type: 'transaction', transaction: tx() });
      await flush();
      return h.log.slice(h.log.indexOf('requestPurchase'));
    }, ['requestPurchase', 'persist:true', 'dispatch:premium-granted', 'finish:t1'], 'Save Premium (sync) -> dispatch premium-granted -> finishTransaction; never finish first.');
    await expect('service-order', FILES.service, 'a pending transaction is not finished', async () => {
      const h = harness();
      await service.processTransaction(h.deps, tx({ state: 'pending' }));
      return h.log;
    }, ['dispatch:purchase-pending'], sfix);
    await expect('service-order', FILES.service, 'another product is ignored', async () => {
      const h = harness();
      await service.processTransaction(h.deps, tx({ productId: 'io.applander.other.premium' }));
      return h.log;
    }, [], sfix);
    await expect('service-order', FILES.service, 'a failing finish is logged, Premium stays', async () => {
      const h = harness({ finishThrows: true });
      await service.processTransaction(h.deps, tx());
      return h.log;
    }, ['persist:true', 'dispatch:premium-granted', 'finish:t1', 'onError'], 'Unfinished transactions are re-delivered at the next launch; log the error and move on.');
    await expect('restore-flow', FILES.service, 'a failed sync is "couldn\'t restore"', async () => {
      const h = harness({ restoreResult: 'sync-failed' });
      await service.restorePremium(h.deps);
      return h.log;
    }, ['dispatch:restore-tapped', 'restore', 'dispatch:restore-finished:sync-failed'], 'Never read transactions or say "nothing to restore" after a failed sync.');
    await expect('restore-flow', FILES.service, 'a successful sync with nothing', async () => {
      const h = harness();
      await service.restorePremium(h.deps);
      return h.log;
    }, ['dispatch:restore-tapped', 'restore', 'readTransactions', 'dispatch:restore-finished:unknown'], sfix);
    await expect('restore-flow', FILES.service, 'a successful sync with a purchase', async () => {
      const h = harness({ transactions: [tx()] });
      await service.restorePremium(h.deps);
      return h.log;
    }, ['dispatch:restore-tapped', 'restore', 'readTransactions', 'persist:true', 'dispatch:restore-finished:owned'], sfix);
    await expect('restore-flow', FILES.service, 'a read error after the sync counts as failed', async () => {
      const h = harness({ readThrows: true });
      await service.restorePremium(h.deps);
      return h.log.filter((entry) => entry.startsWith('dispatch'));
    }, ['dispatch:restore-tapped', 'dispatch:restore-finished:sync-failed'], sfix);
    await expect('restore-flow', FILES.service, '"already owned" runs restore', async () => {
      const h = harness({ transactions: [tx()] });
      await service.processPurchaseEvent(h.deps, { type: 'failure', failure: 'already-owned', code: 'already-owned' });
      return h.log;
    }, ['dispatch:purchase-failed:already-owned', 'dispatch:restore-tapped', 'restore', 'readTransactions', 'persist:true', 'dispatch:restore-finished:owned'], sfix);
    await expect('revocation', FILES.service, 'the launch re-check without transactions keeps Premium', async () => {
      const h = harness();
      await service.recheckPremium(h.deps);
      return h.log;
    }, ['readTransactions', 'dispatch:entitlements-checked:unknown'], 'Absence is not evidence: never persist Premium off without a revocation date.');
    await expect('revocation', FILES.service, 'a re-check error keeps Premium', async () => {
      const h = harness({ readThrows: true });
      await service.recheckPremium(h.deps);
      return h.log;
    }, ['readTransactions', 'onError'], 'Errors keep the cached state.');
    await expect('revocation', FILES.service, 'a refund is revoked with its date', async () => {
      const refunded = tx({ revocationDateMs: 1_700_000_000_000 });
      const h = harness({ transactions: [refunded] });
      await service.processTransaction(h.deps, refunded);
      return h.log;
    }, ['readTransactions', 'persist:false@1700000000000', 'dispatch:entitlements-checked:revoked', 'finish:t1'], 'A revocation is saved with its revokedAtMs (the save guard ignores a revoke without a date).');
    await expect('revocation', FILES.service, 'a refund is ignored while a newer purchase exists', async () => {
      const refunded = tx({ revocationDateMs: 1_700_000_000_000 });
      const h = harness({ transactions: [refunded, tx({ transactionId: 't2' })] });
      await service.processTransaction(h.deps, refunded);
      return h.log.filter((entry) => entry.startsWith('persist'));
    }, ['persist:true'], sfix);
  }

  if (nudge) {
    const nfix = 'Restore premium-nudge.ts: the Result-screen line only for non-owners, only with a store price, and at most once per local day (upsell.lastShownOn).';
    const base = { isPremium: false, priceText: '€1.99', lastShownOn: '2026-09-27', today: '2026-09-28' };
    const cases = [
      ['first result of the day', base, '€1.99'],
      ['never shown before', { ...base, lastShownOn: null }, '€1.99'],
      ['already shown today', { ...base, lastShownOn: '2026-09-28' }, null],
      ['a Premium owner', { ...base, isPremium: true }, null],
      ['no store price (offline)', { ...base, priceText: null }, null],
    ];
    for (const [label, input, want] of cases) await expect('result-nudge', FILES.nudge, label, () => nudge.premiumNudgePrice(input), want, nfix);
  }

  if (gate && flow) {
    const gfix = 'Restore connectivity-gated-purchase.ts: offline, connect -> false, fetchProduct -> null, restore -> "sync-failed", readTransactions -> [] without calling StoreKit; online, every call passes through.';
    const gated = (script, isOnline) => {
      const h = harness(script);
      return { ...h, deps: { ...h.deps, port: gate.withConnectivity(h.deps.port, () => isOnline) } };
    };
    await expect('offline-gate', FILES.gate, 'offline: nothing reaches StoreKit', async () => {
      const h = gated({ transactions: [tx()] }, false);
      const port = h.deps.port;
      const answers = [await port.connect(), await port.fetchProduct(ID), await port.restore(), await port.readTransactions()];
      return { answers, log: h.log };
    }, { answers: [false, null, 'sync-failed', []], log: [] }, gfix);
    await expect('offline-gate', FILES.gate, 'online: calls pass through', async () => {
      const h = gated({}, true);
      await h.deps.port.connect();
      await h.deps.port.restore();
      return h.log;
    }, ['connect', 'restore'], gfix);
    await expect('offline-gate', FILES.gate, 'loadStore offline -> store unavailable', async () => {
      const h = gated({}, false);
      await flow.loadStore(h.deps);
      return h.log;
    }, ['dispatch:connect-started', 'dispatch:store-unavailable'], gfix);
    await expect('offline-gate', FILES.gate, 'restore offline -> couldn\'t restore', async () => {
      const h = gated({ transactions: [tx()] }, false);
      await service.restorePremium(h.deps);
      return h.log;
    }, ['dispatch:restore-tapped', 'dispatch:restore-finished:sync-failed'], gfix);
    await expect('offline-gate', FILES.gate, 'the offline re-check keeps Premium', async () => {
      const h = gated({}, false);
      await service.recheckPremium(h.deps);
      return h.log;
    }, ['dispatch:entitlements-checked:unknown'], 'Offline, readTransactions answers [] (absence is not evidence), so nothing is persisted.');
    const rfix = 'Restore shouldReloadStore in premium-store-flow.ts: online reloads only an "unavailable" page; offline reloads only a quiet page (ready, failed, restore-empty, restore-failed); never while loading, purchasing, pending or restoring.';
    const table = [
      ['unavailable', true, true], ['ready', true, false], ['ready', false, true], ['failed', false, true],
      ['restore-empty', false, true], ['restore-failed', false, true], ['unavailable', false, false],
      ['loading', false, false], ['purchasing', false, false], ['pending', false, false], ['restoring', false, false],
    ];
    for (const [kind, isOnline, want] of table) await expect('offline-gate', FILES.flow, `shouldReloadStore(${kind}, online=${isOnline})`, () => flow.shouldReloadStore(kind, isOnline), want, rfix);
  }

  if (price) {
    const fix = 'Restore format-store-price.ts: Intl currency format of the store price, falling back to displayPrice.';
    const norm = (text) => text.replace(/[  ]/g, ' ');
    await expect('price-format', FILES.price, 'English', () => price.formatStorePrice(PRODUCT, 'en'), '€1.99', fix);
    await expect('price-format', FILES.price, 'German', () => norm(price.formatStorePrice(PRODUCT, 'de')), '1,99 €', fix);
    await expect('price-format', FILES.price, 'no numeric price', () => price.formatStorePrice({ ...PRODUCT, price: null, displayPrice: '1,99 €' }, 'en'), '1,99 €', fix);
    await expect('price-format', FILES.price, 'unknown currency code', () => price.formatStorePrice({ ...PRODUCT, currency: 'NOT-A-CODE' }, 'en'), '€1.99', fix);
  }
  if (adapter) {
    const file = FILES.adapter;
    const REVOKED_AT = 1_700_000_000_000;
    const purchase = (overrides = {}) => ({ id: 'p1', productId: ID, transactionId: 't1', purchaseState: 'purchased', revocationDateIOS: null, platform: 'ios', ...overrides });
    const failureOf = async (code, via) => {
      iapStub.reset(via === 'reject' ? { requestPurchase: { rejectWith: { code } } } : {});
      const port = adapter.createExpoIapPurchaseAdapter();
      const events = [];
      const unsubscribe = port.subscribe((event) => events.push(event));
      if (via === 'reject') await port.requestPurchase(ID);
      else iapStub.emitError({ code, message: 'stub' });
      unsubscribe();
      return events.map((event) => (event.type === 'failure' ? event.failure : event.type));
    };
    const efix = 'Restore the FAILURES table of the adapter template: user-cancelled -> cancelled, deferred-payment/pending -> deferred, already-owned -> already-owned, connection and service codes -> unavailable, anything else -> failed.';
    const codes = [
      ['user-cancelled', 'cancelled'], ['deferred-payment', 'deferred'], ['pending', 'deferred'], ['already-owned', 'already-owned'],
      ['network-error', 'unavailable'], ['service-error', 'unavailable'], ['iap-not-available', 'unavailable'], ['init-connection', 'unavailable'],
      ['unknown', 'failed'], ['purchase-error', 'failed'], ['item-unavailable', 'failed'],
    ];
    for (const [code, want] of codes) await expect('adapter-errors', file, `listener error ${code}`, () => failureOf(code, 'listener'), [want], efix);
    await expect('adapter-errors', file, 'a rejected requestPurchase (Ask to Buy)', () => failureOf('deferred-payment', 'reject'), ['deferred'], 'A rejected requestPurchase is emitted as a failure event too (the reducer ignores the duplicate).');
    await expect('adapter-errors', file, 'a rejection without a code', async () => {
      iapStub.reset({ requestPurchase: new Error('boom') });
      const port = adapter.createExpoIapPurchaseAdapter();
      const events = [];
      port.subscribe((event) => events.push(event));
      await port.requestPurchase(ID);
      return events;
    }, [{ type: 'failure', failure: 'failed', code: 'unknown' }], efix);

    const rfix = "restore() returns 'sync-failed' whenever restorePurchases() throws (sync-error, a cancelled Apple Account prompt, offline) and 'synced' only when it resolves.";
    await expect('adapter-restore', file, 'restorePurchases throws sync-error', async () => {
      iapStub.reset({ restorePurchases: { rejectWith: { code: 'sync-error' } } });
      return adapter.createExpoIapPurchaseAdapter().restore();
    }, 'sync-failed', rfix);
    for (const [label, rejection] of [['a cancelled Apple Account prompt', { rejectWith: { code: 'user-cancelled' } }], ['a network error', { rejectWith: { code: 'network-error' } }], ['an error without a code', new Error('offline')]]) {
      await expect('adapter-restore', file, `restorePurchases rejects with ${label}`, async () => {
        iapStub.reset({ restorePurchases: rejection });
        return adapter.createExpoIapPurchaseAdapter().restore();
      }, 'sync-failed', rfix);
    }
    await expect('adapter-restore', file, 'restorePurchases resolves', async () => {
      iapStub.reset();
      return adapter.createExpoIapPurchaseAdapter().restore();
    }, 'synced', rfix);

    const tfix = 'readTransactions reads getAvailablePurchases({ onlyIncludeActiveItemsIOS: false }) (Transaction.all), maps revocationDateIOS to revocationDateMs, drops purchaseState unknown and uses transactionId ?? id.';
    await expect('adapter-transactions', file, 'Transaction.all with refunds, pending and unknown', async () => {
      iapStub.reset({ getAvailablePurchases: [purchase({ revocationDateIOS: REVOKED_AT }), purchase({ id: 'p2', transactionId: null, purchaseState: 'pending' }), purchase({ id: 'p3', transactionId: 't3', purchaseState: 'unknown' })] });
      const list = await adapter.createExpoIapPurchaseAdapter().readTransactions();
      return { list: list.map(({ handle, ...rest }) => rest), calls: iapStub.calls() };
    }, {
      list: [
        { productId: ID, transactionId: 't1', state: 'purchased', revocationDateMs: REVOKED_AT },
        { productId: ID, transactionId: 'p2', state: 'pending', revocationDateMs: null },
      ],
      calls: ['getAvailablePurchases:{"onlyIncludeActiveItemsIOS":false}'],
    }, tfix);
    await expect('adapter-transactions', file, 'listener purchases', async () => {
      iapStub.reset();
      const port = adapter.createExpoIapPurchaseAdapter();
      const events = [];
      port.subscribe((event) => events.push(event));
      iapStub.emitPurchase(purchase({ purchaseState: 'unknown' }));
      iapStub.emitPurchase(purchase({ transactionId: 't9', revocationDateIOS: REVOKED_AT }));
      return events.map((event) => ({ type: event.type, id: event.transaction?.transactionId, revocationDateMs: event.transaction?.revocationDateMs }));
    }, [{ type: 'transaction', id: 't9', revocationDateMs: REVOKED_AT }], tfix);
    await expect('adapter-transactions', file, 'unsubscribe removes both listeners', () => {
      iapStub.reset();
      const unsubscribe = adapter.createExpoIapPurchaseAdapter().subscribe(() => undefined);
      const before = iapStub.listenerCount();
      unsubscribe();
      return { before, after: iapStub.listenerCount() };
    }, { before: 2, after: 0 }, 'subscribe() registers purchaseUpdatedListener and purchaseErrorListener; its unsubscribe removes both.');

    const cfix = 'Keep the calls of the adapter template: fetchProducts({ skus: [id], type: "in-app" }) with [] -> null, requestPurchase({ request: { apple: { sku }, google: { skus } }, type: "in-app" }), finishTransaction({ purchase, isConsumable: false }).';
    await expect('adapter-calls', file, 'an empty product list', async () => {
      iapStub.reset({ fetchProducts: [] });
      const product = await adapter.createExpoIapPurchaseAdapter().fetchProduct(ID);
      return { product, calls: iapStub.calls() };
    }, { product: null, calls: [`fetchProducts:{"skus":["${ID}"],"type":"in-app"}`] }, cfix);
    await expect('adapter-calls', file, 'the store product', async () => {
      iapStub.reset({ fetchProducts: [{ id: ID, displayPrice: '€1.99', currency: 'EUR', price: 1.9899999999999998, title: 'Premium', type: 'in-app', platform: 'ios' }] });
      const product = await adapter.createExpoIapPurchaseAdapter().fetchProduct(ID);
      return product && { productId: product.productId, displayPrice: product.displayPrice, price: product.price, currency: product.currency };
    }, PRODUCT, cfix);
    await expect('adapter-calls', file, 'requestPurchase and finish', async () => {
      iapStub.reset();
      const port = adapter.createExpoIapPurchaseAdapter();
      await port.requestPurchase(ID);
      await port.finish({ productId: ID, transactionId: 't1', state: 'purchased', revocationDateMs: null, handle: purchase() });
      return iapStub.calls();
    }, [`requestPurchase:{"request":{"apple":{"sku":"${ID}"},"google":{"skus":["${ID}"]}},"type":"in-app"}`, 'finishTransaction:{"purchase":"t1","isConsumable":false}'], cfix);
  }
  checked += checkStoreReloads(root, report);
  return report.finish({ checked, unit: 'scenarios' });
});
