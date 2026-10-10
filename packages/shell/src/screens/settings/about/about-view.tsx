// packages/shell/src/screens/settings/about/about-view.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Chip } from '@e07/shell/ui/chip.tsx';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { List } from '@e07/shell/ui/list.tsx';
import { LogoTile } from '@e07/shell/ui/logo-tile.tsx';
import { Panel } from '@e07/shell/ui/panel.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import { AboutFacts } from './about-facts.tsx';

import type { LogoArt } from '@e07/shell/art/logo-art.ts';
import type { ReactNode } from 'react';

export type AboutModel = {
  /** The game's logo data for the 92 pt cut logo tile. */
  readonly logo: LogoArt;
  readonly gameName: string;
  readonly tagline: string;
  readonly versionText: string;
  readonly emailText: string;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onContact: () => void;
  readonly onOpenLicences: () => void;
};

export type AboutViewProps = { readonly model: AboutModel };

/** Title to body inside the support panel. */
const SUPPORT_GAP = 6;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 6, paddingBottom: 4 },
  identity: { flex: 1, alignItems: 'flex-start', gap: 6 },
});

/**
 * S11b About and credits: the cut logo, name, tagline and version chip; three facts without
 * chevrons; the support panel; Contact and Licences rows. Both lists have no tab (List).
 */
export function AboutView({ model }: AboutViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="about.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="about.top-bar"
        title={t('settings.about.label')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody isUnderHomeIndicator>
        <View style={styles.header} testID="about.header">
          <LogoTile testID="about.logo" logo={model.logo} variant="about" />
          <View style={styles.identity}>
            <AppText
              text={model.gameName}
              variant="gameNameAbout"
              isHeader
              testID="about.game-name"
            />
            <AppText text={model.tagline} tone="muted" testID="about.tagline" />
            <Chip
              testID="about.version-chip"
              text={t('about.version', { versionText: model.versionText })}
            />
          </View>
        </View>
        <AboutFacts isReducedMotion={model.isReducedMotion} />
        <Panel testID="about.support-card" gap={SUPPORT_GAP}>
          <AppText
            text={t('about.support.label')}
            variant="heading"
            isHeader
            testID="about.support-card.title"
          />
          <AppText
            text={t('about.support.body', { emailText: model.emailText })}
            testID="about.support-card.body"
          />
        </Panel>
        <List testID="about.links-list">
          <ListRow
            testID="about.contact-row"
            icon="mail"
            label={t('settings.contact.label')}
            end="chevron"
            onPress={model.onContact}
            isFirst
            isReducedMotion={model.isReducedMotion}
          />
          <ListRow
            testID="about.licences-row"
            icon="doc"
            label={t('settings.licences.label')}
            end="chevron"
            onPress={model.onOpenLicences}
            isReducedMotion={model.isReducedMotion}
          />
        </List>
      </ScreenBody>
    </ScreenFrame>
  );
}
