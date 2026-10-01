// packages/shell/src/app/create-shell-parts.ts
// The composition root's work, over injected adapters (device-adapters.ts on a phone, fakes in
// Jest): the save hydrated synchronously, then the game host (it validates the saved run with the
// game's own parsers and drops only an unreadable run), then the stores and the resume state from
// the document as the host left it, then Premium, the debug services and the services.
import { connectAudioSettings } from '@e07/shell/app/connect-audio-settings.ts';
import { connectPremiumReloads } from '@e07/shell/app/connect-premium-reloads.ts';
import { createPremiumDeps } from '@e07/shell/app/create-premium-deps.ts';
import { debugFeedbackOf, debugSwitchesOf } from '@e07/shell/app/debug-switches.ts';
import { hydrateSave, resumeState } from '@e07/shell/app/hydrate-save.ts';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { createGameBoardHost } from '@e07/shell/game-host/create-game-board-host.tsx';
import { createGameHost } from '@e07/shell/game-host/game-host.ts';
import { recordLevelEnd } from '@e07/shell/services/ads/ad-history.ts';
import { createAdsPort } from '@e07/shell/services/ads/ads-factory.ts';
import { composeSoundBank } from '@e07/shell/services/audio/compose-sound-bank.ts';
import { createConsentPort } from '@e07/shell/services/consent/consent-factory.ts';
import { withConnectivity } from '@e07/shell/services/purchase/connectivity-gated-purchase.ts';
import { startPremium } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createThemeSet } from '@e07/shell/theme/theme-set.ts';

import type { DebugParts, DebugPartsInput } from '@e07/shell/app/create-debug-parts.ts';
import type { DebugSwitches } from '@e07/shell/app/debug-switches.ts';
import type { Hydrated } from '@e07/shell/app/hydrate-save.ts';
import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ShellParts } from '@e07/shell/app/shell-app.tsx';
import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { GameExtra } from '@e07/shell/config/game-extra.ts';
import type { ExamplePictureFactory, GameHost } from '@e07/shell/game-host/game-host.ts';
import type { RunSummary } from '@e07/shell/game-host/run-summary.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { DirectionPlan } from '@e07/shell/i18n/direction-plan.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { DeviceLocale } from '@e07/shell/i18n/resolve-language.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { SimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import type { AdsExtra } from '@e07/shell/services/ads/ads-factory.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ConnectivityPort } from '@e07/shell/services/connectivity/connectivity-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';
import type { InitialState } from '@react-navigation/native';
import type { ComponentType } from 'react';

/**
 * How this launch differs from a normal one. Store builds and normal launches pass nothing; a
 * test-build harness (the parity capture) builds one from its TEST_ONLY functions and startShell
 * passes it, so the composition root never imports test-only code and compiles before the harness
 * exists.
 */
export type ShellLaunch = {
  /**
   * Right after hydrateSave, before the game host and the stores: rewrite the document (fixture
   * player data) and move the test date (the parity harness's applyParityData).
   */
  readonly prepareSave?: (save: SaveService, simulatedClock: SimulatedClock | null) => void;
  /** A stand-in store port (a fixture price) instead of StoreKit (parityStorePort). */
  readonly purchasePort?: (productId: string) => PurchasePort;
  /** A stand-in ads port: no SDK, a drawn banner (parityAdsPort). */
  readonly adsPort?: () => AdsPort;
  /**
   * Where the navigator starts instead of the saved run's resume state (the parity frame's route
   * stack); undefined leaves the choice to the resume state and the FirstRun group.
   */
  readonly initialState?: () => InitialState | undefined;
  /** Wraps the root component in the harness's contexts (withParityRoot). */
  readonly wrapRoot?: (root: ComponentType) => ComponentType;
  /**
   * The S3 parity frame (isHeldParityStart for s3-consent-moment): the consent moment shows its
   * intro at once and holds it; Google's form is never requested.
   */
  readonly isConsentMomentHeld?: () => boolean;
};

/** What the device (device-adapters.ts) or a test provides: every native module lives here. */
export type ShellAdapters = {
  /** createSqliteSaveStore(driver) over save.db. */
  readonly saveStore: SaveStore;
  /** The error_log table of the same save.db. */
  readonly errorLog: ErrorLogPort;
  /** The one save.db connection: the test build's perf log (createDebugParts) keeps a table in it. */
  readonly saveDriver: SqlDriver;
  readonly clock: ClockPort;
  readonly connectivity: ConnectivityPort;
  readonly audio: AudioPort;
  /** The Vibration setting is read at every pulse: createShellHaptics(settings, clock). */
  readonly createHaptics: (stores: () => ShellStores, clock: ClockPort) => HapticsPort;
  /**
   * The store port, gated by the app's one connectivity port where it is created:
   * withConnectivity(createExpoIapPurchaseAdapter(), isOnline). isOnline is the wrapped port's, so
   * the debug "Simulate offline" switch reaches the store too.
   */
  readonly createPurchase: (isOnline: () => boolean) => PurchasePort;
  readonly deviceLocales: readonly DeviceLocale[];
  /**
   * e2e-maestro's createDebugParts on a device: the test builds' network guard, debug services,
   * link handler and navigator ref (services and links null in store builds).
   */
  readonly createDebugParts: (input: DebugPartsInput) => DebugParts;
  /** The S13 pictures (createExamplePicture() on a device: Skia); tests draw nothing. */
  readonly createExamplePicture?: ExamplePictureFactory;
  /** readGameExtra(), readAdsExtra() and readAppVersion(): expo.extra as withShell wrote it. */
  readonly config: {
    readonly game: GameExtra;
    readonly ads: AdsExtra;
    readonly appVersion: string;
  };
};

export type CreateShellAppInput<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly language: Language;
  readonly directionPlan: Exclude<DirectionPlan, 'restart'>;
  readonly launch?: ShellLaunch;
};

type Clocks = { readonly clock: ClockPort; readonly simulated: SimulatedClock | null };
type Network = {
  readonly connectivity: ConnectivityPort;
  readonly simulated: SimulatedConnectivity | null;
};

/** Test builds wrap the clock once, so the debug date reaches every reader of today(). */
function wrapClock(real: ClockPort): Clocks {
  const simulated = TEST_ONLY?.createSimulatedClock(real) ?? null;
  return { clock: simulated ?? real, simulated };
}

/** Test builds wrap connectivity once, so "Simulate offline" reaches every subscriber. */
function wrapNetwork(real: ConnectivityPort): Network {
  const simulated = TEST_ONLY?.createSimulatedConnectivity(real) ?? null;
  return { connectivity: simulated ?? real, simulated };
}

type Core = {
  readonly save: SaveService;
  readonly clocks: Clocks;
  readonly adapters: ShellAdapters;
  readonly haptics: HapticsPort;
};

/** hydrateSave, then the launch's own data and the boot log (the error_log table exists now). */
function openSave<T extends ShellGameTypes>(
  input: CreateShellAppInput<T>,
  adapters: ShellAdapters,
  clocks: Clocks,
): Hydrated {
  const { config, errorLog } = adapters;
  const hydrated = hydrateSave({
    store: adapters.saveStore,
    clock: clocks.clock,
    errorLog,
    gameId: config.game.id,
    appVersion: config.appVersion,
  });
  input.launch?.prepareSave?.(hydrated.save, clocks.simulated);
  if (input.directionPlan === 'give-up') {
    errorLog.record('boot', new Error(`direction-restart-failed: ${input.language}`));
  }
  return hydrated;
}

type HostInput<T extends ShellGameTypes> = DebugSwitches & {
  readonly feedback: ReturnType<typeof debugFeedbackOf>; // test builds: recording ports
  readonly game: ShellGameModule<T>;
  readonly core: Core;
  /** The stores exist before any run can end (after the first render). */
  readonly stores: () => ShellStores;
};

/**
 * The ads layer's part of the ONE run-end update (spec 8.8): every finished level counts toward the
 * interstitial caps before the Result screen appears (admob-ads' recordLevelEnd).
 */
function recordAdLevelEnd(doc: SaveDoc, summary: RunSummary): SaveDoc {
  if (summary.ref.kind !== 'level') return doc;
  const history = recordLevelEnd(doc.ads.history, summary.isWon ? 'win' : 'lose');
  return { ...doc, ads: { ...doc.ads, history } };
}

/** The one generic seam: the typed module stays inside the host's closure from here on. */
function hostFor<T extends ShellGameTypes>(input: HostInput<T>): GameHost {
  const { adapters, haptics, save, clocks } = input.core;
  const { audio, errorLog, createExamplePicture } = adapters;
  const { isLayoutProbeOn, seedOverride, openGame } = input;
  const pictures = createExamplePicture === undefined ? {} : { createExamplePicture };
  return createGameHost(input.game, {
    ...pictures,
    save,
    clock: clocks.clock,
    errorLog,
    isContinueAllowed: adapters.config.game.isContinueAllowed,
    seedOverride,
    openGame,
    createBoardHost: createGameBoardHost({ audio, haptics, errorLog, isLayoutProbeOn }),
    feedback: input.feedback,
    extendRunEnd: recordAdLevelEnd,
    writeRunEnd: (write) => {
      updateAndPublish(save, input.stores(), write);
    },
  });
}

/** The ads and consent ports; consent also asks Apple's ATT, never with ADS_MODE=off (E2E). */
function adServicesFor(core: Core, launch: ShellLaunch): Pick<Services, 'ads' | 'consent'> {
  const { config, errorLog } = core.adapters;
  const recordAdError = (error: unknown): void => {
    errorLog.record('ads', error);
  };
  return {
    ads: launch.adsPort?.() ?? createAdsPort(config.ads, recordAdError),
    consent: createConsentPort(config.ads.adsMode, { onError: recordAdError }),
  };
}

type Online = { readonly stores: ShellStores; readonly network: Network };

/** premium-purchase's dependencies, once: the gated store port, the save write, the price text. */
function premiumDepsFor(core: Core, launch: ShellLaunch, online: Online): PremiumServiceDeps {
  const { adapters } = core;
  const { stores, network } = online;
  const productId = adapters.config.game.premiumProductId;
  const { isOnline } = network.connectivity;
  // A launch's stand-in store (test builds) is gated the same way as the device's.
  const standIn = launch.purchasePort?.(productId);
  const purchase =
    standIn === undefined ? adapters.createPurchase(isOnline) : withConnectivity(standIn, isOnline);
  return createPremiumDeps({
    save: core.save,
    stores,
    clock: core.clocks.clock,
    errorLog: adapters.errorLog,
    purchase,
    productId,
    deviceLocales: adapters.deviceLocales,
  });
}

/** Premium starts (never awaited), then its reloads: the first network state arrives later. */
function startPremiumParts(premiumDeps: PremiumServiceDeps, online: Online): void {
  // Never awaited: the first screen does not wait for the store (errors go to the error log).
  startPremium(premiumDeps).catch(premiumDeps.onError);
  connectPremiumReloads(online.network.connectivity, online.stores, premiumDeps);
}

type Rest = Pick<ShellParts, 'premiumDeps' | 'debug' | 'services'>;
type Made = { readonly stores: ShellStores; readonly host: GameHost };

/**
 * Everything after the stores: the audio settings, Premium's dependencies, the test-only debug
 * parts (e2e-maestro's createDebugParts installs the network guard first, so it comes before
 * startPremium and the ad services, and gets the game host's debug controls for action= and the
 * example screens), then Premium starts and the services are built.
 */
function finishParts(core: Core, launch: ShellLaunch, made: Made): Rest {
  const { adapters, save, clocks } = core;
  const { stores, host } = made;
  connectAudioSettings(stores.settings, adapters.audio);
  const network = wrapNetwork(adapters.connectivity);
  const premiumDeps = premiumDepsFor(core, launch, { stores, network });
  const { audio, errorLog, config, saveDriver } = adapters;
  const debug = adapters.createDebugParts({
    ...{ network, clocks, premiumDeps, stores, audio, errorLog, save, saveDriver },
    ...{ haptics: core.haptics },
    extra: config.game,
    game: host.debugControls(),
  });
  startPremiumParts(premiumDeps, { stores, network });
  const services: Services = {
    ...adServicesFor(core, launch),
    audio: adapters.audio,
    clock: clocks.clock,
    connectivity: network.connectivity,
    errorLog: adapters.errorLog,
    haptics: core.haptics,
    purchase: premiumDeps.port,
    save,
  };
  return { premiumDeps, debug, services };
}

/** Where the navigator starts: the launch's screen, else the saved run, after the host ran. */
function initialStateFor(launch: ShellLaunch, save: SaveService): InitialState | undefined {
  return launch.initialState?.() ?? resumeState(save.doc());
}

/**
 * The composition root's parts, built once per launch (createShellApp calls it only after the
 * direction check). Order: hydrate the save, create the game host, create the stores, recompute
 * the resume state after the host (a run it dropped is never resumed), then the services.
 */
export function createShellParts<T extends ShellGameTypes>(
  input: CreateShellAppInput<T>,
  adapters: ShellAdapters,
): ShellParts {
  const launch = input.launch ?? {};
  const clocks = wrapClock(adapters.clock);
  const hydrated = openSave(input, adapters, clocks);
  adapters.audio.load(composeSoundBank(input.game.presentation.sounds));
  let stores: ShellStores | null = null;
  const getStores = (): ShellStores => {
    if (stores === null) throw new Error('the stores are created right after the game host');
    return stores;
  };
  const haptics = adapters.createHaptics(getStores, clocks.clock);
  const core = { save: hydrated.save, clocks, adapters, haptics };
  // Assigned below, before the first render; the board reads it only while it draws.
  let debug: DebugParts | null = null;
  const host = hostFor({
    game: input.game,
    core,
    stores: getStores,
    ...debugSwitchesOf(() => debug),
    feedback: debugFeedbackOf(() => debug, { audio: adapters.audio, haptics }),
  });
  stores = createShellStores(hydrated.save);
  const rest = finishParts(core, launch, { stores, host });
  debug = rest.debug;
  return {
    ...rest,
    isConsentMomentHeld: launch.isConsentMomentHeld?.() === true,
    // Recomputed after the host: it may have dropped a run hydrateSave wanted to resume.
    hydrated: { ...hydrated, initialState: initialStateFor(launch, hydrated.save) },
    stores,
    host,
    themes: createThemeSet(input.game.presentation.palette),
    gameCatalogs: input.game.texts,
    deviceLocales: adapters.deviceLocales,
  };
}
