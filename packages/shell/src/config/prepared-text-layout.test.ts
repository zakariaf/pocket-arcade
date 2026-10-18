// packages/shell/src/config/prepared-text-layout.test.ts
import { applyPreparedTextLayout } from './prepared-text-layout.ts';

// The onCreate of Expo SDK 57's MainApplication.kt, as prebuild writes it.
const MAIN_APPLICATION = [
  'class MainApplication : Application(), ReactApplication {',
  '  override fun onCreate() {',
  '    super.onCreate()',
  '    DefaultNewArchitectureEntryPoint.releaseLevel = try {',
  '      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())',
  '    } catch (e: IllegalArgumentException) {',
  '      ReleaseLevel.STABLE',
  '    }',
  '    loadReactNative(this)',
  '    ApplicationLifecycleDispatcher.onApplicationCreate(this)',
  '  }',
  '}',
].join('\n');

function linesAfterLoad(source: string): string[] {
  const lines = source.split('\n');
  return lines.slice(lines.indexOf('    loadReactNative(this)') + 1);
}

describe('applyPreparedTextLayout', () => {
  it('turns on the prepared text layout right after React Native loads its flags (spec 15.1, N12)', () => {
    const after = linesAfterLoad(applyPreparedTextLayout(MAIN_APPLICATION));

    // Android 15+ wraps a TextView by its glyph bounds, React Native measures by advances: S11d's
    // Persian tab laid out one line and drew two, its last word clipped (E18-T22). The prepared
    // layout draws the line React Native measured. load() has just set the stable flags, which
    // can be set only once, so the stable defaults are forced again with this one flag on.
    expect(after.slice(0, 1)).toStrictEqual([
      '    // architecture-and-boundaries (with-prepared-text-layout): draw each Text with the layout',
    ]);
    const block = after.join('\n');
    expect(block).toContain('ReactNativeFeatureFlags.dangerouslyForceOverride(');
    expect(block).toContain(
      'object : com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults() {',
    );
    expect(block).toContain('override fun enablePreparedTextLayout(): Boolean = true');
    expect(after.at(-3)).toBe('    ApplicationLifecycleDispatcher.onApplicationCreate(this)');
  });

  it('adds the override once, however often prebuild runs', () => {
    const once = applyPreparedTextLayout(MAIN_APPLICATION);
    expect(applyPreparedTextLayout(once)).toBe(once);
    expect(once.split('enablePreparedTextLayout')).toHaveLength(2);
  });

  it('refuses a MainApplication that never loads React Native', () => {
    expect(() => applyPreparedTextLayout('class MainApplication {}')).toThrow(
      'MainApplication.kt has no loadReactNative(this)',
    );
  });
});
