// packages/shell/src/screens/debug/debug-sheets.ts
// Test builds only (S15). The OS sheets S15's tools use: an action sheet to choose, an action sheet
// with a message to show text, and the share sheet to export. Player-facing dialogs are the Shell's
// S14 dialogs (ESLint bans Alert); the debug menu is English-only and never ships, so it uses the
// system sheets instead of new S14 kinds. iOS only, like the test builds.
import { ActionSheetIOS, Share } from 'react-native';

export type DebugSheets = {
  /** An action sheet with one button per label and Cancel; onChoice gets the label's index. */
  readonly choose: (
    title: string,
    labels: readonly string[],
    onChoice: (index: number) => void,
  ) => void;
  /** Text to read (state, error log): an action sheet with the text as its message and Close. */
  readonly show: (title: string, message: string) => void;
  /** The share sheet with the text (Copy, Save to Files, AirDrop: all on the device). */
  readonly share: (text: string) => Promise<void>;
};

const CANCEL = 'Cancel';

export const DEBUG_SHEETS: DebugSheets = {
  choose: (title, labels, onChoice) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...labels, CANCEL], cancelButtonIndex: labels.length },
      (index) => {
        if (index < labels.length) onChoice(index);
      },
    );
  },
  show: (title, message) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, message, options: ['Close'], cancelButtonIndex: 0 },
      () => undefined,
    );
  },
  share: async (text) => {
    await Share.share({ message: text });
  },
};
