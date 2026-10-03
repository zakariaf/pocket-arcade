// packages/shell/src/app/create-startup-splash.tsx
// Registered by startShell INSTEAD of the app while the layout direction flips (rtl-and-direction).
// Nothing is opened or written before the direction check, so there are no stores and no game host:
// the language comes from startShell, the theme from the phone, the texts and the logo from the game
// module. restart() runs only after this root has mounted: reloading while the bundle was still being
// evaluated crashed a Release build ("startSurface failed. Global was not installed").
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { GameStartupSplash } from '@e07/shell/app/game-startup-splash.tsx';
import { systemA11yStore } from '@e07/shell/app/system-a11y-store.ts';
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { DirectionProvider } from '@e07/shell/i18n/direction-context.tsx';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { ThemeContext } from '@e07/shell/theme/theme-context.ts';
import { createThemeSet, resolveColorScheme, selectTheme } from '@e07/shell/theme/theme-set.ts';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { Palette } from '@e07/shell/theme/theme-types.ts';
import type { ComponentType, ReactNode } from 'react';

/** The parts of the game module S1 draws (any ShellGameModule fits). */
export type StartupSplashGame = {
  readonly identity: { readonly nameId: string; readonly taglineId: string };
  readonly texts: Readonly<Record<Language, Catalog>>;
  readonly presentation: { readonly palette: Palette; readonly art: { readonly logo: LogoArt } };
};

export type StartupSplashInput = {
  readonly game: StartupSplashGame;
  /** The language startShell resolved (the direction it restarts into). */
  readonly language: Language;
  /** restartForDirection(direction, guard): reloads the bundle in the new direction. */
  readonly restart: () => Promise<void>;
};

/**
 * A parity capture of S1 (test builds) holds the loader still, as useReduceMotion() does on every
 * other screen: this root has no settings store, so it reads the same TEST_ONLY switch directly.
 */
function isParityMotionFrozen(): boolean {
  return TEST_ONLY?.isParityMotionFrozen() === true;
}

/** The window's first metrics; unknown only off-device (Jest), where no insets apply. */
const WINDOW_METRICS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** No error log exists yet (nothing may be written before the direction check). */
const ignore = (): void => undefined;

export function createStartupSplash(input: StartupSplashInput): ComponentType {
  const { game, language } = input;
  const theme = selectTheme(createThemeSet(game.presentation.palette), {
    scheme: resolveColorScheme('system', Appearance.getColorScheme()),
    mode: 'standard',
  });
  const direction = directionOf(language);
  return function RestartSplash(): ReactNode {
    const isSystemReduceMotionOn = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
    const isReducedMotion = isSystemReduceMotionOn || isParityMotionFrozen();
    // Allowed effect: one call into an external system after mount (the reload).
    useEffect(() => {
      // forceRTL is already persisted, so a failed reload is fixed by the next cold start.
      input.restart().catch(ignore);
    }, []);
    // The provider with the window's first metrics: without it ScreenFrame's SafeAreaView drew this
    // root with no insets (the S1 capture sat 17 pt high and the loader 34 pt low).
    return (
      <SafeAreaProvider initialMetrics={WINDOW_METRICS}>
        <I18nProvider
          language={language}
          digits="automatic"
          gameCatalogs={game.texts}
          onError={ignore}
        >
          {/* The texts are written in the language's direction (without it a Persian tagline
              was written left to right: its full stop stood at the right end of the line). */}
          <DirectionProvider direction={direction}>
            <ThemeContext value={theme}>
              <GameStartupSplash
                logo={game.presentation.art.logo}
                nameId={game.identity.nameId}
                taglineId={game.identity.taglineId}
                isReducedMotion={isReducedMotion}
              />
            </ThemeContext>
          </DirectionProvider>
        </I18nProvider>
      </SafeAreaProvider>
    );
  };
}
