// packages/shell/src/game-host/use-game-lifecycle.test.ts
// no-shell-context: the hook reads only its input and the app-active flag, which the test flips.
import { renderHook } from '@testing-library/react-native';

import { useGameLifecycle } from './use-game-lifecycle.ts';

import type { LifecycleInput } from './use-game-lifecycle.ts';

const mockApp = { isActive: true };
jest.mock('@e07/shell/app/use-is-app-active.ts', () => ({
  useIsAppActive: () => mockApp.isActive,
}));

type Flags = Pick<LifecycleInput, 'isFocused' | 'isFullscreenAdShowing'>;

async function setup() {
  const calls: string[] = [];
  const input = (flags: Flags): LifecycleInput => ({
    ...flags,
    onPause: () => {
      calls.push('pause');
    },
    onResume: () => {
      calls.push('resume');
    },
    onFlags: (facts) => {
      calls.push(`flags ${JSON.stringify(facts)}`);
    },
  });
  const view = await renderHook(
    (flags: Flags) => {
      useGameLifecycle(input(flags));
    },
    { initialProps: { isFocused: true, isFullscreenAdShowing: false } },
  );
  return { calls, rerender: view.rerender };
}

describe('useGameLifecycle', () => {
  beforeEach(() => {
    mockApp.isActive = true;
  });

  it('runs the board while the app is active, the screen focused and no ad showing', async () => {
    const { calls } = await setup();
    expect(calls.filter((call) => !call.startsWith('flags'))).toStrictEqual(['resume']);
  });

  it('pauses for a full-screen ad and resumes after it', async () => {
    const { calls, rerender } = await setup();

    await rerender({ isFocused: true, isFullscreenAdShowing: true });
    await rerender({ isFocused: true, isFullscreenAdShowing: false });

    expect(calls.filter((call) => !call.startsWith('flags'))).toStrictEqual([
      'resume',
      'pause',
      'resume',
    ]);
  });

  it('pauses when the screen loses focus', async () => {
    const { calls, rerender } = await setup();

    await rerender({ isFocused: false, isFullscreenAdShowing: false });

    expect(calls.filter((call) => !call.startsWith('flags'))).toStrictEqual(['resume', 'pause']);
  });

  it('reports the three facts before each decision, for the board-clock trace', async () => {
    const { calls, rerender } = await setup();

    await rerender({ isFocused: true, isFullscreenAdShowing: true });

    expect(calls).toStrictEqual([
      'flags {"isAppActive":true,"isFocused":true,"isAdShowing":false}',
      'resume',
      'flags {"isAppActive":true,"isFocused":true,"isAdShowing":true}',
      'pause',
    ]);
  });
});
