// packages/shell/src/screens/debug/font-test-view.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';

import type { FontTestRow } from './font-test-samples.ts';
import type { ReactNode } from 'react';

export type FontTestModel = { readonly rows: readonly FontTestRow[] };

export type FontTestViewProps = { readonly model: FontTestModel };

const styles = StyleSheet.create({ row: { gap: 4 } });

/**
 * S15's font test page (test builds only; the design draws no page): each Toybox type role and
 * component text style, named, then drawn in en, de, fa and ckb with the fonts and line heights
 * the app uses: a short sample, then every letter and digit of the language (spec 7.6). Look for
 * clipped marks (the madda, the hamza seats), wrong line boxes and a fallback font. Back is the
 * stack's edge swipe.
 */
export function FontTestView({ model }: FontTestViewProps): ReactNode {
  return (
    <ScreenFrame testID="font-test.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <ScreenBody isUnderHomeIndicator>
        {model.rows.map((row) => (
          <View key={row.variant} style={styles.row}>
            <AppText text={row.variant} variant="caption" tone="muted" />
            {row.samples.map((sample) => (
              <AppText
                key={sample.language}
                text={sample.text}
                variant={row.variant}
                language={sample.language}
              />
            ))}
            {row.alphabets.map((alphabet) => (
              <AppText
                key={`alphabet-${alphabet.language}`}
                text={alphabet.text}
                variant={row.variant}
                language={alphabet.language}
              />
            ))}
          </View>
        ))}
      </ScreenBody>
    </ScreenFrame>
  );
}
