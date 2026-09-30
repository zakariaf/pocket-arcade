// packages/shell/src/config/scene-support.test.ts
import { withSceneSupport } from './scene-support.ts';

import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

const SCENE = { enableSceneSupport: true };

describe('withSceneSupport', () => {
  it('appends an expo-build-properties entry when the list has none', () => {
    expect(withSceneSupport(['expo-sqlite'])).toStrictEqual([
      'expo-sqlite',
      ['expo-build-properties', { ios: SCENE }],
    ]);
  });

  it('merges into the existing entry and keeps its other options', () => {
    const plugins: PluginEntry[] = [
      [
        'expo-build-properties',
        { ios: { useFrameworks: 'static' }, android: { minSdkVersion: 26 } },
      ],
    ];
    expect(withSceneSupport(plugins)).toStrictEqual([
      [
        'expo-build-properties',
        { ios: { useFrameworks: 'static', ...SCENE }, android: { minSdkVersion: 26 } },
      ],
    ]);
  });

  it('turns a bare expo-build-properties string into an entry with options', () => {
    expect(withSceneSupport(['expo-build-properties'])).toStrictEqual([
      ['expo-build-properties', { ios: SCENE }],
    ]);
  });

  it('keeps every other plugin as it was', () => {
    const plugins: PluginEntry[] = [
      'expo-sqlite',
      ['expo-font', { fonts: [] }],
      'expo-build-properties',
    ];
    const result = withSceneSupport(plugins);
    expect(result.slice(0, 2)).toStrictEqual(plugins.slice(0, 2));
    expect(result).toHaveLength(3);
  });
});
