// packages/shell/src/ui/tiles.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { ArtTile } from './art-tile.tsx';
import { Confetti } from './confetti.tsx';
import { LevelTile } from './level-tile.tsx';
import { PremiumArt } from './premium-art.tsx';
import { RatingStars } from './rating-stars.tsx';
import { ResultStars } from './result-stars.tsx';
import { Sticker } from './sticker.tsx';

import type { ViewStyle } from 'react-native';

const COLORS = TEST_PALETTE.standard.light;

type HostNode = { readonly props: { readonly style?: unknown }; readonly parent: HostNode | null };

/** The flattened style of the nearest ancestor of a part that sets a height or minimum height. */
function boxStyleAbove(testID: string): ViewStyle {
  let node: HostNode | null = (screen.getByTestId(testID) as unknown as HostNode).parent;
  while (node !== null) {
    const style = StyleSheet.flatten(node.props.style as ViewStyle | undefined) ?? {};
    if (style.minHeight !== undefined || style.height !== undefined) return style;
    node = node.parent;
  }
  return {};
}

describe('LevelTile', () => {
  it('names a completed tile and shows its stars part', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <LevelTile
        numberText="9"
        state={{ kind: 'completed', stars: 2 }}
        label="Level 9: 2 stars"
        onPress={onPress}
        testID="levels.level-tile.9"
        width={52}
        isReducedMotion
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Level 9: 2 stars' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('levels.level-tile.9.number')).toHaveStyle({ fontSize: 21 });
    expect(
      screen.getByTestId('levels.level-tile.9.stars-2', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('grows with large text: the face has a minimum height, never a fixed one', async () => {
    await renderWithShell(
      <LevelTile
        numberText="9"
        state={{ kind: 'completed', stars: 2 }}
        label="Level 9: 2 stars"
        onPress={jest.fn()}
        testID="levels.level-tile.9"
        width={52}
        isReducedMotion
      />,
    );

    const face = boxStyleAbove('levels.level-tile.9.number');
    expect(face.minHeight).toBe(62);
    expect(face.height).toBeUndefined();
  });

  it('gives a Persian level number a 1.45 line so iOS does not clip its digits (spec S8)', async () => {
    // At line height 1 iOS clipped the tops of Vazirmatn's digits; the tile keeps its 62 pt face.
    jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
    await renderWithShell(
      <LevelTile
        numberText="۱۲"
        state={{ kind: 'completed', stars: 2 }}
        label="مرحله ۱۲"
        onPress={jest.fn()}
        testID="levels.level-tile.12"
        width={52}
        isReducedMotion
      />,
      { language: 'fa' },
    );

    expect(screen.getByTestId('levels.level-tile.12.number')).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      fontSize: 21,
      lineHeight: 91 / 3,
    });
    expect(boxStyleAbove('levels.level-tile.12.number').minHeight).toBe(62);
  });

  it('gives the current tile its flag and accent number', async () => {
    await renderWithShell(
      <LevelTile
        numberText="12"
        state={{ kind: 'current' }}
        label="Level 12: no stars yet"
        onPress={jest.fn()}
        testID="levels.level-tile.12"
        width={52}
        isReducedMotion
      />,
    );

    expect(screen.getByTestId('levels.level-tile.12.flag')).toBeOnTheScreen();
    expect(screen.getByTestId('levels.level-tile.12.number')).toHaveStyle({
      color: COLORS.onPrimary,
    });
  });

  it('keeps a locked tile pressable so it can explain how to unlock it', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <LevelTile
        numberText="13"
        state={{ kind: 'locked' }}
        label="Level 13, locked"
        hint="Shows how to unlock this level."
        onPress={onPress}
        testID="levels.level-tile.13"
        width={52}
        isFocused
        isReducedMotion={false}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Level 13, locked' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('levels.level-tile.13.number')).toHaveStyle({
      color: COLORS.textMuted,
    });
  });
});

describe('Stars', () => {
  it('labels standalone rating stars as one image', async () => {
    await renderWithShell(<RatingStars count={2} size="rating" label="2 of 3 stars" />);

    expect(screen.getByRole('image', { name: '2 of 3 stars' })).toBeOnTheScreen();
  });

  it('shows the result stars as one labelled image, even under reduce motion', async () => {
    await renderWithShell(
      <ResultStars count={3} label="3 of 3 stars" testID="result.stars-3" isReducedMotion />,
    );

    expect(screen.getByRole('image', { name: '3 of 3 stars' })).toBeOnTheScreen();
  });
});

describe('Stickers and art', () => {
  it('prints sticker text in toy ink, white on the ink paper', async () => {
    await renderWithShell(
      <>
        <Sticker
          text="New best!"
          icon="rating-star"
          size="sm"
          tiltDeg={6}
          testID="result.new-best"
        />
        <Sticker
          text="Locked"
          icon="lock"
          paper="ink"
          size="sm"
          testID="levels.pack.2.locked-badge"
        />
      </>,
    );

    expect(screen.getByText('New best!')).toHaveStyle({
      color: '#1D1B3A',
      fontFamily: 'LilitaOne',
    });
    expect(screen.getByText('Locked')).toHaveStyle({ color: '#FFFFFF' });
    // One accessible text element per sticker: the testID and the label sit on the paper, so the
    // bounds are the whole tilted sticker (edge 2 as rendered), not its inner text.
    const paper = screen.getByTestId('result.new-best');
    expect(paper).toHaveAccessibleName('New best!');
    expect(paper).toHaveStyle({ borderWidth: 2 });
  });

  it('pads physically: 9 on the left and 11 on the right in both directions', async () => {
    await renderWithShell(<Sticker text="Premium" icon="crown" testID="home.premium-badge" />);
    expect(screen.getByTestId('home.premium-badge')).toHaveStyle({
      paddingStart: 9,
      paddingEnd: 11,
    });
  });

  it('keeps the larger pad on the right, next to the icon, in right-to-left', async () => {
    await renderWithShell(<Sticker text="پریمیوم" icon="crown" testID="home.premium-badge" />, {
      language: 'fa',
    });
    // Logical keys mirror in RTL, so start 11 / end 9 is physically left 9 / right 11.
    expect(screen.getByTestId('home.premium-badge')).toHaveStyle({
      paddingStart: 11,
      paddingEnd: 9,
    });
  });

  it('keeps art tiles, Premium art and confetti decorative', async () => {
    await renderWithShell(
      <>
        <ArtTile icon="globe" testID="language-choice.art" />
        <PremiumArt testID="premium.art" />
        <Confetti isReducedMotion={false} testID="premium.confetti" />
      </>,
    );

    expect(screen.queryByTestId('language-choice.art')).not.toBeOnTheScreen();
    expect(screen.getByTestId('premium.art', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByTestId('premium.confetti', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('keeps confetti on screen, at rest, when motion only holds still (a parity capture)', async () => {
    await renderWithShell(
      <Confetti isReducedMotion isHiddenBySetting={false} testID="premium.confetti" />,
    );

    expect(
      screen.getByTestId('premium.confetti', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('scatters the confetti from the physical left in both directions (the design sets left:)', async () => {
    await renderWithShell(
      <Confetti isReducedMotion isHiddenBySetting={false} testID="premium.confetti" />,
      { language: 'fa' },
    );

    // The band lays its pieces out left to right, so start: 10 is 10 pt from the left in fa too.
    expect(screen.getByTestId('premium.confetti', { includeHiddenElements: true })).toHaveStyle({
      direction: 'ltr',
    });
  });

  it('hides confetti entirely under reduce motion', async () => {
    await renderWithShell(<Confetti isReducedMotion testID="premium.confetti" />);

    expect(
      screen.queryByTestId('premium.confetti', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });
});
