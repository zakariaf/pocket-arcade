// packages/shell/src/game-host/example-picture.tsx
// Planted bug: the image View closes before the Canvas, so nothing labels the Skia picture.
import { Canvas, Picture } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { SkPicture } from '@shopify/react-native-skia';

export function ExamplePicture(props: {
  readonly label: string;
  readonly picture: SkPicture;
}): React.JSX.Element {
  return (
    <View>
      <View accessible accessibilityRole="image" accessibilityLabel={props.label} />
      <Canvas style={{ flex: 1 }}>
        <Picture picture={props.picture} />
      </Canvas>
    </View>
  );
}
