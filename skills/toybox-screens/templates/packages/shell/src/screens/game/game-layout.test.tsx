// packages/shell/src/screens/game/game-layout.test.tsx
import { screen, within } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameLayout } from './game-layout.tsx';

import type { ReactNode } from 'react';
import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

type Box = { readonly props: Record<string, unknown> } | null | undefined;

// allow-style-assertion: Jest has no layout engine; the centred column is its styles.
function styleOf(node: Box): Record<string, unknown> {
  return (StyleSheet.flatten(node?.props['style'] as never) ?? {}) as Record<string, unknown>;
}

/** The S5 column the board sits in, laid out in a window `windowWidth` points wide. */
async function boardColumnAt(windowWidth: number, windowHeight: number) {
  mockWindow.current = { width: windowWidth, height: windowHeight, fontScale: 1, scale: 2 };
  await renderWithShell(
    <GameLayout
      topBar={null}
      board={<View testID="probe.board" />}
      overlay={<View testID="probe.overlay" />}
    />,
  );
  // The overlay hides the frame behind it from TalkBack (Android's focus trap), so reach it hidden.
  const frame = screen.getByTestId('game.screen', { includeHiddenElements: true });
  const column = styleOf(screen.getByTestId('game.board', { includeHiddenElements: true }).parent);
  const maxWidth = typeof column['maxWidth'] === 'number' ? column['maxWidth'] : windowWidth;
  const width = column['width'] === '100%' ? Math.min(windowWidth, maxWidth) : Number.NaN;
  return { frame: styleOf(frame), column, width, side: (windowWidth - width) / 2 };
}

type HostNode = { readonly parent: HostNode | null; readonly props: Record<string, unknown> };

/** The nearest ancestor that hides its subtree from TalkBack (Android's focus trap), if any. */
function trapAbove(node: HostNode): HostNode | null {
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.props['importantForAccessibility'] === 'no-hide-descendants') return at;
  }
  return null;
}

/** A board that counts its mounts: the trap must never remount it. */
function CountingBoard({ onMount }: { readonly onMount: () => void }): ReactNode {
  useEffect(onMount, [onMount]);
  return <View testID="probe.board" />;
}

describe('GameLayout', () => {
  it('keeps the top bar and the board inside the safe-area frame (spec S5)', async () => {
    await renderWithShell(
      <GameLayout
        topBar={<View testID="probe.top-bar" />}
        board={<View testID="probe.board" />}
        overlay={null}
      />,
    );
    const frame = within(screen.getByTestId('game.screen'));
    expect(frame.getByTestId('probe.top-bar')).toBeOnTheScreen();
    expect(within(frame.getByTestId('game.board')).getByTestId('probe.board')).toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('draws Pause and Result over the whole screen, outside the safe-area frame (spec S6, S7)', async () => {
    // Result and Pause bring their own frame and scrim: inside game.screen's safe area they were
    // inset twice (the result sat 59 pt low and its bottom buttons were clipped on the device).
    await renderWithShell(
      <GameLayout topBar={null} board={null} overlay={<View testID="probe.overlay" />} />,
    );
    expect(screen.getByTestId('probe.overlay')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('game.screen', { includeHiddenElements: true })).queryByTestId(
        'probe.overlay',
      ),
    ).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('hides the board from TalkBack while Pause or Result covers it, without remounting it (spec 8.11, S6, S7)', async () => {
    // accessibilityViewIsModal (the Scrim, ResultOverlay) is iOS-only: on Android only the screen
    // behind can be hidden, and importantForAccessibility hides a subtree, never a sibling.
    const onMount = jest.fn();
    const board = <CountingBoard onMount={onMount} />;
    const hidden = { includeHiddenElements: true } as const;
    const { rerender } = await renderWithShell(
      <GameLayout topBar={null} board={board} overlay={null} />,
    );
    const openFrame = screen.getByTestId('game.screen');
    expect(trapAbove(openFrame)).toBeNull();

    await rerender(
      <GameLayout topBar={null} board={board} overlay={<View testID="probe.overlay" />} />,
    );
    const coveredFrame = screen.getByTestId('game.screen', hidden);
    expect(trapAbove(coveredFrame)).not.toBeNull();
    // Still mounted, but out of the accessibility tree; the overlay stays in it.
    expect(screen.getByTestId('game.board', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('game.board')).not.toBeOnTheScreen();
    const overlay = screen.getByTestId('probe.overlay');
    expect(trapAbove(overlay)).toBeNull();

    await rerender(<GameLayout topBar={null} board={board} overlay={null} />);
    const reopenedFrame = screen.getByTestId('game.screen');
    expect(trapAbove(reopenedFrame)).toBeNull();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('centres a board column at most 640 pt wide on a landscape iPad, ground on both sides (spec S5)', async () => {
    const ipad = await boardColumnAt(1366, 1024);
    expect([ipad.width, ipad.side]).toStrictEqual([640, 363]);
    expect(ipad.frame).toMatchObject({ alignItems: 'center', flex: 1 });
    expect(ipad.frame['backgroundColor']).toStrictEqual(expect.any(String));
    expect(ipad.column['backgroundColor']).toBeUndefined();
    // The overlay is the frame's sibling, so it still covers the whole window.
    expect(
      within(screen.getByTestId('game.screen', { includeHiddenElements: true })).queryByTestId(
        'probe.overlay',
      ),
    ).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    const phone = await boardColumnAt(402, 874);
    expect([phone.width, phone.side]).toStrictEqual([402, 0]);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
