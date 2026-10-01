// packages/shell/src/screens/debug/debug-services.test.ts — the S15 actions the debug switches and
// the debug link share, over fakes (connectivity, the test-only key-value store) and a call log
// (save write, store dispatch). A second createDebugServices over the same store is a reload.
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';

import { decodeDebugOverrides } from './debug-overrides.ts';
import { createDebugServices } from './debug-services.ts';
import { createFakeDebugPerf } from './fake-debug-perf.ts';
import { createFakeDebugStore } from './fake-debug-store.ts';
import { createSimulatedClock } from './simulated-clock.ts';
import { createSimulatedConnectivity } from './simulated-connectivity.ts';

import type { DebugServices } from './debug-services.ts';
import type { FakeDebugStore } from './fake-debug-store.ts';
import type { SimulatedClock } from './simulated-clock.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ConsentAdsMode } from '@e07/shell/services/consent/consent-factory.ts';
import type { ConsentPort } from '@e07/shell/services/consent/consent-port.ts';
import type { PremiumChange } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: { readonly requestInfoUpdate: jest.Mock<Promise<unknown>> };
  readonly AdsConsentDebugGeography: { readonly EEA: number; readonly OTHER: number };
};

const sdk = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

const NOW_MS = 1_790_424_000_000;
/** The perf log createDebugParts makes with TEST_ONLY.createPerfLog (a stand-in here). */
const PERF_LOG = { append: jest.fn(), entries: () => [] };
const PERF = createFakeDebugPerf(PERF_LOG);

type Setup = {
  readonly services: DebugServices;
  /** admob-ads' resetConsent (Google's UMP answer), null in an ADS_MODE=off build. */
  readonly resetConsent: jest.Mock | null;
  readonly clock: SimulatedClock;
  readonly store: FakeDebugStore;
  readonly calls: (PremiumChange | PremiumAction)[];
  readonly heard: boolean[];
};

function setup(
  adsMode: ConsentAdsMode = 'test',
  store: FakeDebugStore = createFakeDebugStore(),
  /** A date set on the clock before the services exist, as a parity launch does. */
  earlierToday: DateKey | null = null,
): Setup {
  const connectivity = createSimulatedConnectivity(createFakeConnectivity(true));
  const heard: boolean[] = [];
  connectivity.subscribe((isOnline) => {
    heard.push(isOnline);
  });
  const calls: (PremiumChange | PremiumAction)[] = [];
  const clock = createSimulatedClock(createFakeClock({ nowMs: NOW_MS, today: '2026-09-28' }));
  clock.setSimulatedToday(earlierToday);
  const resetConsent = adsMode === 'off' ? null : jest.fn();
  const services = createDebugServices({
    connectivity,
    clock,
    store,
    resetConsent,
    perfLog: PERF_LOG,
    perf: PERF,
    persistPremium: (change) => {
      calls.push(change);
    },
    dispatchPremium: (action) => {
      calls.push(action);
    },
    nowMs: () => NOW_MS,
    adsMode,
    onError: jest.fn(),
  });
  return { services, resetConsent, clock, store, calls, heard };
}

describe('createDebugServices', () => {
  describe('when offline=0|1 flips', () => {
    it('tells every ConnectivityPort subscriber', () => {
      const { services, heard } = setup();

      services.setOffline(true);
      services.setOffline(false);

      expect(heard).toStrictEqual([false, true]);
    });
  });

  describe('when date=YYYY-MM-DD is applied', () => {
    it('moves the calendar day of the one app clock, and nothing else', () => {
      const { services, clock } = setup();

      services.setDate('2026-09-26');

      expect([clock.today(), clock.nowMs()]).toStrictEqual(['2026-09-26', NOW_MS]);
    });
  });

  describe('when premium=0|1 is applied', () => {
    it('writes the save before it dispatches debug-premium-set', () => {
      const { services, calls } = setup();

      services.setPremium(true);

      expect(calls).toStrictEqual([
        { isPremium: true },
        { type: 'debug-premium-set', isPremium: true },
      ]);
    });

    it('saves a dated revocation when Premium is switched off', () => {
      const { services, calls } = setup();

      services.setPremium(false);

      expect(calls).toStrictEqual([
        { isPremium: false, revokedAtMs: NOW_MS },
        { type: 'debug-premium-set', isPremium: false },
      ]);
    });
  });

  describe('when boardLayout=0|1 is applied', () => {
    it('starts off and follows the link', () => {
      const { services } = setup();
      expect(services.isBoardLayoutOn()).toBe(false);

      services.setBoardLayout(true);
      expect(services.isBoardLayoutOn()).toBe(true);

      services.setBoardLayout(false);
      expect(services.isBoardLayoutOn()).toBe(false);
    });
  });

  describe('when ads=off|test or seed=<n> is applied', () => {
    it('keeps them for the ad policy and the game host', () => {
      const { services } = setup();
      expect([services.adsOverride(), services.seedOverride()]).toStrictEqual([null, null]);

      services.setAdsOverride('never');
      services.setSeed(42);

      expect([services.adsOverride(), services.seedOverride()]).toStrictEqual(['never', 42]);
    });
  });

  describe('across a direction reload or a killed app', () => {
    it('writes every flag outside the save to the key-value store at once', () => {
      const { services, store } = setup();

      services.setDate('2026-09-26');
      services.setOffline(true);
      services.setBoardLayout(true);
      services.setAdsOverride('always-test');
      services.setSeed(7);

      expect(decodeDebugOverrides(store.get('debug.overrides'))).toStrictEqual({
        date: '2026-09-26',
        isOffline: true,
        isBoardLayoutOn: true,
        ads: 'always-test',
        seed: 7,
        consentGeography: null,
      });
    });

    it('applies the stored flags again when the next run creates the services', () => {
      const first = setup();
      first.services.setDate('2026-09-26');
      first.services.setOffline(true);
      first.services.setBoardLayout(true);

      const reloaded = setup('test', first.store);

      expect(reloaded.clock.today()).toBe('2026-09-26');
      expect(reloaded.services.isOffline()).toBe(true);
      expect(reloaded.heard).toStrictEqual([false]);
      expect(reloaded.services.isBoardLayoutOn()).toBe(true);
    });

    it('keeps a date set before the services exist (a parity frame) over the stored one', () => {
      const first = setup();
      first.services.setDate('2026-09-20');

      const parity = setup('test', first.store, '2026-09-26');

      expect(parity.clock.today()).toBe('2026-09-26');
    });

    it('starts clean on a first launch (clearState empties the store)', () => {
      const { services, clock, heard } = setup();

      expect([clock.today(), services.isOffline(), heard]).toStrictEqual(['2026-09-28', false, []]);
    });
  });

  describe('the perf log', () => {
    it('is the one createDebugParts made, for Home (useOptionalDebugServices()?.perfLog)', () => {
      expect(setup().services.perfLog).toBe(PERF_LOG);
    });

    it("gives S15's Performance section the actions createDebugParts made over it", () => {
      expect(setup().services.perf).toBe(PERF);
    });
  });

  describe('when a debug geography is picked', () => {
    it('asks Google UMP with that geography in an ADS_MODE=test build', async () => {
      const { services } = setup('test');

      await services.createConsent('eea').refresh();

      expect(sdk.AdsConsent.requestInfoUpdate).toHaveBeenCalledWith({
        debugGeography: sdk.AdsConsentDebugGeography.EEA,
      });
    });

    it('makes no UMP request in an ADS_MODE=off build', async () => {
      const { services } = setup('off');

      await expect(services.createConsent('eea').refresh()).resolves.toStrictEqual({
        canRequestAds: false,
        isPrivacyOptionsRequired: false,
      });
      expect(sdk.AdsConsent.requestInfoUpdate).not.toHaveBeenCalled();
    });
  });

  describe('when geo=eea|other is applied (the ads smoke test)', () => {
    /** The composition root's own consent port: here a fake that records what was asked. */
    function basePort(): ConsentPort & { readonly asked: string[] } {
      const asked: string[] = [];
      const info = { canRequestAds: true, isPrivacyOptionsRequired: false };
      return {
        asked,
        refresh: () => {
          asked.push('refresh');
          return Promise.resolve(info);
        },
        showFormIfRequired: () => Promise.resolve(info),
        showPrivacyOptions: () => Promise.resolve(info),
        requestTracking: () => Promise.resolve('not-determined'),
      };
    }

    it("follows the app's own consent port until a geography is set", async () => {
      const { services } = setup('test');
      const base = basePort();

      await services.consentFor(base).refresh();

      expect([base.asked, services.consentGeography()]).toStrictEqual([['refresh'], null]);
      expect(sdk.AdsConsent.requestInfoUpdate).not.toHaveBeenCalled();
    });

    it("resets Google's answer, then asks UMP for that geography at the next consent moment", async () => {
      const { services, resetConsent } = setup('test');
      const base = basePort();
      const consent = services.consentFor(base);

      services.setConsentGeography('eea');
      await consent.refresh();

      expect(resetConsent).toHaveBeenCalledTimes(1);
      expect(sdk.AdsConsent.requestInfoUpdate).toHaveBeenCalledWith({
        debugGeography: sdk.AdsConsentDebugGeography.EEA,
      });
      expect(base.asked).toStrictEqual([]);
      services.setConsentGeography('other');
      await consent.refresh();
      expect(sdk.AdsConsent.requestInfoUpdate).toHaveBeenLastCalledWith({
        debugGeography: sdk.AdsConsentDebugGeography.OTHER,
      });
      expect(resetConsent).toHaveBeenCalledTimes(2);
    });

    it('keeps the geography across a reload without resetting Google again', async () => {
      const first = setup('test');
      first.services.setConsentGeography('eea');

      const reloaded = setup('test', first.store);
      await reloaded.services.consentFor(basePort()).refresh();

      expect(reloaded.services.consentGeography()).toBe('eea');
      expect(reloaded.resetConsent).not.toHaveBeenCalled();
      expect(sdk.AdsConsent.requestInfoUpdate).toHaveBeenCalledWith({
        debugGeography: sdk.AdsConsentDebugGeography.EEA,
      });
    });

    it('skips UMP in an ADS_MODE=off build: no reset, and the ads-off answer', async () => {
      const { services } = setup('off');

      services.setConsentGeography('eea');

      await expect(services.consentFor(basePort()).refresh()).resolves.toStrictEqual({
        canRequestAds: false,
        isPrivacyOptionsRequired: false,
      });
      expect(sdk.AdsConsent.requestInfoUpdate).not.toHaveBeenCalled();
    });
  });
});
