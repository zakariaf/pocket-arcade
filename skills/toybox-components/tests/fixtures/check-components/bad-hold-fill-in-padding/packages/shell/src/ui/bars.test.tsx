// packages/shell/src/ui/bars.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { BannerBand } from './banner-band.tsx';
import { BrandLock } from './brand-lock.tsx';
import { GameTopBar } from './game-top-bar.tsx';
import { TopBar } from './top-bar.tsx';

import type { ViewStyle } from 'react-native';

/** The Home frame's window (iPhone 16 Pro, 402 pt): the banner slot is that wide. */
const WINDOW_WIDTH = 402;
const MARGIN_KEYS = ['margin', 'marginHorizontal', 'marginInline'] as const;

type HostNode = { readonly props: { readonly style?: unknown } };

/** Where a stretched block lands in its parent: its start offset and width from its margins. */
function bandSpan(node: unknown, parentWidth: number): { start: number; width: number } {
  const style = StyleSheet.flatten((node as HostNode).props.style as ViewStyle | undefined) ?? {};
  const shared = MARGIN_KEYS.reduce((sum, key) => sum + Number(style[key] ?? 0), 0);
  const start = shared + Number(style.marginStart ?? 0);
  const end = shared + Number(style.marginEnd ?? 0);
  return {
    start,
    width: style.width === undefined ? parentWidth - start - end : Number(style.width),
  };
}

describe('TopBar', () => {
  it('shows a back key and a heading title', async () => {
    const onBack = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <TopBar
        testID="settings.top-bar"
        title="Settings"
        onBack={onBack}
        backLabel="Back"
        isReducedMotion
      />,
    );

    expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('settings.top-bar.back-button')).toBeOnTheScreen();
  });

  it('puts the brand lock at the start on Home instead of a back key', async () => {
    await renderWithShell(
      <TopBar
        testID="home.top-bar"
        isReducedMotion
        start={
          <BrandLock
            logo={<View testID="home.logo-tile" />}
            gameName="Line Siege"
            testID="home.brand-lock"
            nameTestID="home.game-name"
          />
        }
      />,
    );

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByTestId('home.game-name')).toHaveTextContent(/Line Siege/u);
    expect(screen.getByTestId('home.game-name')).toHaveStyle({ fontSize: 28 });
  });
});

describe('GameTopBar', () => {
  it('uses the game.* ids and small undo and hint keys', async () => {
    const onUndo = jest.fn();
    const user = userEvent.setup();
    await renderWithShell(
      <GameTopBar
        testIDBase="game"
        pauseLabel="Pause"
        onPause={jest.fn()}
        modeText="Level 12"
        progressText="3 of 10 monsters defeated"
        scoreText="1,240"
        undo={{ label: 'Undo', onPress: onUndo }}
        hint={{ label: 'Hint', onPress: jest.fn(), isDisabled: true }}
        isReducedMotion
      />,
    );

    for (const id of ['top-bar', 'pause-button', 'mode-label', 'progress-label', 'score']) {
      expect(screen.getByTestId(`game.${id}`)).toBeOnTheScreen();
    }
    await user.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('BannerBand', () => {
  it('takes no space until an ad has loaded', async () => {
    await renderWithShell(
      <BannerBand isVisible={false} testID="home.banner-slot">
        <View testID="home.ad-banner" />
      </BannerBand>,
    );
    expect(screen.queryByTestId('home.banner-slot')).not.toBeOnTheScreen();
  });

  it('spans the window width in the pinned slot, on the neutral ad paint', async () => {
    // The slot is pinned under the scrolling body, outside its 20 pt gutters (full bleed by place).
    await renderWithShell(
      <View style={{ width: WINDOW_WIDTH }}>
        <BannerBand isVisible testID="home.banner-slot">
          <View testID="home.ad-banner" />
        </BannerBand>
      </View>,
    );
    const band = screen.getByTestId('home.banner-slot');

    expect(bandSpan(band, WINDOW_WIDTH)).toStrictEqual({ start: 0, width: WINDOW_WIDTH });
    expect(band).toHaveStyle({
      backgroundColor: SHELL_COLORS.light.adBackground,
      borderStyle: 'dashed',
    });
  });
});
