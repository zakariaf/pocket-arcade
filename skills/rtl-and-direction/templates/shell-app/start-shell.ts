// packages/shell/src/app/start-shell.ts
// device-only: covered by every simulator launch and the RTL flow flows/rtl/03-language-switch.yaml
// (the modules it calls have their own tests; test/integration/i18n/start-shell-imports.test.ts
// pins the polyfills as the first import).
// This import stays first: the Intl polyfills are evaluated before any other Shell or game module.
import '@e07/shell/i18n/intl-polyfills.ts';

import { registerRootComponent } from 'expo';
import { getLocales } from 'expo-localization';

import { createShellApp } from '@e07/shell/app/create-shell-app.tsx';
import { createStartupSplash } from '@e07/shell/app/create-startup-splash.tsx';
import {
  isHeldParitySplash,
  parityLaunchFor,
  readParityLaunch,
  withParityRoot,
} from '@e07/shell/app/parity-startup.tsx';
import { markJsEntry } from '@e07/shell/app/perf/cold-start.ts';
import { languageFromRawSave, planDirection } from '@e07/shell/i18n/direction-plan.ts';
import { readLayoutDirection, restartForDirection } from '@e07/shell/i18n/direction.ts';
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { peekCurrentSave } from '@e07/shell/services/save/peek-current-save.ts';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { ParityLaunch } from '@e07/shell/app/parity-startup.tsx';
import type { ShellGameModule, ShellGameTypes } from '@e07/shell/game-host/shell-game-module.ts';
import type { DirectionPlan } from '@e07/shell/i18n/direction-plan.ts';
import type { Language } from '@e07/shell/i18n/languages.ts';

/** The S1 parity frame keeps the splash up: its restart never runs. */
const holdSplash = (): Promise<void> => new Promise<void>(() => undefined);

// Called by apps/<game>/index.ts. Nothing here writes the save before the direction check:
// a reload re-runs every module, so writes before it would happen twice (verified gotcha).
export function startShell<T extends ShellGameTypes>(game: ShellGameModule<T>): void {
  // Test builds: a parity capture (toybox-visual-parity) launches into one design frame; a
  // malformed request shows only the error view. Store builds always get { kind: 'normal' }.
  const parity = readParityLaunch();
  // The cold-start clock's JS entry mark (app/perf/, Shell step 7): once per runtime, in memory
  // only, so a direction reload marks its new runtime again and nothing is written twice.
  markJsEntry();
  if (parity.kind === 'error') {
    registerRootComponent(parity.root);
    return;
  }
  const guard = createSqliteKvDirectionGuardAdapter();
  const language =
    parity.kind === 'frame'
      ? parity.request.lang
      : resolveLanguage(languageFromRawSave(peekCurrentSave()), getLocales());
  const pendingRestart = guard.readPending();
  const plan = planDirection({ language, layout: readLayoutDirection(), pendingRestart });
  if (plan === 'restart') {
    // The splash (S1, drawn from the game module: no save, stores or host exist yet) calls
    // restart() in its mount effect. Reloading while the bundle is still being evaluated crashed a
    // Release build ("startSurface failed. Global was not installed").
    const restart = (): Promise<void> => restartForDirection(directionOf(language), guard);
    registerRootComponent(createStartupSplash({ game, language, restart }));
    return;
  }
  guard.writePending(null); // 'keep' or 'give-up' ('give-up' is logged by the app)
  startApp({ game, language, directionPlan: plan, parity });
}

type AppStart<T extends ShellGameTypes> = {
  readonly game: ShellGameModule<T>;
  readonly language: Language;
  readonly directionPlan: Exclude<DirectionPlan, 'restart'>;
  readonly parity: ParityLaunch;
};

/** After the direction check: the Shell (with a parity frame's launch), or the held S1 splash. */
function startApp<T extends ShellGameTypes>(start: AppStart<T>): void {
  const { game, language, parity } = start;
  if (parity.kind === 'frame' && isHeldParitySplash(parity.request)) {
    // The held S1 splash is registered outside the Shell root: the parity root wraps it too, so
    // the capture's hierarchy carries this launch's marker (parity.launch.<nonce>).
    const splash = createStartupSplash({ game, language, restart: holdSplash });
    registerRootComponent(withParityRoot(parity.request, splash));
    return;
  }
  const launch =
    parity.kind === 'frame' ? { launch: parityLaunchFor({ request: parity.request, game }) } : {};
  registerRootComponent(
    createShellApp({ game, language, directionPlan: start.directionPlan, ...launch }),
  );
}
