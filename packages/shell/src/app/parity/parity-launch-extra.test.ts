// packages/shell/src/app/parity/parity-launch-extra.test.ts
import { androidLaunchExtras, launchExtrasReader } from './parity-launch-extra.ts';

import type { ParityLaunchModule } from './parity-launch-extra.ts';

/** The string extras of this launch's intent, as the native module reads them. */
let mockLaunchExtras: Readonly<Record<string, string>> = {};

jest.mock('expo', () => ({
  ...jest.requireActual<Record<string, unknown>>('expo'),
  requireOptionalNativeModule: (name: string) =>
    name === 'ParityLaunch'
      ? { getLaunchExtra: (key: string): string | null => mockLaunchExtras[key] ?? null }
      : null,
}));

function moduleWith(extras: Readonly<Record<string, string>>): ParityLaunchModule {
  return { getLaunchExtra: (key) => extras[key] ?? null };
}

describe('launchExtrasReader', () => {
  it('reads the launch intent string extra the native module hands back', () => {
    const reader = launchExtrasReader(moduleWith({ parity: 'frame=s4-home&theme=light' }));

    expect(reader.get('parity')).toBe('frame=s4-home&theme=light');
  });

  it('returns null for an extra this launch did not carry', () => {
    expect(launchExtrasReader(moduleWith({})).get('parity')).toBeNull();
  });

  it('returns null without the native module, so the start is a normal one', () => {
    expect(launchExtrasReader(null).get('parity')).toBeNull();
  });
});

describe('androidLaunchExtras', () => {
  afterEach(() => {
    mockLaunchExtras = {};
  });

  it('reads through the Shell native module named ParityLaunch', () => {
    mockLaunchExtras = { parity: 'frame=s8-levels&theme=dark' };

    expect(androidLaunchExtras().get('parity')).toBe('frame=s8-levels&theme=dark');
  });
});
