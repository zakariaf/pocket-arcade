// packages/shell/src/config/prepared-text-layout.ts
// Node world (read by packages/shell/plugins/with-prepared-text-layout.ts at prebuild). Android 15
// and later (an app targeting SDK 35+, compat change USE_BOUNDS_FOR_WIDTH) wraps a TextView by its
// glyph bounds, while React Native 0.86 measures a Text by its glyph advances. A line whose ink
// overhangs its advance (Persian in Vazirmatn) fits the box React Native measured, then wraps when
// the TextView draws it: S11d's Persian software tab laid out one line and drew two, its last
// word clipped under the list (E18-T22). React Native's prepared text layout draws the very layout
// it measured. The flag can be set once, by DefaultNewArchitectureEntryPoint.load() inside
// loadReactNative (the stable set), so right after it the stable defaults are forced again with
// this one flag on (ReactNativeFeatureFlags in node_modules/react-native/ReactAndroid).

const LOAD_LINE = '    loadReactNative(this)';
const FLAG_LINE = 'override fun enablePreparedTextLayout(): Boolean = true';
const FLAGS = 'com.facebook.react.internal.featureflags';

const OVERRIDE: readonly string[] = [
  '    // architecture-and-boundaries (with-prepared-text-layout): draw each Text with the layout',
  '    // React Native measured; Android 15+ would wrap it again by its glyph bounds.',
  `    ${FLAGS}.ReactNativeFeatureFlags.dangerouslyForceOverride(`,
  `      object : ${FLAGS}.ReactNativeNewArchitectureFeatureFlagsDefaults() {`,
  `        ${FLAG_LINE}`,
  '      }',
  '    )?.let { android.util.Log.w("PocketArcade", "feature flags read before the override: $it") }',
];

/** MainApplication.kt with the prepared text layout forced on after loadReactNative(this). */
export function applyPreparedTextLayout(source: string): string {
  if (source.includes(FLAG_LINE)) return source;
  const lines = source.split('\n');
  const at = lines.indexOf(LOAD_LINE);
  if (at === -1) {
    throw new Error(
      'MainApplication.kt has no loadReactNative(this): prebuild changed its template',
    );
  }
  return [...lines.slice(0, at + 1), ...OVERRIDE, ...lines.slice(at + 1)].join('\n');
}
