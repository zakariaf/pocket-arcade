// packages/shell/src/screens/debug/font-test-view.tsx
import { use } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { isArabicScript } from '@e07/shell/i18n/fonts.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';

import type { FontTestRow, FontTestSample } from './font-test-samples.ts';
import type { ReactNode } from 'react';

export type FontTestModel = { readonly rows: readonly FontTestRow[] };

export type FontTestViewProps = { readonly model: FontTestModel };

/**
 * A window of rows, never the whole page: about 570 texts drawn at once kept the main thread busy
 * for 30 s and timed out XCUITest's hierarchy query, so no Maestro flow could scroll or capture
 * the page. The seven type roles at mount (every bundled face: Lilita One, Rubik Regular and Bold,
 * Vazirmatn Regular and Bold) and a window of three screens keep it readable.
 */
const FIRST_ROWS = 7;
const WINDOW_SCREENS = 3;

const styles = StyleSheet.create({
  list: { flex: 1 },
  // ScreenBody's frame (the body's top padding, the gutters, one block gap between rows), as a
  // virtualized list: the page runs on under the home indicator and ends with its bottom padding.
  content: {
    paddingTop: LAYOUT.bodyPaddingTop,
    paddingInline: LAYOUT.screenGutter,
    gap: LAYOUT.blockGap,
  },
  row: { gap: 4 },
});

/**
 * The texts a row's face is made for. Game names (the brand face) are Latin in every language and
 * set in Lilita One, which has no Arabic letters, so a game-name row draws en and de only: Persian
 * and Sorani there fell back to a system font, and with the names' tracking TextKit looped on the
 * main thread until the simulator's UI queries timed out.
 */
function textsOf(row: FontTestRow): readonly FontTestSample[] {
  const texts = [...row.samples, ...row.alphabets];
  if (typeStyleOf(row.variant).face !== 'brand') return texts;
  return texts.filter((text) => !isArabicScript(text.language));
}

/** One row of the page: the variant's name, then its samples and alphabets. */
function rowOf(row: FontTestRow): ReactNode {
  return (
    <View style={styles.row}>
      <AppText text={row.variant} variant="caption" tone="muted" />
      {/* The samples, then the alphabets: one text per language each. */}
      {textsOf(row).map((entry) => (
        <AppText
          key={`${entry.language}:${entry.text}`}
          text={entry.text}
          variant={row.variant}
          language={entry.language}
        />
      ))}
    </View>
  );
}

/**
 * S15's font test page (test builds only; the design draws no page): each Toybox type role and
 * component text style, named, then drawn in en, de, fa and ckb with the fonts and line heights
 * the app uses: a short sample, then every letter and digit of the language (spec 7.6). Look for
 * clipped marks (the madda, the hamza seats), wrong line boxes and a fallback font. Back is the
 * stack's edge swipe.
 */
export function FontTestView({ model }: FontTestViewProps): ReactNode {
  const insetBottom = use(SafeAreaInsetsContext)?.bottom ?? 0;
  const paddingBottom = Math.max(LAYOUT.bodyPaddingBottom, insetBottom);
  return (
    <ScreenFrame testID="font-test.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom }]}
        data={model.rows}
        keyExtractor={(row) => row.variant}
        renderItem={({ item }) => rowOf(item)}
        initialNumToRender={FIRST_ROWS}
        windowSize={WINDOW_SCREENS}
      />
    </ScreenFrame>
  );
}
