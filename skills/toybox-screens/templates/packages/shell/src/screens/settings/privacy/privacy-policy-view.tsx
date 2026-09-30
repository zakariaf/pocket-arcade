// packages/shell/src/screens/settings/privacy/privacy-policy-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ArtTile } from '@e07/shell/ui/art-tile.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { MessageValues } from '@e07/shell/i18n/create-t.ts';
import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
import type { ReactNode } from 'react';

export type PrivacyPolicyModel = {
  readonly gameName: string;
  readonly emailText: string;
  /** date.day-month-year of the policy's last change, formatted by the Shell date formatter. */
  readonly updatedDateText: string;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
};

export type PrivacyPolicyViewProps = { readonly model: PrivacyPolicyModel };

type PolicySection = {
  readonly id: 'game' | 'ads' | 'purchase' | 'backup' | 'contact';
  readonly titleKey: ShellMessageKey;
  readonly bodyKey: ShellMessageKey;
};

/** The five sections in order. The same text is the web policy the stores link to (offline copy). */
const SECTIONS: readonly PolicySection[] = [
  { id: 'game', titleKey: 'privacy.game.title', bodyKey: 'privacy.game.body' },
  { id: 'ads', titleKey: 'privacy.ads.title', bodyKey: 'privacy.ads.body' },
  { id: 'purchase', titleKey: 'privacy.purchase.title', bodyKey: 'privacy.purchase.body' },
  { id: 'backup', titleKey: 'privacy.backup.title', bodyKey: 'privacy.backup.body' },
  { id: 'contact', titleKey: 'privacy.contact.title', bodyKey: 'privacy.contact.body' },
];

/** Art tile to the summary heading. */
const SUMMARY_GAP = 14;

const styles = StyleSheet.create({
  summaryText: { flex: 1 },
  section: { gap: 6 },
});

/** S11c Privacy policy (body gap 18): the summary panel, five sections, the last-updated line. */
export function PrivacyPolicyView({ model }: PrivacyPolicyViewProps): ReactNode {
  const t = useT();
  const values: MessageValues = { gameName: model.gameName, emailText: model.emailText };
  return (
    <ScreenFrame testID="privacy-policy.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="privacy-policy.top-bar"
        title={t('settings.privacy-policy.label')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody gap="long" isUnderHomeIndicator>
        <Panel testID="privacy-policy.summary-card" isRow gap={SUMMARY_GAP}>
          <ArtTile
            testID="privacy-policy.summary-card.art"
            icon="shield"
            paint="gold"
            size="summary"
          />
          <View style={styles.summaryText}>
            <AppText
              text={t('privacy.summary')}
              variant="heading"
              isHeader
              testID="privacy-policy.summary-card.label"
            />
          </View>
        </Panel>
        {SECTIONS.map((section) => {
          const id = `privacy-policy.section.${section.id}`;
          return (
            <View key={section.id} style={styles.section} testID={id}>
              <AppText
                text={t(section.titleKey)}
                variant="heading"
                isHeader
                testID={`${id}.title`}
              />
              <AppText text={t(section.bodyKey, values)} variant="prose" testID={`${id}.body`} />
            </View>
          );
        })}
        <AppText
          text={t('privacy.updated', { dateText: model.updatedDateText })}
          variant="caption"
          tone="muted"
          testID="privacy-policy.updated"
        />
      </ScreenBody>
    </ScreenFrame>
  );
}
