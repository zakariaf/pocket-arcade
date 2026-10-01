// packages/shell/src/ui/logo-tile.test.tsx
import { screen } from '@testing-library/react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';

import { LOGO_TILE_VARIANTS, LogoTile } from './logo-tile.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = {
  layers: [
    { role: 'p', d: 'M22 2.5H26V17.5H22Z' },
    { role: 'kl', d: 'M7 30h34' },
  ],
};

describe('LogoTile', () => {
  it('paints the accent tile at the variant size, tilted, hidden from VoiceOver', async () => {
    await renderWithShell(<LogoTile logo={LOGO} variant="home" testID="home.logo" />);

    const tile = screen.getByTestId('home.logo', { includeHiddenElements: true });
    expect(tile).toHaveStyle({
      width: LOGO_TILE_VARIANTS.home.size,
      height: LOGO_TILE_VARIANTS.home.size,
      backgroundColor: TEST_PALETTE.standard.light.primary,
      // Rotate first, then the lift, as the mockup's CSS applies them (rotate() translateY()).
      transform: [{ rotate: '-4deg' }, { translateY: 0 }],
    });
    expect(tile.props['accessibilityElementsHidden']).toBe(true);
  });

  it('matches the Toybox sizes for every place it appears', () => {
    const sizes = Object.values(LOGO_TILE_VARIANTS).map((spec) => spec.size);

    expect(sizes).toStrictEqual([46, 36, 92, 104, 152]);
  });
});
