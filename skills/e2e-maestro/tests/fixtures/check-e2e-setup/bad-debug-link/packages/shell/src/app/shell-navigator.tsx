// packages/shell/src/app/shell-navigator.tsx
import { Linking } from 'react-native';

import { DebugServicesProvider } from '@e07/shell/app/debug-services-context.tsx';
import { DialogProvider } from '@e07/shell/app/dialog-context.tsx';
import { NavigationRoot } from '@e07/shell/navigation/navigation-root.tsx';
import { toNavigationTheme } from '@e07/shell/navigation/navigation-theme.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import type { DebugParts } from '@e07/shell/app/create-debug-parts.ts';
import type { InitialState } from '@react-navigation/native';
import type { ReactNode } from 'react';

export type ShellNavigatorProps = {
  /** createDebugParts(...): the services and link handler are null in store builds. */
  readonly debug: DebugParts;
  readonly initialState: InitialState | undefined;
};

/** The debug services (test builds), the S14 dialog host and the navigator, themed. */
export function ShellNavigator(props: ShellNavigatorProps): ReactNode {
  const { debug, initialState } = props;
  const theme = useTheme();
  return (
    <DebugServicesProvider services={debug.services} links={debug.links}>
      <DialogProvider>
        <NavigationRoot
          container={debug.navigationRef}
          onReady={() => {
            // Test builds: the screen a direction reload was for, the launch link, every link.
            void Linking;
          }}
          initialState={initialState}
          theme={toNavigationTheme(theme)}
        />
      </DialogProvider>
    </DebugServicesProvider>
  );
}
