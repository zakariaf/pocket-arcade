// packages/shell/src/game-host/board-layout-probe.android.test.tsx
import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { PixelRatio, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { EMPTY_LAYOUT } from '@e07/game-kit/geom/board-layout.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { BoardLayoutProbe } from './board-layout-probe.tsx';

import type { MeasureOrigin } from './board-layout-probe.tsx';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { ReactNode } from 'react';

const LAYOUT: BoardLayout = {
  width: 300,
  height: 300,
  isMirrored: false,
  regions: [{ id: 'grid', x: 6, y: 6, cell: 48, cols: 6, rows: 6 }],
};
const measureAt: MeasureOrigin = (_view, done) => {
  done({ x: 20, y: 140 });
};

function Probe(): ReactNode {
  const shared = useSharedValue(EMPTY_LAYOUT);
  useEffect(() => {
    shared.set(LAYOUT);
  }, [shared]);
  return (
    <BoardLayoutProbe layout={shared} measureOrigin={measureAt}>
      <View testID="game.board-canvas" />
    </BoardLayoutProbe>
  );
}

describe('BoardLayoutProbe on Android', () => {
  it("gives a flow the density, because Maestro's point taps on Android are pixels (E18-T24)", async () => {
    jest.spyOn(PixelRatio, 'get').mockReturnValue(2.625);
    await renderWithShell(<Probe />);
    await fireEvent(screen.getByTestId('game.board-canvas'), 'layout');

    const text = await screen.findByTestId('game.board-layout');

    expect(JSON.parse(String(text.props['children']))).toStrictEqual({
      x: 20,
      y: 140,
      layout: LAYOUT,
      tapScale: 2.625,
    });
  });
});
