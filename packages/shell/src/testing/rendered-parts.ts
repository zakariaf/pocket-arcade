// packages/shell/src/testing/rendered-parts.ts
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { ViewStyle } from 'react-native';

/** Query option that also finds parts hidden from VoiceOver (icon tiles, marks, the toggle graphic). */
export const HIDDEN = { includeHiddenElements: true } as const;

/**
 * The glyph names of the icons drawn inside a part, in order: the non-colour cue of a state
 * (check or dash, chevron, padlock). The file must mock the icon rasteriser so each image names its
 * glyph (the root mock gives every icon the same image):
 *   jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({ getIconUri: (name: string) => `icon:${name}` }));
 */
export function iconsIn(testID: string): readonly string[] {
  const part = screen.getByTestId(testID, HIDDEN);
  return part
    .queryAll((node) => node.type === 'Image')
    .map((node) => {
      const source = node.props['source'] as { readonly uri?: string } | undefined;
      return source?.uri?.replace('icon:', '') ?? '';
    });
}

/** The flattened style of the nearest ancestor of a part whose style passes `isWanted`. */
export function ancestorStyle(testID: string, isWanted: (style: ViewStyle) => boolean): ViewStyle {
  let node = screen.getByTestId(testID).parent;
  while (node !== null) {
    const style = StyleSheet.flatten(node.props['style'] as ViewStyle | undefined) ?? {};
    if (isWanted(style)) return style;
    node = node.parent;
  }
  return {};
}
