// packages/shell/src/screens/pause/pause-model.ts
// What S6 Pause draws. use-pause-model.ts builds it from the settings store and the session.
import type { GameSessionControls } from '@e07/shell/game-host/use-game-session-controls.ts';

/**
 * What Pause needs of the paused run. The Game screen passes its GameSessionControls, which fit:
 * the view (its ref names the mode, its move count decides the restart dialog) and startRun.
 */
export type PauseSession = Pick<GameSessionControls, 'view' | 'startRun'>;

export type PauseSwitch = { readonly isOn: boolean; readonly onToggle: () => void };

export type PauseModel = {
  /** game-screen.mode.level ("Level 12"), game-screen.mode.daily or common.mode.endless. */
  readonly modeText: string;
  readonly sound: PauseSwitch;
  /** null when the game has no music (the Settings row is hidden too). */
  readonly music: PauseSwitch | null;
  /** null on devices without haptics (iPad). */
  readonly vibration: PauseSwitch | null;
  /** Opens the restart-level dialog when progress beyond a few moves would be lost. */
  readonly onRestart: () => void;
  /** navigate('HowToPlay'): the run stays paused underneath. */
  readonly onHowToPlay: () => void;
  readonly isReducedMotion: boolean;
};
