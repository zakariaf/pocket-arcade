// packages/shell/src/app/parity/parity-error-view.android.test.tsx
// no-shell-context: the error view is the whole app root of a bad launch, so no Shell provider exists around it.
// Runs in the unit-android project (Platform.OS === 'android'). A malformed parity extra (a nonce of
// four letters, E18-T21) drew this view on the Android parity emulator, and the app crashed with
// "ColorValue: None of the paths in the resource_paths array resolved to a color resource": iOS's
// semantic colour name systemBackground is no Android resource. On Android the background is the
// theme's own colorBackground attribute, so a bad launch shows its error instead of crashing.
import { render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { createParityErrorRoot } from './parity-error-view.tsx';

/** The resource paths of an Android PlatformColor ({ resource_paths }), or [] for any other value. */
function resourcePathsOf(color: unknown): readonly string[] {
  if (typeof color !== 'object' || color === null || !('resource_paths' in color)) return [];
  const paths: unknown = color.resource_paths;
  return Array.isArray(paths) ? paths.map(String) : [];
}

describe('createParityErrorRoot on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it('paints the error root with an Android colour resource, never an iOS semantic name', async () => {
    await render(createElement(createParityErrorRoot('nonce must be 6 to 32 lower-case letters')));
    const style = StyleSheet.flatten(screen.getByTestId('parity.error').props['style']) as {
      readonly backgroundColor?: unknown;
    };

    expect(resourcePathsOf(style.backgroundColor)).toStrictEqual(['?android:attr/colorBackground']);
  });
});
