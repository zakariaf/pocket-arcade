// packages/shell/src/app/parity-startup.test.tsx
// no-shell-context: the startup runs before any Shell provider exists; the roots it returns bring their own contexts.
import { render, screen } from '@testing-library/react-native';
import { createElement, use } from 'react';
import { View } from 'react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import {
  endParitySession,
  parityFrameState,
  startParitySession,
} from '@e07/shell/app/parity/parity-session.ts';
import { ForcedAdPlacementsContext } from '@e07/shell/app/use-ad-context.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import {
  applyParityData,
  initialStateFor,
  isHeldParityConsent,
  isHeldParitySplash,
  parityAdsPort,
  parityLaunchFor,
  parityStorePort,
  readParityLaunch,
  withParityRoot,
} from './parity-startup.tsx';

import type { ParityRequest } from '@e07/shell/app/parity/parity-request.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { ReactNode } from 'react';

const REQUEST: ParityRequest = {
  frame: 's8-levels',
  plan: PARITY_PLANS['s8-levels'],
  theme: 'dark',
  lang: 'fa',
  game: 'lineSiege',
  date: '2026-09-27',
  scrollY: 0,
};

function fakeClock(): SimulatedClock {
  return {
    nowMs: () => 0,
    today: () => '2026-09-26',
    msUntilNextLocalDay: () => 1,
    setSimulatedToday: jest.fn(),
    simulatedToday: () => null,
  };
}

/** Reports the forced banner placements as its accessibility label. */
function PlacementsProbe(): ReactNode {
  const placements = use(ForcedAdPlacementsContext);
  return <View testID="parity.probe" accessibilityLabel={placements.join(',')} />;
}

describe('readParityLaunch', () => {
  afterEach(() => {
    endParitySession();
  });

  it('starts normally without -parity', () => {
    expect(readParityLaunch(() => null)).toStrictEqual({ kind: 'normal' });
  });

  it('shows the error view for a malformed request, never Home', async () => {
    const launch = readParityLaunch(() => ({ ok: false, error: 'missing frame' }));
    if (launch.kind !== 'error') throw new Error(`expected the error view, got ${launch.kind}`);

    await render(createElement(launch.root));

    expect(screen.getByTestId('parity.error')).toHaveProp('accessibilityLabel', 'missing frame');
  });

  it('starts the frame session with the request', () => {
    expect(readParityLaunch(() => ({ ok: true, request: REQUEST }))).toStrictEqual({
      kind: 'frame',
      request: REQUEST,
    });
    expect(parityFrameState()).toBe('levels-locked-tile-tapped');
  });
});

describe('applyParityData', () => {
  it('writes the frame player through the save service and moves today to the frame date', () => {
    const { save } = createTestSave();
    const simulatedClock = fakeClock();

    applyParityData({ parity: REQUEST, game: TALLY_GAME, save, simulatedClock });

    expect(save.doc().progress.endlessBest).toBe(4210);
    expect(save.doc().settings.language).toBe('fa');
    expect(simulatedClock.setSimulatedToday).toHaveBeenCalledWith('2026-09-27');
  });

  it('changes nothing on a normal launch', () => {
    const { save } = createTestSave();
    const before = save.doc();

    applyParityData({ parity: null, game: TALLY_GAME, save, simulatedClock: null });

    expect(save.doc()).toBe(before);
  });
});

describe('the parity ports and the first route', () => {
  it('uses the real ports and the resume state on a normal launch', () => {
    const normal = { routes: [{ name: 'Home' }] };

    expect(parityStorePort(null, 'premium')).toBeNull();
    expect(parityAdsPort(null)).toBeNull();
    expect(initialStateFor(null, normal)).toBe(normal);
  });

  it('uses the fixture store, the stand-in ads and the plan route on a parity launch', async () => {
    const store = parityStorePort(REQUEST, 'premium');

    await expect(store?.fetchProduct('premium')).resolves.toMatchObject({
      price: 1.99,
      currency: 'EUR',
    });
    expect(parityAdsPort(REQUEST)?.isRewardedLoaded()).toBe(true);
    expect(initialStateFor(REQUEST, undefined)).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Levels' }],
    });
  });
});

describe('withParityRoot', () => {
  it('returns the root unchanged on a normal launch', () => {
    expect(withParityRoot(null, PlacementsProbe)).toBe(PlacementsProbe);
  });

  it('wraps the root in the harness contexts on a parity launch', async () => {
    await render(createElement(withParityRoot(REQUEST, PlacementsProbe)));

    expect(screen.getByTestId('parity.probe')).toHaveProp(
      'accessibilityLabel',
      'home,levels,stats,result',
    );
  });
});

describe('parityLaunchFor', () => {
  it('gives the composition root the frame data, ports, route and root wrapper', async () => {
    const launch = parityLaunchFor({ request: REQUEST, game: TALLY_GAME });
    const { save } = createTestSave();
    const simulatedClock = fakeClock();

    launch.prepareSave?.(save, simulatedClock);

    expect(save.doc().progress.endlessBest).toBe(4210);
    expect(simulatedClock.setSimulatedToday).toHaveBeenCalledWith('2026-09-27');
    await expect(launch.purchasePort?.('premium').fetchProduct('premium')).resolves.toMatchObject({
      price: 1.99,
    });
    expect(launch.adsPort?.().isRewardedLoaded()).toBe(true);
    expect(launch.initialState?.()).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Levels' }],
    });
    await render(createElement(launch.wrapRoot?.(PlacementsProbe) ?? PlacementsProbe));
    expect(screen.getByTestId('parity.probe')).toHaveProp(
      'accessibilityLabel',
      'home,levels,stats,result',
    );
  });

  it('holds the splash only for the S1 frame', () => {
    expect(isHeldParitySplash(REQUEST)).toBe(false);
    expect(
      isHeldParitySplash({ ...REQUEST, frame: 's1-splash', plan: PARITY_PLANS['s1-splash'] }),
    ).toBe(true);
  });

  it('starts a fresh run of the frame level for the board probe, so no Pause hides the probe', () => {
    const pause: ParityRequest = { ...REQUEST, frame: 's6-pause', plan: PARITY_PLANS['s6-pause'] };
    startParitySession({ ...pause, probe: 'board' });

    expect(
      parityLaunchFor({ request: { ...pause, probe: 'board' }, game: TALLY_GAME }).initialState?.(),
    ).toStrictEqual({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'Game', params: { start: 'new', ref: { kind: 'level', level: 12 } } },
      ],
    });
    expect(initialStateFor({ ...pause, probe: 'board' }, undefined)).toMatchObject({ index: 1 });
    expect(parityLaunchFor({ request: pause, game: TALLY_GAME }).initialState?.()).toStrictEqual({
      index: 1,
      routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }],
    });
    endParitySession();
  });

  it('hands the consent moment host the S3 hold, and only for the S3 frame', () => {
    const consent: ParityRequest = {
      ...REQUEST,
      frame: 's3-consent-moment',
      plan: PARITY_PLANS['s3-consent-moment'],
    };

    expect(isHeldParityConsent(REQUEST)).toBe(false);
    expect(isHeldParityConsent(consent)).toBe(true);
    expect(parityLaunchFor({ request: consent, game: TALLY_GAME }).isConsentMomentHeld?.()).toBe(
      true,
    );
    expect(parityLaunchFor({ request: REQUEST, game: TALLY_GAME }).isConsentMomentHeld?.()).toBe(
      false,
    );
  });
});
