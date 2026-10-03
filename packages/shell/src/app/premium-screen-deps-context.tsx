// packages/shell/src/app/premium-screen-deps-context.tsx
// What S12 (and the Settings "Restore purchase" row) needs from the composition root: the Premium
// service dependencies built once at startup (premium-purchase wiring) and the game's name message.
import { createContext, use } from 'react';

import type { GameMessage } from '@e07/shell/i18n/game-message-text.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { ReactNode } from 'react';

export type PremiumScreenDeps = {
  /** The same object startPremium() got: port, productId, dispatch, persistPremium, formatPrice, onError. */
  readonly service: PremiumServiceDeps;
  /** The game module's name message ({ id: '<game-id>.name' }); gameMessageText turns it into text. */
  readonly gameName: GameMessage;
};

const PremiumScreenDepsContext = createContext<PremiumScreenDeps | null>(null);

export type PremiumScreenDepsProviderProps = {
  readonly deps: PremiumScreenDeps;
  readonly children: ReactNode;
};

/** ShellApp wraps the navigator in it, next to the stores and services providers. */
export function PremiumScreenDepsProvider(props: PremiumScreenDepsProviderProps): ReactNode {
  return <PremiumScreenDepsContext value={props.deps}>{props.children}</PremiumScreenDepsContext>;
}

/** Returns the S12 dependencies. A missing provider is a programmer error, so it throws. */
export function usePremiumScreenDeps(): PremiumScreenDeps {
  const deps = use(PremiumScreenDepsContext);
  if (deps === null) {
    throw new Error('usePremiumScreenDeps() needs a <PremiumScreenDepsProvider> above it');
  }
  return deps;
}
