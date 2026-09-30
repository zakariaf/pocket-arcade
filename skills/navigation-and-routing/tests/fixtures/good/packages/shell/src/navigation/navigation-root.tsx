// packages/shell/src/navigation/navigation-root.tsx
import { createStaticNavigation } from '@react-navigation/native';

import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { readLayoutDirection } from '@e07/shell/i18n/direction.ts';
import { rootStack } from '@e07/shell/navigation/root-stack.tsx';

import type { InitialState, Theme } from '@react-navigation/native';
import type { ReactNode } from 'react';

/**
 * The static stack, wrapped once so its screen options can read hooks: with Reduce motion on,
 * pushes cross-fade instead of sliding. Everything else comes from rootStack's own config.
 */
const motionAwareStack = rootStack.with(function MotionAwareStack({ Navigator }) {
  const isReduced = useReduceMotion();
  return <Navigator screenOptions={{ animation: isReduced ? 'fade' : 'default' }} />;
});

const Navigation = createStaticNavigation(motionAwareStack);

export type NavigationRootProps = {
  /** [Home, Game(resume)] when the last session was killed inside the Game screen. */
  readonly initialState: InitialState | undefined;
  /** Built once from the Shell theme with toNavigationTheme(), so no white flash in dark. */
  readonly theme: Theme;
};

/** The navigation container. No `linking` prop: the store app has no deep links. */
export function NavigationRoot({ initialState, theme }: NavigationRootProps): ReactNode {
  // The layout's own direction source (I18nManager, read only by i18n/direction.ts), never
  // the language setting: during the one launch before a direction reload they disagree.
  const direction = readLayoutDirection();
  // exactOptionalPropertyTypes: omit the prop instead of passing undefined.
  const resume = initialState === undefined ? {} : { initialState };
  return <Navigation direction={direction} theme={theme} {...resume} />;
}
