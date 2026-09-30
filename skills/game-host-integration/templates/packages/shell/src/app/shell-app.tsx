// packages/shell/src/app/shell-app.tsx
import { useState } from 'react';

import { CrashScreen } from '@e07/shell/app/crash-screen.tsx';
import { LocalizedRoot } from '@e07/shell/app/localized-root.tsx';
import { ServicesProvider } from '@e07/shell/app/services-context.tsx';
import { ShellFeatures } from '@e07/shell/app/shell-features.tsx';
import { ShellProviders } from '@e07/shell/app/shell-providers.tsx';
import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { useCheckpointOnBackground } from '@e07/shell/app/use-checkpoint-on-background.ts';
import { useIsFullscreenAdShowing } from '@e07/shell/game-host/use-is-fullscreen-ad-showing.ts';
import { DirectionProvider } from '@e07/shell/i18n/direction-context.tsx';
import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { useAudioLifecycle } from '@e07/shell/services/audio/use-audio-lifecycle.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { Hydrated } from '@e07/shell/app/hydrate-save.ts';
import type { Services } from '@e07/shell/app/services-context.tsx';
import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { GameHost } from '@e07/shell/game-host/game-host.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { DeviceLocale } from '@e07/shell/i18n/resolve-language.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { ThemeSet } from '@e07/shell/theme/theme-set.ts';
import type { ReactNode } from 'react';

/** Everything createShellApp built once: the app root only provides it (dependency injection). */
export type ShellParts = {
  readonly hydrated: Hydrated;
  readonly stores: ShellStores;
  readonly host: GameHost;
  readonly services: Services;
  /** The same object startPremium got (premium-purchase); S12 reads it through its context. */
  readonly premiumDeps: PremiumServiceDeps;
  /** Test builds: e2e-maestro's createDebugParts (services and links null in store builds). */
  readonly debug: DebugParts;
  /** createThemeSet(game.presentation.palette). */
  readonly themes: ThemeSet;
  /** game.texts: the game's four catalogs, merged over the Shell's by the i18n provider. */
  readonly gameCatalogs: Readonly<Record<Language, Catalog>>;
  /** expo-localization getLocales(), read once at startup ("System" resolves against it). */
  readonly deviceLocales: readonly DeviceLocale[];
  /** The S3 parity frame (ShellLaunch.isConsentMomentHeld): the consent moment is held on screen. */
  readonly isConsentMomentHeld: boolean;
};

export type ShellAppProps = { readonly parts: ShellParts };

/**
 * The app root, rendered once by createShellApp: services, stores, i18n, direction and the
 * theme, safe-area, gesture and error-boundary stack (ShellProviders) around ShellFeatures.
 * The audio lifecycle and the save checkpoint are mounted here, exactly once.
 */
export function ShellApp({ parts }: ShellAppProps): ReactNode {
  const { hydrated, host, services } = parts;
  // After the crash dialog's "Back to Home" the navigator restarts at Home, never in the run.
  const [hasCrashed, setHasCrashed] = useState(false);
  useCheckpointOnBackground(hydrated.save);
  useAudioLifecycle({
    audio: services.audio,
    isFullscreenAdShowing: useIsFullscreenAdShowing(host.lifecycle),
    reportError: (error) => {
      services.errorLog.record('audio', error);
    },
  });
  const renderCrash = (reset: () => void): ReactNode => (
    <CrashScreen
      onGoHome={() => {
        setHasCrashed(true);
        reset();
      }}
    />
  );
  return (
    <ServicesProvider services={services}>
      <StoresProvider stores={parts.stores}>
        <LocalizedRoot
          deviceLocales={parts.deviceLocales}
          gameCatalogs={parts.gameCatalogs}
          onError={(error) => {
            services.errorLog.record('i18n', error);
          }}
        >
          <DirectionProvider direction={readLayoutDirection()}>
            <ShellProviders
              themes={parts.themes}
              onError={(error) => {
                services.errorLog.record('render', error);
              }}
              renderFallback={renderCrash}
            >
              <ShellFeatures
                host={host}
                services={services}
                premiumDeps={parts.premiumDeps}
                debug={parts.debug}
                isConsentMomentHeld={parts.isConsentMomentHeld}
                initialState={hasCrashed ? undefined : hydrated.initialState}
                loadOutcome={hasCrashed ? null : hydrated.outcome}
              />
            </ShellProviders>
          </DirectionProvider>
        </LocalizedRoot>
      </StoresProvider>
    </ServicesProvider>
  );
}
