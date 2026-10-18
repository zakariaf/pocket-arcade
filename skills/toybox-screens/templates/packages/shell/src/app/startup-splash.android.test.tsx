// packages/shell/src/app/startup-splash.android.test.tsx
// Runs in the unit-android project (Platform.OS === 'android'). Every Toybox page keeps 34 pt under
// its last block: on the iPhone that is the home indicator's inset, on the Android parity phone the
// 24 dp gesture bar plus 10 more (ScreenBody tops it up the same way). The splash's loader sat 10 pt
// low on the emulator, and the centred logo, name and tagline 5 pt low (S1 parity, E18-T20).
import { screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { ancestorStyle } from '@e07/shell/testing/rendered-parts.ts';

import { StartupSplash } from './startup-splash.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';

const LOGO: LogoArt = { layers: [{ role: 'p', d: 'M22 2.5H26V17.5H22Z' }] };

/** The Android parity phone: 44 dp status bar (with the cutout), 24 dp gesture bar. */
const ANDROID_PHONE = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 44, left: 0, right: 0, bottom: 24 },
};

/** The iPhone 16 Pro: 62 pt top, 34 pt home indicator. */
const IPHONE = {
  frame: { x: 0, y: 0, width: 402, height: 874 },
  insets: { top: 62, left: 0, right: 0, bottom: 34 },
};

async function renderSplashOn(metrics: typeof ANDROID_PHONE): Promise<void> {
  await renderWithShell(
    <SafeAreaProvider initialMetrics={metrics}>
      <StartupSplash logo={LOGO} gameName="Line Siege" tagline="Hold the wall." isReducedMotion />
    </SafeAreaProvider>,
  );
}

/** The bottom padding of the nearest view above the loader that sets one. */
function paddingBelowLoader(): unknown {
  return ancestorStyle('splash.loader', (style) => style.paddingBottom !== undefined).paddingBottom;
}

describe('StartupSplash on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it("tops the 24 dp gesture bar up to the page's 34 pt bottom (spec S1)", async () => {
    await renderSplashOn(ANDROID_PHONE);

    expect(paddingBelowLoader()).toBe(10);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });

  it("adds nothing under the iPhone's 34 pt home indicator", async () => {
    await renderSplashOn(IPHONE);

    expect(paddingBelowLoader()).toBe(0);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
