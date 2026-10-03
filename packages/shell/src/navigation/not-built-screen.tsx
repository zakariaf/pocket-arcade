// packages/shell/src/navigation/not-built-screen.tsx
// Partial Shell only (shell-slice.json at the repo root): the stand-in for every route whose screen
// is outside the slice. root-stack.tsx keeps the whole route table and points those routes here, so
// the typed RootParamList, every navigate() call in the model hooks and the first-run flow all work
// before the screen exists. It shows the route name and uses only existing common.* keys (no new
// copy). check-navigation.mjs fails a slice screen that still points here, and --complete fails
// while any route does.
import { useNavigation, useRoute } from '@react-navigation/native';

import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { selectDispatch } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';
import type { StaticScreenProps } from '@react-navigation/native';
import type { ReactNode } from 'react';

/**
 * The FirstRun routes have no Back: their placeholder finishes the step with the same action the
 * real screen dispatches, so the groups' if-hooks move a first launch on to Home.
 */
const FIRST_RUN_DONE: Readonly<Record<string, SettingsAction>> = {
  // S2 saves the chosen language; null keeps "System", which is what a slice build wants.
  LanguageChoice: { type: 'set-language', language: null },
  // The tutorial level's last step (or Skip).
  Tutorial: { type: 'finish-tutorial' },
};

/**
 * Generic over the route's params so the typed RootParamList stays whole: routes without params use
 * `NotBuiltScreen`, the Game route uses `NotBuiltScreen<GameParams>` (an instantiation expression).
 */
export function NotBuiltScreen<TParams extends Record<string, unknown> | undefined = undefined>(
  _props: StaticScreenProps<TParams>,
): ReactNode {
  const t = useT();
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useSettingsStore(selectDispatch);
  const isReducedMotion = useReduceMotion();
  const firstRunDone = FIRST_RUN_DONE[route.name];
  const back =
    firstRunDone === undefined
      ? {
          onBack: () => {
            navigation.goBack();
          },
          backLabel: t('common.back'),
        }
      : {};
  return (
    <ScreenFrame testID="not-built.screen">
      <TopBar
        testID="not-built.top-bar"
        title={route.name}
        isReducedMotion={isReducedMotion}
        {...back}
      />
      <ScreenBody>
        <AppText text={route.name} tone="muted" testID="not-built.route-name" />
        {firstRunDone === undefined ? null : (
          <Button
            testID="not-built.next-button"
            label={t('common.next')}
            onPress={() => {
              dispatch(firstRunDone);
            }}
            kind="primary"
            iconEnd="forward"
            isBlock
            isReducedMotion={isReducedMotion}
          />
        )}
      </ScreenBody>
    </ScreenFrame>
  );
}
