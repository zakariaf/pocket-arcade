// packages/shell/src/screens/levels/pack-section.test.tsx
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { PackSection } from './pack-section.tsx';

import type { LevelPackModel } from './levels-model.ts';
import type { useWindowDimensions } from 'react-native';

type WindowMetrics = ReturnType<typeof useWindowDimensions>;

const mockWindow: { current: WindowMetrics } = {
  current: { width: 402, height: 874, fontScale: 1, scale: 3 },
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow.current,
}));

const PACK: LevelPackModel = {
  number: 1,
  name: 'Green meadow',
  levelsCount: 30,
  earnedStars: 28,
  totalStars: 90,
  progress: 28 / 90,
  isLocked: false,
  unlockStars: 0,
  missingStars: 0,
  tiles: [{ level: 1, numberText: '1', state: { kind: 'current' } }],
};

async function headingBoxStyle(): Promise<Record<string, unknown>> {
  await renderWithShell(
    <PackSection pack={PACK} focusedLevel={null} isReducedMotion={false} onPressTile={jest.fn()} />,
  );
  const heading = screen.getByTestId('levels.pack.1.heading');
  // The heading's own wrapper View is the flex item beside the level count.
  return StyleSheet.flatten(heading.parent?.props['style']) as Record<string, unknown>;
}

describe('PackSection', () => {
  it('keeps the heading and the level count on one row at normal text size', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 1, scale: 3 };

    // allow-style-assertion: the row-or-stack layout of the header is the behaviour under test.
    expect(await headingBoxStyle()).toStrictEqual({ flex: 1 });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it('stacks the level count under the heading at 200 % text (spec 8.11)', async () => {
    mockWindow.current = { width: 402, height: 874, fontScale: 2, scale: 3 };

    // allow-style-assertion: a full-width heading pushes "30 levels" onto its own line instead
    // of squeezing "Pack 1 – Green meadow" into three lines beside it.
    expect(await headingBoxStyle()).toStrictEqual({ flexGrow: 1, flexBasis: '100%' });
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
