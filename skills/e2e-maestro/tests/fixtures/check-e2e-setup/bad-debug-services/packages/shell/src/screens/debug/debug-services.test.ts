// packages/shell/src/screens/debug/debug-services.test.ts — the S15 actions the debug switches and
// the debug link share, over fakes (connectivity) and a call log (save write, store dispatch).
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';

import { createDebugServices } from './debug-services.ts';
import { createSimulatedConnectivity } from './simulated-connectivity.ts';

import type { DebugServices } from './debug-services.ts';
import type { ConsentAdsMode } from '@e07/shell/services/consent/consent-factory.ts';
import type { PremiumChange } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

jest.mock('react-native-google-mobile-ads');

type MockedSdk = {
  readonly AdsConsent: { readonly requestInfoUpdate: jest.Mock<Promise<unknown>> };
  readonly AdsConsentDebugGeography: { readonly EEA: number };
};

const sdk = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

const NOW_MS = 1_790_424_000_000;

type Setup = {
  readonly services: DebugServices;
  readonly calls: (PremiumChange | PremiumAction)[];
  readonly heard: boolean[];
};

function setup(adsMode: ConsentAdsMode = 'test'): Setup {
  const connectivity = createSimulatedConnectivity(createFakeConnectivity(true));
  const heard: boolean[] = [];
  connectivity.subscribe((isOnline) => {
    heard.push(isOnline);
  });
  const calls: (PremiumChange | PremiumAction)[] = [];
  const services = createDebugServices({
    connectivity,
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
  return { services, calls, heard };
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
});
