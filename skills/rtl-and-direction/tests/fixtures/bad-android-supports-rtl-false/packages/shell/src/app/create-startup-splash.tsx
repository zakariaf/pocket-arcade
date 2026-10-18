// packages/shell/src/app/create-startup-splash.tsx (trimmed): the restart root, registered by
// startShell instead of the app while the layout direction flips.
import { GameStartupSplash } from '@e07/shell/app/game-startup-splash.tsx';
import { DirectionProvider } from '@e07/shell/i18n/direction-context.tsx';
import { directionOf } from '@e07/shell/i18n/languages.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ComponentType, ReactNode } from 'react';

export function createStartupSplash(input: { readonly language: Language }): ComponentType {
  const direction = directionOf(input.language);
  return function RestartSplash(): ReactNode {
    // This root renders text outside the navigator, so it sets its own language's direction.
    return (
      <DirectionProvider direction={direction}>
        <GameStartupSplash />
      </DirectionProvider>
    );
  };
}
