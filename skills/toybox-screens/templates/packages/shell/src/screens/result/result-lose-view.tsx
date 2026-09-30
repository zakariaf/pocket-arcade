// packages/shell/src/screens/result/result-lose-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Button } from '@e07/shell/ui/button.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';
import { LogoTile } from '@e07/shell/ui/logo-tile.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';

import { ContinueOffer } from './continue-offer.tsx';

import type { LoseResult } from './result-model.ts';
import type { ReactNode } from 'react';

export type ResultLoseViewProps = { readonly model: LoseResult };

// Chip and Sticker align themselves to the start (alignSelf): only a centred row centres them.
const styles = StyleSheet.create({
  chip: { flexDirection: 'row', justifyContent: 'center', paddingTop: 4 },
  logo: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  reasonText: { flex: 1 },
  grow: { flexGrow: 1 },
});

/**
 * S7 lose: chip, the tilted logo, "Not this time", the friendly reason, the optional Continue
 * offer (once per level), then Try again (hero) and Levels.
 */
export function ResultLoseView({ model }: ResultLoseViewProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  const { actions, isReducedMotion } = model;
  return (
    <ScreenFrame testID="result.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      {/* Under the home indicator, ending with 34 pt: room for the last key's hard shadow. */}
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.chip}>
          <Chip testID="result.mode-chip" text={model.modeText} />
        </View>
        <View style={styles.grow} />
        <View style={styles.logo}>
          <LogoTile testID="result.logo" logo={model.logo} variant="lose" />
        </View>
        <AppText
          text={t('result.lose.title')}
          variant="display"
          align="center"
          isHeader
          testID="result.title"
        />
        <Panel testID="result.reason-card" isRow>
          <Icon
            name="alert"
            color={theme.colors.danger}
            size={28}
            testID="result.reason-card.icon"
          />
          <View style={styles.reasonText}>
            <AppText
              text={model.loseReason ?? t('result.lose.reason.no-moves')}
              variant="heading"
              isHeader
              testID="result.reason-card.label"
            />
          </View>
        </Panel>
        <ContinueOffer model={model} />
        <View style={styles.grow} />
        <Button
          testID="result.try-again-button"
          label={t('common.try-again')}
          onPress={actions.onTryAgain}
          kind="primary"
          size="hero"
          cap="restore"
          isBlock
          isReducedMotion={isReducedMotion}
        />
        <Button
          testID="result.levels-button"
          label={t('common.levels')}
          onPress={actions.onLevels}
          icon="grid"
          isBlock
          isReducedMotion={isReducedMotion}
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
