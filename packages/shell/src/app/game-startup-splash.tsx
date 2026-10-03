// packages/shell/src/app/game-startup-splash.tsx
import { gameMessageText } from '@e07/shell/i18n/game-message-text.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';

import { StartupSplash } from './startup-splash.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { ReactNode } from 'react';

export type GameStartupSplashProps = {
  /** The module's GAME_ART.logo. */
  readonly logo: LogoArt;
  /** GameIdentity.nameId and taglineId: turned into text here, under the i18n provider. */
  readonly nameId: string;
  readonly taglineId: string;
  readonly isReducedMotion: boolean;
};

/** S1 from the game module's own texts (the direction restart has no game host yet). */
export function GameStartupSplash(props: GameStartupSplashProps): ReactNode {
  const t = useT();
  return (
    <StartupSplash
      logo={props.logo}
      gameName={gameMessageText(t, { id: props.nameId })}
      tagline={gameMessageText(t, { id: props.taglineId })}
      isReducedMotion={props.isReducedMotion}
    />
  );
}
