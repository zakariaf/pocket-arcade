// packages/shell/src/screens/result/result-frame.tsx
// The parts every S7 result (win, lose, daily, endless) shares: the frame under the home
// indicator with the mode chip on top and the keys at the bottom, and the score panel's New best.
import { StyleSheet, View } from 'react-native';

import { Chip } from '@e07/shell/ui/chip.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ReactNode } from 'react';

export type ResultFrameProps = {
  /** The mode chip's text ("Level 12", "Daily – 26 Sep", "Endless"). */
  readonly modeText: string;
  /** The keys at the bottom, under the spacer that takes the free height. */
  readonly keys: ReactNode;
  /** Another spacer above the blocks, so they sit centred between the chip and the keys (lose). */
  readonly isCentred?: boolean;
  /** The result's own blocks, between the mode chip and the keys. */
  readonly children: ReactNode;
};

// Chip and Sticker align themselves to the start (alignSelf), which beats a wrapper's alignItems:
// only a centred row centres them.
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  grow: { flexGrow: 1 },
});

/**
 * result.screen with its body under the home indicator, ending with 34 pt: room for the last
 * key's hard shadow. The centred mode chip comes first, then the result's own blocks, a spacer
 * that takes the free height, and the keys.
 */
export function ResultFrame(props: ResultFrameProps): ReactNode {
  return (
    <ScreenFrame testID="result.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.chip}>
          <Chip testID="result.mode-chip" text={props.modeText} />
        </View>
        {props.isCentred === true ? <View style={styles.grow} /> : null}
        {props.children}
        <View style={styles.grow} />
        {props.keys}
      </ScreenBody>
    </ScreenFrame>
  );
}

/** The score panel's New best sticker text, only for a new best (ScorePanel's newBestText). */
export function newBestOf(isNewBest: boolean, t: TFunction): { readonly newBestText?: string } {
  return isNewBest ? { newBestText: t('result.win.new-best') } : {};
}
