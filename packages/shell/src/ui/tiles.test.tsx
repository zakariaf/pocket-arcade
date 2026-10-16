// packages/shell/src/ui/tiles.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { PixelRatio } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ancestorStyle, iconsIn } from '@e07/shell/testing/rendered-parts.ts';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { ArtTile } from './art-tile.tsx';
import { CalendarTile } from './calendar-tile.tsx';
import { COMPONENT_SPECS } from './component-specs.ts';
import { Confetti } from './confetti.tsx';
import { LevelTile } from './level-tile.tsx';
import { PremiumArt } from './premium-art.tsx';
import { RatingStars } from './rating-stars.tsx';
import { ResultStars } from './result-stars.tsx';
import { Sticker } from './sticker.tsx';
import { dieCutRing } from './toybox-styles.ts';
import { WeekStrip } from './week-strip.tsx';

import type { ViewStyle } from 'react-native';

const COLORS = TEST_PALETTE.standard.light;

// Each icon image carries its glyph name, so a test can tell one icon from another (the root mock
// gives every icon the same image).
jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: (name: string) => `icon:${name}`,
}));

/** The flattened style of the nearest ancestor of a part that sets a height or minimum height. */
function boxStyleAbove(testID: string): ViewStyle {
  return ancestorStyle(
    testID,
    (style) => style.minHeight !== undefined || style.height !== undefined,
  );
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

  it('draws a locked tile dashed, with a padlock where the stars go', async () => {
    await renderWithShell(
      <LevelTile
        numberText="13"
        state={{ kind: 'locked' }}
        label="Level 13, locked"
        onPress={jest.fn()}
        testID="levels.level-tile.13"
        width={52}
        isReducedMotion
      />,
    );

    expect(boxStyleAbove('levels.level-tile.13.number').borderStyle).toBe('dashed');
    expect(iconsIn('levels.level-tile.13')).toStrictEqual(['lock']);
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
  it('cuts every sticker out with the white die-cut ring', async () => {
    await renderWithShell(<Sticker text="Premium" icon="crown" testID="home.premium-badge" />);

    expect(screen.getByTestId('home.premium-badge')).toHaveStyle(
      dieCutRing(COMPONENT_SPECS.sticker.ring, SHELL_COLORS.light.cut),
    );
  });

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

  it('rasterizes tilted stickers and art tiles, so iOS draws their tilted edges smooth', async () => {
    await renderWithShell(
      <>
        <Sticker text="Phone language" size="sm" tiltDeg={3} testID="language-choice.phone-badge" />
        <ArtTile icon="globe" testID="language-choice.art" />
      </>,
    );

    // Fabric draws a border from an image it stretches with nearest filtering, so a tilted edge
    // steps at device pixels (the S2 globe tile on the device); a rasterized layer is resampled
    // smoothly when it is turned, as Chrome draws it.
    expect(screen.getByTestId('language-choice.phone-badge')).toHaveProp(
      'shouldRasterizeIOS',
      true,
    );
    expect(screen.getByTestId('language-choice.art', { includeHiddenElements: true })).toHaveProp(
      'shouldRasterizeIOS',
      true,
    );
  });

  it('rasterizes every other tilted printed part: flag, Today tag, calendar, Premium art, confetti', async () => {
    const hidden = { includeHiddenElements: true } as const;
    await renderWithShell(
      <>
        <LevelTile
          numberText="12"
          state={{ kind: 'current' }}
          label="Level 12: no stars yet"
          onPress={jest.fn()}
          testID="levels.level-tile.12"
          isReducedMotion
          width={54}
        />
        <WeekStrip
          testID="daily.week-strip"
          dayTestIDBase="daily.week-day"
          days={[{ letter: 'Sun', state: 'today', isToday: true, label: 'Today' }]}
          todayTagText="Today"
        />
        <CalendarTile monthText="Sep" dayText="27" testID="daily.today-card.calendar" />
        <PremiumArt testID="premium.art" />
        <Confetti isReducedMotion isHiddenBySetting={false} testID="premium.confetti" />
      </>,
    );

    // The S9 calendar's month band border stepped at device pixels under its -3 deg tilt until the
    // whole tile was one rasterized layer (TILTED_LAYER).
    for (const testID of [
      'levels.level-tile.12.flag',
      'daily.week-day.1.today-tag',
      'daily.today-card.calendar',
      'premium.art',
    ]) {
      expect(screen.getByTestId(testID, hidden)).toHaveProp('shouldRasterizeIOS', true);
    }
    const pieces = screen.getByTestId('premium.confetti', hidden).children;
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) expect(piece).toHaveProp('shouldRasterizeIOS', true);
  });

  it('gives every tilted printed part its Android hardware layer as well', async () => {
    const hidden = { includeHiddenElements: true } as const;
    await renderWithShell(
      <>
        <Sticker text="Phone language" size="sm" tiltDeg={3} testID="language-choice.phone-badge" />
        <ArtTile icon="globe" testID="language-choice.art" />
        <LevelTile
          numberText="12"
          state={{ kind: 'current' }}
          label="Level 12: no stars yet"
          onPress={jest.fn()}
          testID="levels.level-tile.12"
          isReducedMotion
          width={54}
        />
        <WeekStrip
          testID="daily.week-strip"
          dayTestIDBase="daily.week-day"
          days={[{ letter: 'Sun', state: 'today', isToday: true, label: 'Today' }]}
          todayTagText="Today"
        />
        <CalendarTile monthText="Sep" dayText="27" testID="daily.today-card.calendar" />
        <PremiumArt testID="premium.art" />
        <Confetti isReducedMotion isHiddenBySetting={false} testID="premium.confetti" />
      </>,
    );

    // Android ignores shouldRasterizeIOS: without its own flag the same parts turn with stepped
    // edges there. TILTED_LAYER carries both, so every part that turns through the primitive has both.
    for (const testID of [
      'language-choice.phone-badge',
      'language-choice.art',
      'levels.level-tile.12.flag',
      'daily.week-day.1.today-tag',
      'daily.today-card.calendar',
      'premium.art',
    ]) {
      const part = screen.getByTestId(testID, hidden);
      expect(part).toHaveProp('renderToHardwareTextureAndroid', true);
      expect(part).toHaveProp('shouldRasterizeIOS', true);
    }
    const pieces = screen.getByTestId('premium.confetti', hidden).children;
    expect(pieces.length).toBeGreaterThan(0);
    for (const piece of pieces) expect(piece).toHaveProp('renderToHardwareTextureAndroid', true);
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
