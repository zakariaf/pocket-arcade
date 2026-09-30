// packages/shell/src/game-host/example-picture-probe.tsx
// Fixture: a still picture whose measuring View is the VoiceOver image, so the Canvas inside it
// needs no label of its own (game-host-integration's create-example-picture.tsx does this).
import { Canvas, Picture } from '@shopify/react-native-skia';
import { View } from 'react-native';

import type { SkPicture } from '@shopify/react-native-skia';

export function ExamplePictureProbe(props: {
  readonly label: string;
  readonly picture: SkPicture | null;
}): React.JSX.Element {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={props.label}>
      {props.picture === null ? null : (
        <Canvas style={{ flex: 1 }}>
          <Picture picture={props.picture} />
        </Canvas>
      )}
    </View>
  );
}
