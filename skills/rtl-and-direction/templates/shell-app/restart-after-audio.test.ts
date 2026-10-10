// packages/shell/src/app/restart-after-audio.test.ts
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

import { restartAfterAudio } from './restart-after-audio.ts';

import type { DirectionGuard } from '@e07/shell/i18n/direction-guard.ts';

const mockOrder: string[] = [];

jest.mock('@e07/shell/i18n/direction.ts', () => ({
  restartForDirection: jest.fn(() => {
    mockOrder.push('restart');
    return Promise.resolve();
  }),
}));

const GUARD: DirectionGuard = { readPending: () => null, writePending: () => undefined };

// Spec S2 and 7.2: a direction flip restarts the app once, audio disposed first.
describe('restartAfterAudio', () => {
  beforeEach(() => {
    mockOrder.length = 0;
  });

  it('disposes the audio first, then restarts in the new direction', async () => {
    const audio = {
      dispose: () => {
        mockOrder.push('dispose');
        return Promise.resolve();
      },
    };

    const onDisposeError = jest.fn();

    await restartAfterAudio({ audio, guard: GUARD, onDisposeError }, 'rtl');

    expect(mockOrder).toStrictEqual(['dispose', 'restart']);
    expect(restartForDirection).toHaveBeenCalledWith('rtl', GUARD);
    expect(onDisposeError).not.toHaveBeenCalled();
  });

  // The save already holds the new language: skipping the reload would leave the layout in the old
  // direction until the next cold start, so a failed dispose is reported and the reload goes ahead.
  it('reports a failed dispose, then still restarts in the new direction', async () => {
    const audio = { dispose: () => Promise.reject(new Error('busy')) };
    const onDisposeError = jest.fn((error: unknown) => {
      mockOrder.push(`reported ${String(error)}`);
    });

    await restartAfterAudio({ audio, guard: GUARD, onDisposeError }, 'rtl');

    expect(mockOrder).toStrictEqual(['reported Error: busy', 'restart']);
    expect(restartForDirection).toHaveBeenCalledWith('rtl', GUARD);
  });
});
