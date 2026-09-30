// packages/shell/src/ui/bars.test.tsx
import { screen, userEvent } from '@testing-library/react-native';
import { View } from 'react-native';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { BannerBand } from './banner-band.tsx';
import { BrandLock } from './brand-lock.tsx';
import { GameTopBar } from './game-top-bar.tsx';
import { TopBar } from './top-bar.tsx';

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

  it('bleeds past the body gutters on the neutral ad paint', async () => {
    await renderWithShell(
      <BannerBand isVisible testID="home.banner-slot">
        <View testID="home.ad-banner" />
      </BannerBand>,
    );
    expect(screen.getByTestId('home.banner-slot')).toHaveStyle({
      marginInline: -20,
      backgroundColor: SHELL_COLORS.light.adBackground,
      borderStyle: 'dashed',
    });
  });
});
