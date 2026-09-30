// packages/shell/src/ui/toybox-styles.ts
import type { ViewStyle } from 'react-native';

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
