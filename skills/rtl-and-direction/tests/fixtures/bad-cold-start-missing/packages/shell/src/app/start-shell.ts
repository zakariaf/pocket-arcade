// packages/shell/src/app/start-shell.ts
// This import stays first: the Intl polyfills are evaluated before any other Shell or game module.
import '@e07/shell/i18n/intl-polyfills.ts';

import { registerRootComponent } from 'expo';
import { getLocales } from 'expo-localization';

import { createShellApp } from '@e07/shell/app/create-shell-app.tsx';
import { createStartupSplash } from '@e07/shell/app/startup-splash.tsx';
import { languageFromRawSave, planDirection } from '@e07/shell/i18n/direction-plan.ts';
import { readLayoutDirection, restartForDirection } from '@e07/shell/i18n/direction.ts';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { peekCurrentSave } from '@e07/shell/services/save/peek-current-save.ts';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';

// Called by apps/<game>/index.ts. Nothing here writes the save before the direction check:
// a reload re-runs every module, so writes before it would happen twice (verified gotcha).
export function startShell<T extends ShellGameTypes>(game: ShellGameModule<T>): void {
  const guard = createSqliteKvDirectionGuardAdapter();
  const language = resolveLanguage(languageFromRawSave(peekCurrentSave()), getLocales());
  const pendingRestart = guard.readPending();
  const plan = planDirection({ language, layout: readLayoutDirection(), pendingRestart });
  if (plan === 'restart') {
    // The splash calls restart() in its mount effect. Reloading while the bundle is still being
    // evaluated crashed a Release build ("startSurface failed. Global was not installed").
    const restart = (): Promise<void> => restartForDirection(directionOf(language), guard);
    registerRootComponent(createStartupSplash(restart));
    return;
  }
  guard.writePending(null); // 'keep' or 'give-up' ('give-up' is logged by the app)
  registerRootComponent(createShellApp({ game, language, directionPlan: plan }));
}
