// packages/shell/src/ui/row-button.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { IconTile } from './icon-tile.tsx';
import { KeyButton } from './key-button.tsx';
import { RatingStar } from './rating-star.tsx';
import { RowButton } from './row-button.tsx';

import type { ViewStyle } from 'react-native';

const COLORS = TEST_PALETTE.standard.light;

describe('RowButton', () => {
  it('reads label and description as one button name', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <RowButton
        label="Endless - Best 4,210"
        description="Play until the wall falls"
        icon="endless"
        iconPaint="accent"
        onPress={onPress}
        testID="home.endless-card"
        isReducedMotion={false}
      />,
    );

    await user.press(
      screen.getByRole('button', { name: 'Endless - Best 4,210, Play until the wall falls' }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('home.endless-card.description')).toHaveStyle({
      color: COLORS.textMuted,
      fontSize: 14,
    });
  });

  it('paints the Premium key in pop with onPop text', async () => {
    await renderWithShell(
      <RowButton
        label="Premium"
        icon="crown"
        iconPaint="gold"
        onPress={jest.fn()}
        testID="home.premium-button"
        kind="pop"
        isReducedMotion={false}
      />,
    );

    expect(screen.getByTestId('home.premium-button.label')).toHaveStyle({ color: COLORS.onPop });
  });
});

describe('KeyButton', () => {
  it('names the key after its label', async () => {
    await renderWithShell(
      <KeyButton
        icon="grid"
        label="Levels"
        onPress={jest.fn()}
        testID="home.levels-key"
        isReducedMotion={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Levels' })).toBeOnTheScreen();
    expect(screen.getByText('Levels')).toHaveStyle({ fontSize: 15, fontFamily: 'Rubik-Bold' });
  });

  it('keeps its content height inside a Home pair cell (no zero flex basis, spec S4)', async () => {
    // Home wraps each key in a column cell (usePairLayout); flex: 1 there is a zero vertical basis,
    // which collapsed the same row of Pause keys to 0 pt on the device.
    await renderWithShell(
      <KeyButton
        icon="grid"
        label="Levels"
        onPress={jest.fn()}
        testID="home.levels-button"
        isReducedMotion
      />,
    );
    const key: ViewStyle =
      StyleSheet.flatten(
        screen.getByTestId('home.levels-button').props['style'] as ViewStyle | undefined,
      ) ?? {};
    expect(key).toMatchObject({ flexGrow: 1 });
    expect(key.flexBasis ?? 'auto').toBe('auto');
    expect(key.flex).toBeUndefined();
  });
});

describe('IconTile and RatingStar', () => {
  it('hides decorative tiles from VoiceOver', async () => {
    await renderWithShell(<IconTile icon="calendar" />);

    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
  });

  it('stacks a fill and an edge for a filled star', async () => {
    const view = await renderWithShell(<RatingStar isFilled size={22} />);

    expect(view.toJSON()).toMatchObject({ children: [{}, {}] });
  });

  it('draws only the edge for a hollow star', async () => {
    const view = await renderWithShell(<RatingStar isFilled={false} size={13} />);

    expect(view.toJSON()).toMatchObject({ children: [{}] });
  });
});
