// packages/game-kit/src/geom/unit-shapes.ts
'worklet';

import { Skia } from '@shopify/react-native-skia';

const path = Skia.Path.Make();
path.addCircle(0.5, 0.5, 0.5);
export const UNIT_CIRCLE = path;
