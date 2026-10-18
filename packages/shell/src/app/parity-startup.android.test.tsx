// packages/shell/src/app/parity-startup.android.test.tsx
// no-shell-context: the startup runs before any Shell provider exists; the roots it returns bring their own contexts.
// Runs in the unit-android project (Platform.OS === 'android'). On Android a parity capture
// (capture-app.mjs --platform android) starts the activity with "am start ... --es parity <query>";
// the Shell's ParityLaunch native module hands that launch intent's extra to the harness.
import { Platform } from 'react-native';

import { endParitySession, parityFrameState } from '@e07/shell/app/parity/parity-session.ts';

import { readParityLaunch } from './parity-startup.tsx';

const QUERY =
  'frame=s8-levels&theme=dark&lang=fa&game=lineSiege&date=2026-09-27&animations=off&nonce=0a1b2c3d4e5f';

/** The string extras of this launch's intent, as the native module reads them. */
let mockLaunchExtras: Readonly<Record<string, string>> = {};

jest.mock('expo', () => ({
  ...jest.requireActual<Record<string, unknown>>('expo'),
  requireOptionalNativeModule: (name: string) =>
    name === 'ParityLaunch'
      ? { getLaunchExtra: (key: string): string | null => mockLaunchExtras[key] ?? null }
      : null,
}));

describe('readParityLaunch on Android', () => {
  afterEach(() => {
    mockLaunchExtras = {};
    endParitySession();
  });

  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('opens the frame named by the launch intent extra "parity"', () => {
    mockLaunchExtras = { parity: QUERY };

    expect(readParityLaunch()).toMatchObject({
      kind: 'frame',
      request: { frame: 's8-levels', theme: 'dark', lang: 'fa', nonce: '0a1b2c3d4e5f' },
    });
    expect(parityFrameState()).toBe('levels-locked-tile-tapped');
  });

  it('starts normally when the launch carries no parity extra', () => {
    expect(readParityLaunch()).toStrictEqual({ kind: 'normal' });
  });

  it('shows the error view for a malformed parity extra, never Home', () => {
    mockLaunchExtras = { parity: 'frame=s99-nowhere&theme=dark' };

    expect(readParityLaunch()).toMatchObject({ kind: 'error' });
  });
});
