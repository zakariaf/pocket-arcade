// packages/shell/src/ui/toybox-styles.ts
import type { StyleProp, ViewStyle } from 'react-native';

/** CSS `box-shadow: 0 <offset>px 0 <color>`: Toybox's hard shadow, no blur. For parts that never move. */
export function hardShadow(offset: number, color: string): ViewStyle {
  return { boxShadow: [{ offsetX: 0, offsetY: offset, blurRadius: 0, spreadDistance: 0, color }] };
}

/** CSS `box-shadow: 0 0 0 <width>px <color>`: the white die-cut ring around stickers, flags and art. */
export function dieCutRing(width: number, color: string): ViewStyle {
  return { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: width, color }] };
}

/** Focus ring geometry: 3 pt wide, drawn 2 pt outside the control's border. */
export const FOCUS_RING = { width: 3, gap: 2 } as const;

/** CSS `outline: 3px solid <focus>; outline-offset: 2px`. Follows the border radius. */
export function focusRing(color: string): ViewStyle {
  return {
    outlineWidth: FOCUS_RING.width,
    outlineStyle: 'solid',
    outlineOffset: FOCUS_RING.gap,
    outlineColor: color,
  };
}

/**
 * The raster half of the tilt primitive. Fabric draws a border from an image it stretches with
 * nearest filtering, so a turned edge, and an inner border such as the calendar's month band, steps
 * at device pixels; a rasterized layer is resampled smoothly when it turns, as Chrome draws the
 * references. Each platform reads only its own flag: iOS rasterizes the layer
 * (shouldRasterizeIOS), Android renders it into one GPU texture (renderToHardwareTextureAndroid).
 * Static tilts get both from tiltedLayer; only a tilt that animates (the sticker's slap) spreads
 * it itself, and turns with tilt() in its animated style.
 */
export const TILTED_LAYER = {
  shouldRasterizeIOS: true,
  renderToHardwareTextureAndroid: true,
} as const;

/** One entry of a transform list (rotate, translateY, scale ...). */
export type TransformEntry = Exclude<NonNullable<ViewStyle['transform']>, string>[number];

/** A turn of `deg` degrees as a transform entry. A worklet, so an animated tilt turns with it too. */
export function tilt(deg: number): TransformEntry {
  'worklet';
  return { rotate: `${String(deg)}deg` };
}

/**
 * The tilt primitive: spread on the View of every printed part that turns (the level flag, the
 * Today tag, art and logo tiles, the calendar, Premium art, confetti):
 * `<View {...tiltedLayer(deg, styles.part)} testID=...>`. It owns both halves: the turn (after the
 * part's own style, then any `after` transforms, as CSS `rotate() translateY()`) and the one
 * rasterized layer (both platforms' flags) that turns smoothly.
 */
export function tiltedLayer(
  deg: number,
  style?: StyleProp<ViewStyle>,
  after: readonly TransformEntry[] = [],
): typeof TILTED_LAYER & { readonly style: StyleProp<ViewStyle> } {
  return { ...TILTED_LAYER, style: [style, { transform: [tilt(deg), ...after] }] };
}
