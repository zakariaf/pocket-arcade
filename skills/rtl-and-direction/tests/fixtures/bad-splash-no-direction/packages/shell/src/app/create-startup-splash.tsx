// packages/shell/src/app/create-startup-splash.tsx (trimmed): the restart root, registered by
// startShell instead of the app while the layout direction flips.
import { GameStartupSplash } from '@e07/shell/app/game-startup-splash.tsx';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { ComponentType, ReactNode } from 'react';

// Planted bug: no DirectionProvider, so the Persian tagline is written left to right.
export function createStartupSplash(input: { readonly language: Language }): ComponentType {
  void input.language;
  return function RestartSplash(): ReactNode {
    return <GameStartupSplash />;
  };
}
