// packages/shell/src/screens/pause/pause-overlay.tsx
// device-only: covered by the e2e flow that pauses a level (S6); a route file only joins its model hook and its view, which have their own tests.
import { StyleSheet, View } from 'react-native';

import { PauseView } from './pause-view.tsx';
import { usePauseModel } from './use-pause-model.ts';

import type { PauseSession } from './pause-model.ts';
import type { ReactNode } from 'react';

export type PauseOverlayProps = {
  /** The Game screen's GameSessionControls (usePauseModel reads the run and restarts it). */
  readonly session: PauseSession;
  readonly onResume: () => void;
  /** GameScreen's handleHome: sets the leaving ref, saves the run, popTo('Home'). */
  readonly onHome: () => void;
};

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill } });

/** S6 as an overlay inside Game: the board stays mounted and paused underneath. */
export function PauseOverlay({ session, onResume, onHome }: PauseOverlayProps): ReactNode {
  const model = usePauseModel(session);
  return (
    <View style={styles.fill}>
      <PauseView model={model} onResume={onResume} onHome={onHome} />
    </View>
  );
}
