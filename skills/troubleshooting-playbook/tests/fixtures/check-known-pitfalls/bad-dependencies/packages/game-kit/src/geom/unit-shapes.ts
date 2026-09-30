// packages/game-kit/src/geom/unit-shapes.ts
'worklet';

import { Skia } from '@shopify/react-native-skia';

export const UNIT_DIAMOND = Skia.PathBuilder.Make().moveTo(0.5, 0).lineTo(1, 0.5).lineTo(0.5, 1).lineTo(0, 0.5).close().build();
