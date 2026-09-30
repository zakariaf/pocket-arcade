// packages/shell/src/navigation/navigation-root.test.tsx
// The container around rootStack: the layout direction (never the language), the Shell theme, the
// resume initial state, and the reduce-motion cross-fade. rootStack itself is swapped for a probe
// stack with the same groups and guards, so this test runs before any real screen exists.
import {
  LocaleDirContext,
  createNavigationContainerRef,
  useRoute,
  useTheme,
} from '@react-navigation/native';
import { act, render, screen } from '@testing-library/react-native';
import { use } from 'react';
import { View } from 'react-native';

import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import { TEST_PALETTE } from '@e07/shell/testing/test-palette.ts';
import { createThemeSet, selectTheme } from '@e07/shell/theme/theme-set.ts';

import { NavigationRoot } from './navigation-root.tsx';
import { toNavigationTheme } from './navigation-theme.ts';

import type { NavigationRootProps } from './navigation-root.tsx';
import type { ParamListBase } from '@react-navigation/native';
import type { ReactNode } from 'react';

jest.mock('@e07/shell/app/test-only.ts', () => ({ TEST_ONLY: null }));

// The layout is right to left although the UI language (en) reads left to right: the container
// must follow the layout, as it does during the one launch before a direction reload.
jest.mock('@e07/shell/i18n/direction.ts', () => ({ readLayoutDirection: () => 'rtl' }));

function ProbeScreen(): ReactNode {
  const route = useRoute();
  const direction = use(LocaleDirContext);
  const { colors } = useTheme();
  return (
    <View
      testID={`probe.${route.name}`}
      accessibilityLabel={direction}
      accessibilityHint={colors.background}
    />
  );
}

jest.mock('@e07/shell/navigation/root-stack.tsx', () => {
  const { createNativeStackNavigator } = require('@react-navigation/native-stack');
  const guards = require('@e07/shell/navigation/route-guards.ts');
  return {
    rootStack: createNativeStackNavigator({
      screenOptions: { headerShown: false },
      groups: {
        FirstRun: { if: guards.useIsFirstRun, screens: { Tutorial: mockProbe() } },
        Main: { if: guards.useIsMainApp, screens: { Home: mockProbe(), Game: mockProbe() } },
      },
    }),
  };
});

function mockProbe(): () => ReactNode {
  return ProbeScreen;
}

const THEME = toNavigationTheme(
  selectTheme(createThemeSet(TEST_PALETTE), { scheme: 'dark', mode: 'standard' }),
);

type RootOptions = {
  readonly isFirstRunDone: boolean;
  readonly resume?: boolean;
  readonly reduceMotion?: 'on' | 'off';
  readonly debug?: Pick<NavigationRootProps, 'navigationRef' | 'onReady'>;
};

async function mountRoot(options: RootOptions) {
  const reduceMotion = options.reduceMotion ?? 'off';
  const { wrapper, stores } = createShellWrapper({ settings: { reduceMotion } });
  if (options.isFirstRunDone) {
    stores.settings.getState().dispatch({ type: 'set-language', language: 'en' });
    stores.settings.getState().dispatch({ type: 'finish-tutorial' });
  }
  const initialState =
    options.resume === true
      ? { index: 1, routes: [{ name: 'Home' }, { name: 'Game', params: { start: 'resume' } }] }
      : undefined;
  await render(<NavigationRoot initialState={initialState} theme={THEME} {...options.debug} />, {
    wrapper,
  });
  return stores;
}

type HostNode = { readonly props?: Record<string, unknown>; readonly children?: unknown[] };

/** The stackAnimation each native screen got (react-native-screens' host props in Jest). */
function stackAnimations(): unknown[] {
  const found: unknown[] = [];
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const host = node as HostNode;
    if (host.props?.['stackAnimation'] !== undefined) found.push(host.props['stackAnimation']);
    for (const child of host.children ?? []) visit(child);
  };
  visit(screen.root);
  return found;
}

describe('NavigationRoot', () => {
  it('opens the first-run group on a first launch and Home once it is finished', async () => {
    const stores = await mountRoot({ isFirstRunDone: false });
    expect(screen.getByTestId('probe.Tutorial')).toBeOnTheScreen();

    await act(() => {
      stores.settings.getState().dispatch({ type: 'finish-tutorial' });
    });
    expect(screen.getByTestId('probe.Home')).toBeOnTheScreen();
  });

  it('passes the layout direction and the Shell ground colour to every screen', async () => {
    await mountRoot({ isFirstRunDone: true });
    const home = screen.getByTestId('probe.Home');
    expect(home.props['accessibilityLabel']).toBe('rtl');
    expect(home.props['accessibilityHint']).toBe(THEME.colors.background);
  });

  it('reopens a killed run on top of Home from the resume initial state', async () => {
    await mountRoot({ isFirstRunDone: true, resume: true });
    expect(screen.getByTestId('probe.Game')).toBeOnTheScreen();
    expect(stackAnimations()).toStrictEqual(['default', 'default']);
  });

  it('cross-fades pushes while Reduce motion is on', async () => {
    await mountRoot({ isFirstRunDone: true, resume: true, reduceMotion: 'on' });
    expect(stackAnimations()).toStrictEqual(['fade', 'fade']);
  });

  it('hands the container to the debug ref and reports when it is ready (test builds)', async () => {
    const navigationRef = createNavigationContainerRef<ParamListBase>();
    const onReady = jest.fn();
    await mountRoot({ isFirstRunDone: true, debug: { navigationRef, onReady } });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(navigationRef.isReady()).toBe(true);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Home');
  });
});
