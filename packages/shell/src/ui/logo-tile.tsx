// packages/shell/src/ui/logo-tile.tsx
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { LOGO_TILE } from '@e07/shell/art/draw-logo.ts';
import { LOGO_GRID, logoOps } from '@e07/shell/art/logo-art.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { STROKE } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { dieCutRing } from './toybox-styles.ts';

import type { LogoArt, LogoOp } from '@e07/shell/art/logo-art.ts';
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

function tileStyle(theme: Theme, spec: VariantSpec): ViewStyle {
  const shell = SHELL_COLORS[theme.scheme];
  return {
    width: spec.size,
    height: spec.size,
    borderRadius: spec.size * LOGO_TILE.radiusRatio,
    borderWidth: spec.edgeWidth,
    borderColor: spec.isCut ? shell.toyInk : theme.colors.border,
    backgroundColor: theme.colors.primary,
    transform: [{ rotate: `${String(spec.rotateDeg)}deg` }, { translateY: spec.translateY }],
    ...(spec.ring > 0 ? dieCutRing(spec.ring, shell.cut) : {}),
  };
}

/** One paint operation as Skia elements (a plain function, not a component). */
function logoPath(op: LogoOp, key: string): ReactNode {
  const path = (
    <Path
      key={key}
      path={op.d}
      color={op.color}
      style={op.style}
      strokeWidth={op.width}
      strokeCap={op.cap}
      strokeJoin="round"
    />
  );
  if (op.rotate === undefined) return path;
  const radians = (op.rotate.deg * Math.PI) / 180;
  return (
    <Group
      key={key}
      transform={[{ rotate: radians }]}
      origin={{ x: op.rotate.cx, y: op.rotate.cy }}
    >
      {path}
    </Group>
  );
}

/** The game's logo in its accent tile: a Skia canvas (never mirrored), decorative for VoiceOver. */
export function LogoTile({ logo, variant, testID }: LogoTileProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const spec = LOGO_TILE_VARIANTS[variant];
  const artSize = (spec.size - spec.edgeWidth * 2) * LOGO_TILE.artScale;
  const ops = logoOps(logo, { pop: theme.colors.pop, toyInk: shell.toyInk, white: shell.cut });
  return (
    <View
      style={[styles.tile, tileStyle(theme, spec)]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...(testID === undefined ? {} : { testID })}
    >
      <Canvas style={{ width: artSize, height: artSize }}>
        <Group transform={[{ scale: artSize / LOGO_GRID }]}>
          {/* Layers never reorder, so the draw position is a stable key. */}
          {ops.map((op, index) => logoPath(op, `${String(index)}-${op.style}`))}
        </Group>
      </Canvas>
    </View>
  );
}
