// packages/shell/src/ui/logo-tile.tsx
import { Canvas, Group } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { LOGO_TILE } from '@e07/shell/art/draw-logo.ts';
import { LOGO_GRID, logoOps } from '@e07/shell/art/logo-art.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { STROKE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { picturePath } from './picture-path.tsx';
import { TILTED_LAYER } from './toybox-styles.ts';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { Theme } from '@e07/shell/theme/theme-types.ts';
import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

/** Where the tile appears: size, edge, die-cut ring, tilt and offset differ per place. */
export type LogoTileVariant = 'home' | 'statsHeader' | 'about' | 'lose' | 'splash';

type VariantSpec = {
  readonly size: number;
  readonly edgeWidth: number;
  readonly ring: number;
  readonly rotateDeg: number;
  readonly translateY: number;
  /** "cut" tiles (About) print their edge in toy ink, like a sticker. */
  readonly isCut: boolean;
};

/** Logo tile measurements per place (Toybox component spec). */
export const LOGO_TILE_VARIANTS: Readonly<Record<LogoTileVariant, VariantSpec>> = {
  home: { size: 46, edgeWidth: STROKE.bold, ring: 0, rotateDeg: -4, translateY: 0, isCut: false },
  statsHeader: {
    size: 36,
    edgeWidth: STROKE.bold,
    ring: 0,
    rotateDeg: -4,
    translateY: 0,
    isCut: false,
  },
  about: { size: 92, edgeWidth: STROKE.bold, ring: 5, rotateDeg: -4, translateY: 0, isCut: true },
  lose: { size: 104, edgeWidth: STROKE.bold, ring: 6, rotateDeg: 17, translateY: 6, isCut: false },
  splash: { size: 152, edgeWidth: 4, ring: 7, rotateDeg: -6, translateY: 0, isCut: false },
};

export type LogoTileProps = {
  /** The game's logo data (apps/<game>/src/art/logo-art.ts). */
  readonly logo: LogoArt;
  readonly variant: LogoTileVariant;
  readonly testID?: string;
};

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });

function tiltOf(spec: VariantSpec): NonNullable<ViewStyle['transform']> {
  return [{ rotate: `${String(spec.rotateDeg)}deg` }, { translateY: spec.translateY }];
}

function tileStyle(theme: Theme, spec: VariantSpec): ViewStyle {
  const shell = SHELL_COLORS[theme.scheme];
  return {
    width: spec.size,
    height: spec.size,
    borderRadius: spec.size * LOGO_TILE.radiusRatio,
    borderWidth: spec.edgeWidth,
    borderColor: spec.isCut ? shell.toyInk : theme.colors.border,
    backgroundColor: theme.colors.primary,
    transform: tiltOf(spec),
  };
}

/**
 * The die-cut ring as a filled plate under the whole tile (CSS box-shadow spread). A spread shadow
 * outside the tile's edge leaves two antialiased edges meeting on a tilted tile, and the ground
 * shows through between them as a dotted hairline; under a plate the edge blends into white.
 */
function ringStyle(theme: Theme, spec: VariantSpec): ViewStyle {
  return {
    position: 'absolute',
    top: -spec.ring,
    start: -spec.ring,
    width: spec.size + spec.ring * 2,
    height: spec.size + spec.ring * 2,
    borderRadius: spec.size * LOGO_TILE.radiusRatio + spec.ring,
    backgroundColor: SHELL_COLORS[theme.scheme].cut,
    transform: tiltOf(spec),
  };
}

/** Hides the outermost view, and with it everything inside, from VoiceOver. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The game's logo in its accent tile: a Skia canvas (never mirrored), decorative for VoiceOver. */
export function LogoTile({ logo, variant, testID }: LogoTileProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const spec = LOGO_TILE_VARIANTS[variant];
  const artSize = (spec.size - spec.edgeWidth * 2) * LOGO_TILE.artScale;
  const ops = logoOps(logo, { pop: theme.colors.pop, toyInk: shell.toyInk, white: shell.cut });
  const tile = (
    <View
      style={[styles.tile, tileStyle(theme, spec)]}
      {...TILTED_LAYER}
      {...(spec.ring === 0 ? HIDDEN : {})}
      {...(testID === undefined ? {} : { testID })}
    >
      <Canvas style={{ width: artSize, height: artSize }}>
        <Group transform={[{ scale: artSize / LOGO_GRID }]}>
          {/* Layers never reorder, so the draw position is a stable key. */}
          {ops.map((op, index) =>
            picturePath({ ...op, join: 'round' }, `${String(index)}-${op.style}`),
          )}
        </Group>
      </Canvas>
    </View>
  );
  if (spec.ring === 0) return tile;
  return (
    <View {...HIDDEN}>
      <View style={ringStyle(theme, spec)} {...TILTED_LAYER} />
      {tile}
    </View>
  );
}
