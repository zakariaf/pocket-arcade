// packages/shell/src/screens/game/game-layout.test.tsx
import { screen, within } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { GameLayout } from './game-layout.tsx';

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
  const frame = screen.getByTestId('game.screen');
  const column = styleOf(screen.getByTestId('game.board').parent);
  const maxWidth = typeof column['maxWidth'] === 'number' ? column['maxWidth'] : windowWidth;
  const width = column['width'] === '100%' ? Math.min(windowWidth, maxWidth) : Number.NaN;
  return { frame: styleOf(frame), column, width, side: (windowWidth - width) / 2 };
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
      within(screen.getByTestId('game.screen')).queryByTestId('probe.overlay'),
    ).not.toBeOnTheScreen();
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
      within(screen.getByTestId('game.screen')).queryByTestId('probe.overlay'),
    ).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);

    const phone = await boardColumnAt(402, 874);
    expect([phone.width, phone.side]).toStrictEqual([402, 0]);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
