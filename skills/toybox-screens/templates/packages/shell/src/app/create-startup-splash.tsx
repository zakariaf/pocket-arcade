// packages/shell/src/app/create-startup-splash.tsx
// Registered by startShell INSTEAD of the app while the layout direction flips (rtl-and-direction).
// Nothing is opened or written before the direction check, so there are no stores and no game host:
// the language comes from startShell, the theme from the phone, the texts and the logo from the game
// module. restart() runs only after this root has mounted: reloading while the bundle was still being
// evaluated crashed a Release build ("startSurface failed. Global was not installed").
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { useStore } from 'zustand';

import { GameStartupSplash } from '@e07/shell/app/game-startup-splash.tsx';
import { systemA11yStore } from '@e07/shell/app/system-a11y-store.ts';
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
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

/** No error log exists yet (nothing may be written before the direction check). */
const ignore = (): void => undefined;

export function createStartupSplash(input: StartupSplashInput): ComponentType {
  const { game, language } = input;
  const theme = selectTheme(createThemeSet(game.presentation.palette), {
    scheme: resolveColorScheme('system', Appearance.getColorScheme()),
    mode: 'standard',
  });
  return function RestartSplash(): ReactNode {
    const isReducedMotion = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
    // Allowed effect: one call into an external system after mount (the reload).
    useEffect(() => {
      // forceRTL is already persisted, so a failed reload is fixed by the next cold start.
      input.restart().catch(ignore);
    }, []);
    // No SafeAreaProvider: ScreenFrame's SafeAreaView measures the insets natively.
    return (
      <I18nProvider
        language={language}
        digits="automatic"
        gameCatalogs={game.texts}
        onError={ignore}
      >
        <ThemeContext value={theme}>
          <GameStartupSplash
            logo={game.presentation.art.logo}
            nameId={game.identity.nameId}
            taglineId={game.identity.taglineId}
            isReducedMotion={isReducedMotion}
          />
        </ThemeContext>
      </I18nProvider>
    );
  };
}
