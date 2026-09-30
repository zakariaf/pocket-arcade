// jest.setup.ts — runs after the test framework is installed, in the 'unit' project only.
// Versions verified: react-native-gesture-handler 2.32, react-native-worklets 0.10.1, react-native-reanimated 4.5.1,
// @shopify/react-native-skia 2.6.2.
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Skia's native module does not load in the 'unit' project ("Native Skia Module failed to correctly
// install JSI Bindings"), so every suite that imports a component drawing with Skia would crash: the
// logo tile, the empty-stats picture, the hazard strip, the debug screen, the board canvas and every
// screen that shows one. Here each Skia component (Canvas, Group, Path, Picture, ...) renders as an
// inert host element named Skia<Component> that keeps its props (testID, accessibility), each Skia.*
// or helper call returns an inert object, and the loading hooks (useFont, useImage) return null.
// Pixels are proven in the 'golden' project, which draws with the real CanvasKit.
// A test that inspects Skia calls mocks the package itself; its jest.mock replaces this one there.
jest.mock('@shopify/react-native-skia', () => {
  const inert = (): unknown =>
    new Proxy(() => undefined, {
      get: (_target, key) => {
        if (key === Symbol.toPrimitive) return () => '';
        if (key === 'then') return undefined;
        return inert();
      },
      apply: () => inert(),
    });
  const module: Record<string, unknown> = { __esModule: true, Skia: inert() };
  return new Proxy(module, {
    get: (target, key) => {
      if (typeof key !== 'string' || key === 'default' || key === 'then') return undefined;
      if (Object.hasOwn(target, key)) return target[key];
      if (/^use[A-Z]/.test(key)) return () => null;
      if (/^[A-Z]/.test(key)) return `Skia${key}`;
      return inert();
    },
  });
});

// Once packages/shell/src/ui/icons/icon-raster.ts exists, add (a jest.mock of a module that does not
// exist yet fails this setup file for every suite):
// jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
//   getIconUri: () => 'data:image/png;base64,',
// }));
