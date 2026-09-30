// packages/shell/src/game-host/board-layout-probe.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EMPTY_LAYOUT } from '@e07/game-kit/geom/board-layout.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { BoardLayoutProbe, boardLayoutText } from './board-layout-probe.tsx';

import type { MeasureOrigin } from './board-layout-probe.tsx';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { ReactNode } from 'react';

const LAYOUT: BoardLayout = {
  width: 300,
  height: 300,
  isMirrored: false,
  regions: [{ id: 'grid', x: 6, y: 6, cell: 48, cols: 6, rows: 6 }],
};
const ORIGIN = { x: 20, y: 140 };
const measureAt: MeasureOrigin = (_view, done) => {
  done(ORIGIN);
};

function Probe({ layout }: { readonly layout: BoardLayout }): ReactNode {
  const shared = useSharedValue(EMPTY_LAYOUT);
  useEffect(() => {
    shared.set(layout);
  }, [layout, shared]);
  return (
    <BoardLayoutProbe layout={shared} measureOrigin={measureAt}>
      <View testID="game.board-canvas" />
    </BoardLayoutProbe>
  );
}

describe('boardLayoutText', () => {
  it('holds the canvas origin in window points and the layout, as a flow parses it', () => {
    expect(JSON.parse(boardLayoutText(ORIGIN, LAYOUT))).toStrictEqual({
      ...ORIGIN,
      layout: LAYOUT,
    });
  });
});

describe('BoardLayoutProbe', () => {
  it('publishes game.board-layout once the canvas is measured and has a size', async () => {
    await renderWithShell(<Probe layout={LAYOUT} />);
    expect(screen.queryByTestId('game.board-layout')).not.toBeOnTheScreen();

    // The canvas's layout event reaches the probe's frame, which then measures its window origin.
    await fireEvent(screen.getByTestId('game.board-canvas'), 'layout');

    expect(await screen.findByTestId('game.board-layout')).toHaveTextContent(
      boardLayoutText(ORIGIN, LAYOUT),
    );
  });

  it('keeps its text inside the board frame, so a parity board mask always covers it', async () => {
    await renderWithShell(<Probe layout={LAYOUT} />);
    await fireEvent(screen.getByTestId('game.board-canvas'), 'layout');
    const text = await screen.findByTestId('game.board-layout');

    // The frame is the canvas's parent: it clips, so the probe never draws over the Shell chrome.
    const frame = screen.getByTestId('game.board-canvas').parent;
    // allow-style-assertion: the clip is the contract that keeps the text inside the parity board mask
    expect(frame).toHaveStyle({ overflow: 'hidden' });
    // The probe's box spans the frame from start to end, so a long layout text wraps inside it.
    const box = text.parent;
    // allow-style-assertion: the box spanning the frame is the contract (the mask covers the frame)
    expect(box).toHaveStyle({
      position: 'absolute',
      insetBlockStart: 0,
      insetInlineStart: 0,
      insetInlineEnd: 0,
    });
    expect(box?.parent).toBe(frame);
  });

  it('shows nothing while the canvas has no size', async () => {
    await renderWithShell(<Probe layout={EMPTY_LAYOUT} />);

    await fireEvent(screen.getByTestId('game.board-canvas'), 'layout');

    expect(screen.queryByTestId('game.board-layout')).not.toBeOnTheScreen();
    expect(screen.getByTestId('game.board-canvas')).toBeOnTheScreen();
  });
});
