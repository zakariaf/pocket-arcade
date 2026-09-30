// packages/shell/src/app/shell-features.tsx
import { ConsentMoment } from '@e07/shell/app/consent-moment.tsx';
import { PremiumScreenDepsProvider } from '@e07/shell/app/premium-screen-deps-context.tsx';
import { PressFeedbackProvider } from '@e07/shell/app/press-feedback-context.tsx';
import { ShellNavigator } from '@e07/shell/app/shell-navigator.tsx';
import { GameHostProvider } from '@e07/shell/game-host/game-host-context.tsx';
import { playUiFeedback } from '@e07/shell/services/audio/ui-feedback.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { Services } from '@e07/shell/app/services-context.tsx';
import type { GameHost } from '@e07/shell/game-host/game-host.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';
import type { InitialState } from '@react-navigation/native';
import type { ReactNode } from 'react';

export type ShellFeaturesProps = {
  readonly host: GameHost;
  readonly services: Services;
  readonly premiumDeps: PremiumServiceDeps;
  /** Test builds: the S15 switches' services, the debug link handler and the navigator ref. */
  readonly debug: DebugParts;
  /** The S3 parity frame: the consent moment is shown at once and held. */
  readonly isConsentMomentHeld: boolean;
  /** The resume state ([Home, Game]) at launch; undefined (Home) after the crash dialog. */
  readonly initialState: InitialState | undefined;
  /** hydrated.outcome at launch (the S14 load dialog); null after the crash dialog. */
  readonly loadOutcome: LoadOutcome | null;
};

/**
 * Inside the theme, i18n and stores (ShellApp): the game host, the S12 dependencies, the tap
 * sound of every button, the S3 consent moment over the app, the debug services (test builds),
 * the S14 dialog host and the navigator, whose colours follow the theme.
 */
export function ShellFeatures(props: ShellFeaturesProps): ReactNode {
  const { host, services } = props;
  return (
    <GameHostProvider host={host}>
      <PremiumScreenDepsProvider
        deps={{ service: props.premiumDeps, gameName: { id: host.nameId } }}
      >
        <PressFeedbackProvider
          onPress={() => {
            playUiFeedback(services, 'tap');
          }}
        >
          <ConsentMoment isHeld={props.isConsentMomentHeld} debug={props.debug.services}>
            <ShellNavigator
              debug={props.debug}
              initialState={props.initialState}
              loadOutcome={props.loadOutcome}
            />
          </ConsentMoment>
        </PressFeedbackProvider>
      </PremiumScreenDepsProvider>
    </GameHostProvider>
  );
}
