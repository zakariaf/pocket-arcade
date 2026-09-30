// packages/shell/src/app/shell-providers.tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@e07/shell/theme/theme-provider.tsx';

import { MotionConfig } from './motion-config.tsx';
import { ShellErrorBoundary } from './shell-error-boundary.tsx';
import { watchSystemA11y } from './system-a11y-store.ts';

import type { ThemeSet } from '@e07/shell/theme/theme-set.ts';
import type { ReactNode } from 'react';

export type ShellProvidersProps = {
  readonly themes: ThemeSet;
  /** Writes to ErrorLogPort (local only). Must not throw. */
  readonly onError: (error: unknown, componentStack: string) => void;
  /** The crash fallback (the S14 crash dialog): one way out, never an automatic retry. */
  readonly renderFallback: (reset: () => void) => ReactNode;
  readonly children: ReactNode;
};

const styles = StyleSheet.create({ root: { flex: 1 } });

/** The root provider stack, inside the stores and i18n providers. */
export function ShellProviders(props: ShellProvidersProps): ReactNode {
  const { themes, onError, renderFallback, children } = props;
  // Allowed effect: subscribe to an external system, return the unsubscribe.
  useEffect(
    () =>
      watchSystemA11y((error) => {
        onError(error, 'watchSystemA11y');
      }),
    [onError],
  );
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider themes={themes}>
          <MotionConfig />
          <ShellErrorBoundary onError={onError} renderFallback={renderFallback}>
            {children}
          </ShellErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
