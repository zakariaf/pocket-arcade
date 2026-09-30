// packages/shell/src/app/shell-navigator.tsx
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { DialogProvider } from '@e07/shell/app/dialog-context.tsx';
import { LoadOutcomeOpener } from '@e07/shell/app/load-outcome-opener.tsx';
import { NavigationRoot } from '@e07/shell/navigation/navigation-root.tsx';
import { toNavigationTheme } from '@e07/shell/navigation/navigation-theme.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { LoadOutcome } from '@e07/shell/services/save/load-plan.ts';
import type { InitialState } from '@react-navigation/native';
import type { ReactNode } from 'react';

export type ShellNavigatorProps = {
  /** e2e-maestro's createDebugParts: services and links are null in store builds. */
  readonly debug: DebugParts;
  readonly initialState: InitialState | undefined;
  /** hydrated.outcome: the S14 dialog it asks for opens once over the first screen (null: none). */
  readonly loadOutcome: LoadOutcome | null;
};

/**
 * The debug services and link handler (test builds), the S14 dialog host (with the save's load
 * outcome dialog) and the navigator, themed. Once the navigator is ready the debug link handler starts (the pending screen of a
 * reload, the launch link, then every link); a remounted navigator stops the old one first.
 */
export function ShellNavigator({
  debug,
  initialState,
  loadOutcome,
}: ShellNavigatorProps): ReactNode {
  const theme = useTheme();
  const stopLinksRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      stopLinksRef.current?.();
    },
    [],
  );
  const handleReady = (): void => {
    stopLinksRef.current?.();
    stopLinksRef.current = debug.links?.start(Linking) ?? null;
  };
  return (
    <DebugServicesProvider services={debug.services} links={debug.links}>
      <DialogProvider>
        <NavigationRoot
          initialState={initialState}
          theme={toNavigationTheme(theme)}
          navigationRef={debug.navigationRef}
          onReady={handleReady}
        />
        {loadOutcome === null ? null : <LoadOutcomeOpener outcome={loadOutcome} />}
      </DialogProvider>
    </DebugServicesProvider>
  );
}
