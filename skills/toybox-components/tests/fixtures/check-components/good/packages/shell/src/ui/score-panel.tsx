// packages/shell/src/ui/score-panel.tsx
import { StyleSheet, View } from 'react-native';

import { MOTION_MS } from '@e07/shell/theme/motion.ts';
import { SHELL_COLORS } from '@e07/shell/theme/shell-colors.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { Icon } from './icons/icon.tsx';
import { Panel } from './panel.tsx';
import { Sticker } from './sticker.tsx';

import type { ReactNode } from 'react';

const ROW_GAP = 6;
const COLUMN_GAP = 12;
const LINES_GAP = 6;
const LINES_SPACE = 12;
const RULE = 2;
const CHECK = 20;
const LINE_GAP = 8;

/**
 * The win's third line. `moves` for levels rated by moves against par (result.win.moves,
 * "7 moves – par 7"); `score` for levels whose stars rule is score-based, where par is never shown
 * (result.win.score-line, "Score 1,840 – best 1,840"). The kind picks the part id.
 */
export type ScorePanelLine = { readonly kind: 'moves' | 'score'; readonly text: string };

/** The part id of each line kind, spelled out so the testID map and flows can grep it. */
const LINE_PART: Readonly<Record<ScorePanelLine['kind'], string>> = {
  moves: 'moves-line',
  score: 'score-line',
};

export type ScorePanelProps = {
  /**
   * `result.score-card`: parts `.label`, `.value`, `.new-best`, `.progress-line`, and
   * `.moves-line` or `.score-line` (from the line's kind).
   */
  readonly testIDBase: string;
  /** Translated "Score". */
  readonly label: string;
  /** Formatted in the chosen digits. */
  readonly value: string;
  /** Translated "New best!" when this run beat the best score; slaps in at 950 ms. */
  readonly newBestText?: string;
  /** The game's full progress line ("All 10 monsters defeated"). */
  readonly progressLine: string;
  /** The win's moves or score line; the daily and endless results have none. */
  readonly line?: ScorePanelLine;
  readonly isReducedMotion: boolean;
};

const styles = StyleSheet.create({
  first: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: ROW_GAP,
    columnGap: COLUMN_GAP,
  },
  push: { flexGrow: 1, alignItems: 'flex-end' },
  lines: { gap: LINES_GAP, marginTop: LINES_SPACE, paddingTop: LINES_SPACE, borderTopWidth: RULE },
  line: { flexDirection: 'row', alignItems: 'center', gap: LINE_GAP },
  lineText: { flexShrink: 1 },
});

/** The S7 win score: label, big value, the New best sticker, then the progress and the win line. */
export function ScorePanel(props: ScorePanelProps): ReactNode {
  const theme = useTheme();
  const shell = SHELL_COLORS[theme.scheme];
  const base = props.testIDBase;
  return (
    <Panel testID={base} gap={0}>
      <View style={styles.first}>
        <AppText text={props.label} variant="scoreLabel" tone="muted" testID={`${base}.label`} />
        <AppText text={props.value} variant="scoreValue" testID={`${base}.value`} />
        {props.newBestText === undefined ? null : (
          <View style={styles.push}>
            <Sticker
              text={props.newBestText}
              icon="rating-star"
              testID={`${base}.new-best`}
              slapDelayMs={MOTION_MS.newBestStickerDelay}
              isReducedMotion={props.isReducedMotion}
            />
          </View>
        )}
      </View>
      <View style={[styles.lines, { borderColor: shell.line }]}>
        <View style={styles.line}>
          <Icon name="check" color={shell.success} size={CHECK} />
          <View style={styles.lineText}>
            <AppText
              text={props.progressLine}
              variant="scoreLines"
              testID={`${base}.progress-line`}
            />
          </View>
        </View>
        {props.line === undefined ? null : (
          <AppText
            text={props.line.text}
            variant="scoreLines"
            testID={`${base}.${LINE_PART[props.line.kind]}`}
          />
        )}
      </View>
    </Panel>
  );
}
