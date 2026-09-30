// packages/shell/src/screens/dialogs/dialog-request.ts
// The S14 dialogs a screen model may open, each with the callback of its one action. Cancel,
// Later and OK only close the dialog; the host closes it after the action too.

export type DialogRequest =
  /** S10 / S11 "Reset statistics": onConfirm = useSettingsResets().onConfirmResetStats. */
  | { readonly kind: 'reset-stats'; readonly onConfirm: () => void }
  /**
   * S11 "Reset all progress" (2 s hold): onConfirm = useSettingsResets().onConfirmResetProgress.
   * frozenProgress: test builds only, the parity frame's hold held still at that share (0.46).
   */
  | {
      readonly kind: 'reset-progress';
      readonly onConfirm: () => void;
      readonly frozenProgress?: number;
    }
  /** S11a / S2 after a direction flip: onRestart awaits audio.dispose(), then restartForDirection. */
  | { readonly kind: 'restart-to-apply'; readonly onRestart: () => void }
  /** Pause "Restart level" when progress beyond a few moves would be lost. */
  | { readonly kind: 'restart-level'; readonly onRestart: () => void }
  /** Over Home after the save fell back to its backup copy. */
  | { readonly kind: 'save-restored' }
  /** A save from a newer app version: onUpdate opens the store page. */
  | { readonly kind: 'newer-save'; readonly gameName: string; readonly onUpdate: () => void };
