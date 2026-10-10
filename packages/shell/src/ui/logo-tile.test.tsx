// packages/shell/src/ui/logo-tile.test.tsx
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';

import { LOGO_TILE_VARIANTS, LogoTile } from './logo-tile.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { StyleProp, ViewStyle } from 'react-native';

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

  it('draws each paint as one round-joined Skia path, a rotated layer inside a turned group', async () => {
    const turned: LogoArt = {
      layers: [
        ...LOGO.layers,
        { role: 'w0', d: 'M10 10h4v4h-4Z', rotate: { deg: 90, cx: 12, cy: 12 } },
      ],
    };
    await renderWithShell(<LogoTile logo={turned} variant="home" testID="home.logo" />);

    const tile = screen.getByTestId('home.logo', { includeHiddenElements: true });
    const paints = tile
      .queryAll((node) => node.type === 'SkiaPath')
      .map(({ props }) => ({
        path: props['path'] as unknown,
        style: props['style'] as unknown,
        color: props['color'] as unknown,
        strokeWidth: props['strokeWidth'] as unknown,
        strokeCap: props['strokeCap'] as unknown,
        strokeJoin: props['strokeJoin'] as unknown,
      }));
    const ink = SHELL_COLORS.light.toyInk;
    const pop = TEST_PALETTE.standard.light.pop;
    expect(paints).toStrictEqual([
      {
        path: 'M22 2.5H26V17.5H22Z',
        style: 'fill',
        color: pop,
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'round',
      },
      {
        path: 'M22 2.5H26V17.5H22Z',
        style: 'stroke',
        color: ink,
        strokeWidth: 2.6,
        strokeCap: 'butt',
        strokeJoin: 'round',
      },
      {
        path: 'M7 30h34',
        style: 'stroke',
        color: ink,
        strokeWidth: 2.6,
        strokeCap: 'round',
        strokeJoin: 'round',
      },
      {
        path: 'M10 10h4v4h-4Z',
        style: 'fill',
        color: SHELL_COLORS.light.cut,
        strokeWidth: 0,
        strokeCap: 'butt',
        strokeJoin: 'round',
      },
    ]);
    expect(tile.queryAll((node) => node.type === 'SkiaDashPathEffect')).toStrictEqual([]);
    const groups = tile.queryAll((node) => node.type === 'SkiaGroup');
    const rotation = groups.find((node) => node.props['origin'] !== undefined);
    expect(rotation?.props['origin']).toStrictEqual({ x: 12, y: 12 });
    expect(rotation?.props['transform']).toStrictEqual([{ rotate: Math.PI / 2 }]);
    expect(rotation?.queryAll((node) => node.type === 'SkiaPath')).toHaveLength(1);
  });

  it('lays the die-cut ring under the tile as a white plate, so a tilted edge leaves no seam', async () => {
    await renderWithShell(<LogoTile logo={LOGO} variant="splash" testID="splash.logo" />);

    const { size, ring } = LOGO_TILE_VARIANTS.splash;
    const tile = screen.getByTestId('splash.logo', { includeHiddenElements: true });
    expect(
      StyleSheet.flatten(tile.props['style'] as StyleProp<ViewStyle>)?.boxShadow,
    ).toBeUndefined();
    const plates = screen.container.queryAll(
      (node) =>
        node.type === 'View' &&
        StyleSheet.flatten(node.props['style'] as StyleProp<ViewStyle>)?.width === size + ring * 2,
    );
    expect(plates).toHaveLength(1);
    expect(plates[0]).toHaveStyle({
      position: 'absolute',
      top: -ring,
      start: -ring,
      height: size + ring * 2,
      borderRadius: size * 0.24 + ring,
      backgroundColor: SHELL_COLORS.light.cut,
      transform: [{ rotate: '-6deg' }, { translateY: 0 }],
    });
  });

  it('rasterizes the tilted tile and its ring plate, so iOS draws their tilted edges smooth', async () => {
    await renderWithShell(<LogoTile logo={LOGO} variant="splash" testID="splash.logo" />);

    // Fabric draws a border from an image it stretches with nearest filtering, so a tilted edge
    // steps at device pixels; a rasterized layer is resampled smoothly when it is turned.
    const tile = screen.getByTestId('splash.logo', { includeHiddenElements: true });
    expect(tile).toHaveProp('shouldRasterizeIOS', true);
    expect(tile.parent?.children[0]).toHaveProp('shouldRasterizeIOS', true);
  });

  it('matches the Toybox sizes for every place it appears', () => {
    const sizes = Object.values(LOGO_TILE_VARIANTS).map((spec) => spec.size);

    expect(sizes).toStrictEqual([46, 36, 92, 104, 152]);
  });
});
