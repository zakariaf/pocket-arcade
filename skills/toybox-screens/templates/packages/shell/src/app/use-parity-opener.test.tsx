// packages/shell/src/app/use-parity-opener.test.tsx
// no-shell-context: the hook reads only the parity session (TEST_ONLY) and calls what it is given.
import { renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from './parity/parity-plans.ts';
import { endParitySession, startParitySession } from './parity/parity-session.ts';
import { useParityOpener } from './use-parity-opener.ts';

function startFrame(frame: 's14-progress-restored' | 's4-home'): void {
  startParitySession({
    frame,
    plan: PARITY_PLANS[frame],
    theme: 'light',
    lang: 'en',
    game: 'lineSiege',
    date: '2026-09-27',
    scrollY: 0,
  });
}

describe('useParityOpener', () => {
  afterEach(() => {
    endParitySession();
  });

  it("opens the frame's state once on mount, through the handler it is given", async () => {
    startFrame('s14-progress-restored');
    const open = jest.fn();
    const view = await renderHook(() => {
      useParityOpener('save-restored-dialog', open);
    });
    await view.rerender(undefined);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a normal launch or in a frame that shows another state', async () => {
    const open = jest.fn();
    await renderHook(() => {
      useParityOpener('save-restored-dialog', open);
    });
    startFrame('s4-home');
    await renderHook(() => {
      useParityOpener('save-restored-dialog', open);
    });
    expect(open).not.toHaveBeenCalled();
  });
});
