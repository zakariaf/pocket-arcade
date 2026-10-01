// packages/shell/src/app/parity-startup.tsx
// The Shell's startup side of the parity harness (toybox-visual-parity). Every call goes through
// TEST_ONLY, so a store build (TEST_ONLY === null) takes the normal path every time and contains
// none of the harness. start-shell.ts calls readParityLaunch() first and, for a frame, passes
// parityLaunchFor(...) to createShellApp as its ShellLaunch; the composition root then calls the
// launch's members in the order the functions are listed here, and hands isConsentMomentHeld to
// the consent moment host (S3).
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';

import type { ShellLaunch } from '@e07/shell/app/create-shell-app.tsx';
import type { ParityParseResult, ParityRequest } from '@e07/shell/app/parity/parity-request.ts';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { AdsPort } from '@e07/shell/services/ads/ads-port.ts';
import type { PurchasePort } from '@e07/shell/services/purchase/purchase-port.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { InitialState } from '@react-navigation/native';
import type { ComponentType, ReactNode } from 'react';

export type ParityLaunch =
  | { readonly kind: 'normal' }
  | { readonly kind: 'error'; readonly root: ComponentType }
  | { readonly kind: 'frame'; readonly request: ParityRequest };

const NORMAL: ParityLaunch = { kind: 'normal' };

/**
 * Reads -parity once, before anything renders: a normal start, the error view (a malformed
 * request is shown, never ignored), or a frame whose session the harness starts now.
 */
export function readParityLaunch(
  read: () => ParityParseResult | null = () => TEST_ONLY?.readParityRequest() ?? null,
): ParityLaunch {
  const parsed = read();
  if (TEST_ONLY === null || parsed === null) return NORMAL;
  if (!parsed.ok) return { kind: 'error', root: TEST_ONLY.createParityErrorRoot(parsed.error) };
  TEST_ONLY.startParitySession(parsed.request);
  return { kind: 'frame', request: parsed.request };
}

type ParityDataInput<T extends ShellGameTypes> = {
  readonly parity: ParityRequest | null;
  readonly game: ShellGameModule<T>;
  readonly save: SaveService;
  readonly simulatedClock: SimulatedClock | null;
  /** The test build's saved debug flags; TEST_ONLY.createSqliteKvDebugStoreAdapter() unless given. */
  readonly debugStore?: DebugStore | undefined;
};

/**
 * Right after hydrateSave and before the game host, the stores and the debug services exist: the
 * frame's player data written through the save service (so Premium is revoked with a date when
 * needed), today() moved to the frame's date, and no saved debug flag left. The debug services
 * restore their flags (offline, the ads override, a seed, a consent geography) from that store
 * when they are made, so without this a frame would inherit what an earlier launch saved: the S15
 * frame's "Always show test ads", or a debug link's offline switch on every S12 card.
 */
export function applyParityData<T extends ShellGameTypes>(input: ParityDataInput<T>): void {
  const { parity: request, game, save } = input;
  const api = TEST_ONLY;
  if (request === null || api === null) return;
  save.update((doc) => api.parityDoc({ base: doc, game, request }));
  input.simulatedClock?.setSimulatedToday(request.date);
  (input.debugStore ?? api.createSqliteKvDebugStoreAdapter()).set('debug.overrides', null);
}

/** The store port of a parity launch (fixture product, the S12 state's behaviour); null normally. */
export function parityStorePort(
  parity: ParityRequest | null,
  productId: string,
): PurchasePort | null {
  if (parity === null) return null;
  return TEST_ONLY?.createParityPurchase({ productId, plan: parity.plan }) ?? null;
}

/** The ads port of a parity launch (no SDK, the stand-in banner); null normally. */
export function parityAdsPort(parity: ParityRequest | null): AdsPort | null {
  if (parity === null) return null;
  return TEST_ONLY?.createParityAds() ?? null;
}

/**
 * The probe=board launch of a Game-route frame starts a fresh run of the frame's level instead of
 * resuming the saved one: a resumed run opens on Pause, whose modal overlay hides the board-layout
 * probe from the accessibility tree the capture script reads. The board sits where it always does.
 */
function boardProbeState(level: number): InitialState {
  return {
    index: 1,
    routes: [
      { name: 'Home' },
      { name: 'Game', params: { start: 'new', ref: { kind: 'level', level } } },
    ],
  };
}

function parityStartState(request: ParityRequest): InitialState | undefined {
  const api = TEST_ONLY;
  if (api === null) return undefined;
  if (request.probe === 'board' && request.plan.start === 'Game') {
    return boardProbeState(api.parityGameFixture()?.level ?? 1);
  }
  return api.parityInitialState(request.plan);
}

/** Where the navigator starts: the frame's route stack, else the normal resume state. */
export function initialStateFor(
  parity: ParityRequest | null,
  normal: InitialState | undefined,
): InitialState | undefined {
  if (parity === null || TEST_ONLY === null) return normal;
  return parityStartState(parity);
}

/** The Shell's root, wrapped in the harness contexts (banner placements, scroll offset). */
export function withParityRoot(parity: ParityRequest | null, Root: ComponentType): ComponentType {
  const api = TEST_ONLY;
  if (parity === null || api === null) return Root;
  const { ParityFrameRoot } = api;
  return function ParityShellRoot(): ReactNode {
    return (
      <ParityFrameRoot request={parity}>
        <Root />
      </ParityFrameRoot>
    );
  };
}

type ParityLaunchInput<T extends ShellGameTypes> = {
  readonly request: ParityRequest;
  readonly game: ShellGameModule<T>;
  /** Tests pass a fake; the app uses the test build's own debug store. */
  readonly debugStore?: DebugStore | undefined;
};

/**
 * What a parity launch adds to the composition root's ShellLaunch: the S3 consent moment is held
 * by the consent moment host (host wiring), not by the startup. The host shows ConsentIntroScreen
 * and keeps it up while isConsentMomentHeld() is true, and never asks Google's form.
 */
export type ParityShellLaunch = ShellLaunch & {
  readonly isConsentMomentHeld?: () => boolean;
};

/**
 * True for the S3 consent-moment frame: its plan starts on Consent (consent required, online,
 * tutorial done, not Premium) and the harness holds that start.
 */
export function isHeldParityConsent(request: ParityRequest): boolean {
  return request.plan.start === 'Consent' && TEST_ONLY?.isHeldParityStart(request.plan) === true;
}

/**
 * The composition root's ShellLaunch for a parity frame (start-shell passes it to createShellApp):
 * the frame's player data and date after hydrateSave (with no saved debug flag left), the fixture
 * store and stand-in ads ports, the frame's route stack and the harness contexts around the root.
 * A store build gets no launch.
 */
export function parityLaunchFor<T extends ShellGameTypes>(
  input: ParityLaunchInput<T>,
): ParityShellLaunch {
  const { request, game, debugStore } = input;
  const api = TEST_ONLY;
  if (api === null) return {};
  return {
    prepareSave: (save, simulatedClock) => {
      applyParityData({ parity: request, game, save, simulatedClock, debugStore });
    },
    purchasePort: (productId) => api.createParityPurchase({ productId, plan: request.plan }),
    adsPort: () => api.createParityAds(),
    initialState: () => parityStartState(request),
    wrapRoot: (root) => withParityRoot(request, root),
    isConsentMomentHeld: () => isHeldParityConsent(request),
  };
}

/** True when start-shell must keep the S1 splash up instead of starting the Shell (frame s1). */
export function isHeldParitySplash(request: ParityRequest): boolean {
  return request.plan.start === 'Splash' && TEST_ONLY?.isHeldParityStart(request.plan) === true;
}
