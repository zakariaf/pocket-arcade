// packages/shell/src/app/create-debug-parts.ts
// The composition root's one call for everything test-only that reaches services: the JS network
// guard, the test-only key-value store, the debug services (S15 switches and the debug link), the
// debug link handler and the navigator ref it navigates with. All of it comes through the
// test-only entry, so a store build (TEST_ONLY === null) gets services and links null and none of
// that code. The navigator gets navigationRef as its ref and calls links?.start(Linking) from its
// onReady; the app root provides services and links with DebugServicesProvider.
import { createNavigationContainerRef } from '@react-navigation/native';

import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { readLayoutDirection, restartForDirection } from '@e07/shell/i18n/direction.ts';
import { readAdsExtra } from '@e07/shell/services/ads/read-ads-extra.ts';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';

import type { DebugLinkHandler } from '@e07/shell/app/debug-link-handler.ts';
import type { DebugGameControls } from '@e07/shell/app/debug-link-routes.ts';
import type { TestOnlyApi } from '@e07/shell/app/test-only-api.ts';
import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SectionStores } from '@e07/shell/stores/update-and-publish.ts';
import type { NavigationContainerRefWithCurrent, ParamListBase } from '@react-navigation/native';

export type DebugPartsInput = {
  /** The wrappers every service was built with (simulated: null in store builds). */
  readonly network: { readonly simulated: SimulatedConnectivity | null };
  readonly clocks: { readonly simulated: SimulatedClock | null };
  readonly premiumDeps: Pick<PremiumServiceDeps, 'persistPremium' | 'dispatch'>;
  readonly save: SaveService;
  readonly stores: SectionStores;
  /** Stopped before a direction reload, as the restart dialog does. */
  readonly audio: Pick<AudioPort, 'dispose'>;
  readonly errorLog: ErrorLogPort;
  readonly extra: Pick<GameExtra, 'levels'>;
  /** The game host's debug controls (action= and the example screens), once the host has them. */
  readonly game?: DebugGameControls;
};

export type DebugParts = {
  /** The S15 switches' and the debug link's services (null in store builds). */
  readonly services: DebugServices | null;
  /** The debug link handler: the navigator calls links?.start(Linking) from its onReady. */
  readonly links: DebugLinkHandler | null;
  /** Untyped params: the static navigator's ref prop takes a ParamListBase ref. */
  readonly navigationRef: NavigationContainerRefWithCurrent<ParamListBase>;
};

type TestBuild = {
  readonly api: TestOnlyApi;
  readonly connectivity: SimulatedConnectivity;
  readonly clock: SimulatedClock;
};

function createServices(build: TestBuild, input: DebugPartsInput): DebugServices {
  return build.api.createDebugServices({
    connectivity: build.connectivity,
    clock: build.clock,
    // The flags a direction reload or a kill interrupted come back here, before the first render.
    store: build.api.createSqliteKvDebugStoreAdapter(),
    persistPremium: input.premiumDeps.persistPremium,
    dispatchPremium: input.premiumDeps.dispatch,
    nowMs: build.clock.nowMs,
    adsMode: readAdsExtra().adsMode,
    onError: (error) => {
      input.errorLog.record('ads', error); // consent errors are ad errors
    },
  });
}

function createLinks(
  build: TestBuild,
  input: DebugPartsInput & { readonly debug: DebugServices },
  navigationRef: DebugParts['navigationRef'],
): DebugLinkHandler {
  const guard = createSqliteKvDirectionGuardAdapter();
  return build.api.createDebugLinkHandler({
    services: input.debug,
    store: { get: () => null, set: () => undefined },
    readSave: input.save.doc,
    writeSave: (recipe) => {
      updateAndPublish(input.save, input.stores, { recipe, refreshBackup: false });
    },
    today: build.clock.today,
    levelCount: input.extra.levels.packCount * input.extra.levels.levelsPerPack,
    layoutDirection: readLayoutDirection(),
    restart: async (direction) => {
      await input.audio.dispose();
      await restartForDirection(direction, guard);
    },
    openRoute: (route) => {
      if (route.name === 'Game') navigationRef.navigate(route.name, route.params);
      else navigationRef.navigate(route.name);
    },
    game: input.game ?? null,
    onError: (error) => {
      input.errorLog.record('boot', error);
    },
  });
}

/**
 * Every JS fetch, XHR or WebSocket attempt is blocked and recorded in the error log (source
 * 'network'), where S15 counts it as debug.network-attempts. Installed first, so it is in place
 * before startPremium and the ad services, which the composition root starts after this call.
 */
function guardNetwork(api: TestOnlyApi, errorLog: ErrorLogPort): void {
  api.installNetworkGuard(globalThis, (attempt) => {
    errorLog.record('network', new Error(`${attempt.kind} to ${attempt.target} blocked (N3)`));
  });
}

export function createDebugParts(input: DebugPartsInput): DebugParts {
  const navigationRef = createNavigationContainerRef<ParamListBase>();
  const connectivity = input.network.simulated;
  const clock = input.clocks.simulated;
  if (TEST_ONLY === null || connectivity === null || clock === null) {
    return { services: null, links: null, navigationRef };
  }
  guardNetwork(TEST_ONLY, input.errorLog);
  const build = { api: TEST_ONLY, connectivity, clock };
  const services = createServices(build, input);
  const links = createLinks(build, { ...input, debug: services }, navigationRef);
  return { services, links, navigationRef };
}
