// packages/shell/src/screens/result/result-win-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { ResultStars } from '@e07/shell/ui/result-stars.tsx';
import { ScorePanel } from '@e07/shell/ui/score-panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { Sticker } from '@e07/shell/ui/sticker.tsx';

import { ResultWinActions } from './result-win-actions.tsx';

import type { WinResult } from './result-model.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ScorePanelLine } from '@e07/shell/ui/score-panel.tsx';
import type { ReactNode } from 'react';

export type ResultWinViewProps = { readonly model: WinResult };

const MAX_STARS = 3;
/** The win title sticker slaps in after the stars (Toybox motion). */
const WIN_STICKER_DELAY_MS = 700;

// Chip and Sticker align themselves to the start (alignSelf), which beats a wrapper's alignItems:
// only a centred row centres them.
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  sticker: { flexDirection: 'row', justifyContent: 'center', marginTop: -2 },
  grow: { flexGrow: 1 },
});

/** The line under the progress line: moves against par, or the score and the level's best (L3). */
function winLineOf(model: WinResult, t: TFunction): ScorePanelLine {
  if (model.par === null) {
    const values = { score: model.score, bestScore: model.bestScore };
    return { kind: 'score', text: t('result.win.score-line', values) };
  }
  const values = { movesCount: model.movesCount, par: model.par };
  return { kind: 'moves', text: t('result.win.moves', values) };
}

/**
 * S7 win: level chip, stars, "Level complete!", the game's win-title sticker, the score panel,
 * then Next level (hero), Replay and Levels, and the once-a-day Premium nudge. The body runs under
 * the home indicator and ends with 34 pt, so the last key's hard shadow is never clipped.
 */
export function ResultWinView({ model }: ResultWinViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="result.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.chip}>
          <Chip testID="result.mode-chip" text={model.modeText} />
        </View>
        <ResultStars
          testID={`result.stars-${String(model.stars)}`}
          count={model.stars}
          label={t('result.win.stars.a11y-label', { starsCount: model.stars, maxStars: MAX_STARS })}
          isReducedMotion={model.isReducedMotion}
        />
        <AppText
          text={t('result.win.title')}
          variant="display"
          align="center"
          isHeader
          testID="result.title"
        />
        <View style={styles.sticker}>
          <Sticker
            testID="result.win-sticker"
            text={model.winTitle}
            paper="accent"
            tiltDeg={-3}
            slapDelayMs={WIN_STICKER_DELAY_MS}
            isReducedMotion={model.isReducedMotion}
          />
        </View>
        <ScorePanel
          testIDBase="result.score-card"
          label={t('common.score')}
          value={model.scoreText}
          {...(model.isNewBest ? { newBestText: t('result.win.new-best') } : {})}
          progressLine={model.progressText}
          line={winLineOf(model, t)}
          isReducedMotion={model.isReducedMotion}
        />
        <View style={styles.grow} />
        <ResultWinActions model={model} />
      </ScreenBody>
    </ScreenFrame>
  );
}
