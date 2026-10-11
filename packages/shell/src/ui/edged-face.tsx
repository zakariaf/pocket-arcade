// packages/shell/src/ui/edged-face.tsx
import { StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type EdgedFaceProps = {
  /** The face's box: layout, padding, its solid border (width, colour) and radius, shadows. */
  readonly style: StyleProp<ViewStyle>;
  /** The edge colour, painted under the whole face. */
  readonly edgeColor: string;
  /** The fill, laid inside the edge. */
  readonly fill: string;
  readonly edgeWidth: number;
  readonly radius: number;
  readonly testID?: string;
  readonly children?: ReactNode;
};

const styles = StyleSheet.create({
  plate: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
});

/**
 * A solid-edged Toybox face: painted in its edge colour, with its fill laid on top inside the
 * edge. A fill under the edge bleeds a pale 1/3 pt hairline past the antialiased rounded edge onto
 * the hard shadow (seen on the S2 cards and the S14 dialog cards in light mode), so every
 * solid-edged face (keys through RaisedSurface, the dialog card) is drawn this one way.
 */
export function EdgedFace({
  style,
  edgeColor,
  fill,
  edgeWidth,
  radius,
  testID,
  children,
}: EdgedFaceProps): ReactNode {
  return (
    <View
      style={[style, { backgroundColor: edgeColor }]}
      {...(testID === undefined ? {} : { testID })}
    >
      <View
        style={[
          styles.plate,
          { borderRadius: Math.max(0, radius - edgeWidth), backgroundColor: fill },
        ]}
      />
      {children}
    </View>
  );
}
