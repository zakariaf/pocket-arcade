// packages/shell/src/app/create-shell-parts.test.ts
import { createNavigationContainerRef, StackActions } from '@react-navigation/native';

import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createFakePurchase } from '@e07/shell/services/purchase/fake-purchase.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { createTestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { createShellParts } from './create-shell-parts.ts';

import type { CreateShellAppInput, ShellLaunch } from './create-shell-parts.ts';
import type { ShellParts } from './shell-app.tsx';
import type { DebugParts, DebugPartsInput } from '@e07/shell/app/create-debug-parts.ts';
import type { TestAdapters } from '@e07/shell/testing/create-test-adapters.ts';
import type { TallyTypes } from '@e07/shell/testing/tally-game.ts';
import type { ParamListBase } from '@react-navigation/native';

const INPUT: CreateShellAppInput<TallyTypes> = {
  game: TALLY_GAME,
  language: 'en',
  directionPlan: 'keep',
};

function launch(adapters: TestAdapters, extra: Partial<CreateShellAppInput<TallyTypes>> = {}) {
  return createShellParts({ ...INPUT, ...extra }, adapters);
}

/** A previous launch: past the tutorial, with a level open when the app was killed. */
function killedInALevel(): TestAdapters {
  const first = createTestAdapters();
  const parts = launch(first);
  parts.stores.settings.getState().dispatch({ type: 'finish-tutorial' });
  parts.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
  return createTestAdapters({ saveStore: first.saveStore });
}

function runOf(parts: ShellParts) {
  return parts.hydrated.save.doc().run;
}

describe('createShellParts', () => {
  it('boots a first launch into a fresh save with the game host, the stores and no resume', () => {
    const adapters = createTestAdapters();
    const parts = launch(adapters);
    expect(parts.hydrated.outcome).toStrictEqual({ kind: 'fresh' });
    expect(adapters.saveStore.slots.has('current')).toBe(true);
    expect([parts.host.id, parts.host.hasMusic, parts.host.hasSavedRun()]).toStrictEqual([
      'tally',
      false,
      false,
    ]);
    expect(parts.hydrated.initialState).toBeUndefined();
    expect(parts.stores.settings.getState().firstRun.tutorialDone).toBe(false);
  });

  it('reopens a killed level paused on Game above Home', () => {
    const parts = launch(killedInALevel());
    expect(runOf(parts)?.ref).toStrictEqual({ kind: 'level', level: 1 });
    expect(parts.hydrated.initialState).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }],
    });
  });

  it('drops an unreadable saved run before the stores and the resume state read the save', () => {
    const adapters = killedInALevel();
    const damaged = launch(adapters);
    damaged.hydrated.save.update((doc) =>
      doc.run === null ? doc : { ...doc, run: { ...doc.run, state: { count: 'many' } } },
    );
    const relaunched = createTestAdapters({ saveStore: adapters.saveStore });
    const parts = launch(relaunched);
    expect(runOf(parts)).toBeNull();
    expect(parts.host.hasSavedRun()).toBe(false);
    expect(parts.hydrated.initialState).toBeUndefined();
    expect(relaunched.errorLog.recorded.map((entry) => entry.source)).toContain('save');
  });

  it('loads the store price once the first network state arrives after an offline start', async () => {
    const adapters = createTestAdapters({ isOnline: false });
    const parts = launch(adapters);
    await flushMicrotasks();
    expect(parts.stores.premium.getState().flow.kind).toBe('unavailable');
    // The store port is gated: nothing reached the store while offline.
    expect(adapters.purchaseCalls).toStrictEqual([]);
    adapters.connectivity.setOnline(true);
    await flushMicrotasks();
    expect(priceOf(parts.stores.premium.getState().flow)).toBe('€1.99');
  });

  it('counts a won level in the ad history in the same run-end save (spec 8.8)', () => {
    const parts = launch(createTestAdapters());
    const opened = parts.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    const addTwo = {
      kind: 'tap',
      target: { regionId: 'board', col: 1, row: 0 },
      selected: null,
    } as const;
    opened?.handle.send({ type: 'intent', intent: addTwo });
    opened?.handle.send({ type: 'intent', intent: addTwo });
    const doc = parts.hydrated.save.doc();
    expect(doc.progress.levels['1']?.stars).toBe(3);
    expect(doc.ads.history.levelsCompletedSinceInterstitial).toBe(1);
  });

  it('hands the game host debug controls to the debug parts: action=win-level ends the level', () => {
    let received: DebugPartsInput | null = null;
    const createDebugParts = (input: DebugPartsInput): DebugParts => {
      received = input;
      return {
        ...{ services: null, links: null, feedback: null },
        navigationRef: createNavigationContainerRef(),
      };
    };
    const parts = launch(createTestAdapters({ createDebugParts }));
    parts.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    const controls = (received as DebugPartsInput | null)?.game;
    controls?.playTo('won');
    const doc = parts.hydrated.save.doc();
    // Stars and the ad history are saved by the host's one run-end path before Result shows.
    expect(doc.progress.levels['1']?.stars).toBeGreaterThanOrEqual(1);
    expect(doc.ads.history.levelsCompletedSinceInterstitial).toBe(1);
  });

  it("plays the Shell's win feedback through the debug parts' recording ports (E2E evidence)", () => {
    const recorded = { audio: createFakeAudio(), haptics: createFakeHaptics() };
    let received: DebugPartsInput | null = null;
    const createDebugParts = (input: DebugPartsInput): DebugParts => {
      received = input;
      return {
        ...{ services: null, links: null, feedback: recorded },
        navigationRef: createNavigationContainerRef(),
      };
    };
    const adapters = createTestAdapters({ createDebugParts });
    const parts = launch(adapters);
    // The recorders wrap the app's own ports, which createDebugParts receives.
    expect((received as DebugPartsInput | null)?.audio).toBe(adapters.audio);
    expect((received as DebugPartsInput | null)?.haptics).toBe(parts.services.haptics);
    parts.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
    (received as DebugPartsInput | null)?.game?.playTo('won');
    expect(recorded.audio.calls).toContainEqual(expect.objectContaining({ soundId: 'ui.win' }));
    expect(recorded.haptics.played).toContain('success');
  });

  it('opens an example run by pushing the Game route on the debug navigator', () => {
    const navigationRef = createNavigationContainerRef<ParamListBase>();
    const dispatch = jest.spyOn(navigationRef, 'dispatch').mockImplementation(() => undefined);
    const adapters = createTestAdapters({
      createDebugParts: () => ({ services: null, links: null, navigationRef, feedback: null }),
    });
    launch(adapters).host.debugControls().openExample('game-middle');
    const levelOne = { start: 'new', ref: { kind: 'level', level: 1 } };
    expect(dispatch).toHaveBeenCalledWith(StackActions.push('Game', levelOne));
  });

  it('builds a consent port that asks neither Google nor Apple with ADS_MODE=off (E2E builds)', async () => {
    const { consent } = launch(createTestAdapters()).services;
    await expect(consent.requestTracking()).resolves.toBe('unavailable');
    await expect(consent.refresh()).resolves.toStrictEqual({
      canRequestAds: false,
      isPrivacyOptionsRequired: false,
    });
  });

  it('holds the consent moment only for a launch that asks for it (the S3 parity frame)', () => {
    expect(launch(createTestAdapters()).isConsentMomentHeld).toBe(false);
    const held: ShellLaunch = { isConsentMomentHeld: () => true };
    expect(launch(createTestAdapters(), { launch: held }).isConsentMomentHeld).toBe(true);
  });

  it('logs a failed direction restart once the save (and its error table) exists', () => {
    const adapters = createTestAdapters();
    launch(adapters, { directionPlan: 'give-up', language: 'fa' });
    expect(adapters.errorLog.recorded).toStrictEqual([
      expect.objectContaining({
        source: 'boot',
        error: new Error('direction-restart-failed: fa'),
      }),
    ]);
  });

  it('loads the UI sounds and the game bank into the one audio engine', () => {
    const adapters = createTestAdapters();
    launch(adapters);
    expect(adapters.audio.loadedIds).toContain('ui.tap');
  });

  it('lets a test-build launch bring its own player data, store, ads and first screen', async () => {
    const calls: string[] = [];
    const fixtureStore = createFakePurchase({
      isConnected: true,
      product: { productId: 'fixture', displayPrice: '$0.99', price: 0.99, currency: 'USD' },
      restoreResult: 'synced',
      transactions: [],
      calls,
    });
    const ads = createFakeAds({
      isRewardedLoaded: false,
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls: [],
    });
    const settings: ShellLaunch = {
      prepareSave: (save) => {
        save.update((doc) => ({ ...doc, firstRun: { languageChosen: true, tutorialDone: true } }));
      },
      purchasePort: () => fixtureStore,
      adsPort: () => ads,
      initialState: () => ({ index: 1, routes: [{ name: 'Home' }, { name: 'Settings' }] }),
    };
    const parts = launch(createTestAdapters(), { launch: settings });
    await flushMicrotasks();
    expect(parts.stores.settings.getState().firstRun.tutorialDone).toBe(true);
    expect(priceOf(parts.stores.premium.getState().flow)).toBe('$0.99');
    expect(parts.services.ads).toBe(ads);
    expect(parts.hydrated.initialState?.routes.map((route) => route.name)).toStrictEqual([
      'Home',
      'Settings',
    ]);
  });
});
