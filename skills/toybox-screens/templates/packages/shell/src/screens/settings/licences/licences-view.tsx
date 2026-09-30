// packages/shell/src/screens/settings/licences/licences-view.tsx
import { StyleSheet, View } from 'react-native';

import { isolate } from '@e07/shell/i18n/bidi.ts';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ListGroup } from '@e07/shell/ui/list-group.tsx';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { QuietButton } from '@e07/shell/ui/quiet-button.tsx';
import { ScreenBody } from '@e07/shell/ui/screen-body.tsx';
import { ScreenFrame, UNDER_HOME_INDICATOR_EDGES } from '@e07/shell/ui/screen-frame.tsx';
import { TopBar } from '@e07/shell/ui/top-bar.tsx';

import type { LicenceEntry, LicenceGroupId } from './licence-entries.ts';
import type { TFunction } from '@e07/shell/i18n/create-t.ts';
import type { ShellMessageKey } from '@e07/shell/i18n/messages.ts';
import type { IconName } from '@e07/shell/ui/icons/icon-paths.ts';
import type { ListRowProps } from '@e07/shell/ui/list-row.tsx';
import type { ReactNode } from 'react';

export type LicencesModel = {
  readonly gameName: string;
  /** shellLicenceEntries(t) followed by the game's own credits. */
  readonly entries: readonly LicenceEntry[];
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  /** Opens the full licence text of one entry. */
  readonly onShowText: (key: string) => void;
};

export type LicencesViewProps = { readonly model: LicencesModel };

const styles = StyleSheet.create({
  column: { gap: 4 },
  nudge: { alignSelf: 'flex-start' },
});

const GROUPS: readonly { id: LicenceGroupId; titleKey: ShellMessageKey; icon: IconName }[] = [
  { id: 'fonts', titleKey: 'licences.group.fonts', icon: 'doc' },
  { id: 'software', titleKey: 'licences.group.software', icon: 'grid' },
  { id: 'ads-store', titleKey: 'licences.group.ads-store', icon: 'ad' },
  { id: 'sounds', titleKey: 'licences.group.sounds', icon: 'music' },
];

/** Name and version, isolated left-to-right so an RTL page cannot reorder "Vazirmatn 33.003". */
function nameOf(entry: LicenceEntry): string {
  return isolate(entry.version === undefined ? entry.name : `${entry.name} ${entry.version}`);
}

/** The licence line (and, on a column row, the quiet "Show licence text") under the name. */
function licenceBlock(entry: LicenceEntry, model: LicencesModel, t: TFunction): ReactNode {
  const id = `licences.entry-row.${entry.key}`;
  const licence = (
    <AppText text={entry.licence} variant="rowDescription" tone="muted" testID={`${id}.licence`} />
  );
  if (entry.description === undefined) return licence;
  return (
    <View style={styles.column}>
      {licence}
      <View style={styles.nudge}>
        <QuietButton
          testID={`${id}.show-text-button`}
          label={t('licences.show-text')}
          iconEnd="chevron"
          onPress={() => {
            model.onShowText(entry.key);
          }}
          isReducedMotion={model.isReducedMotion}
        />
      </View>
    </View>
  );
}

/** A chevron row opens the licence text; a column row (with a description) has the nudge instead. */
function entryProps(entry: LicenceEntry, model: LicencesModel): Partial<ListRowProps> {
  if (entry.description !== undefined) return { description: entry.description };
  return {
    end: 'chevron',
    onPress: () => {
      model.onShowText(entry.key);
    },
  };
}

/**
 * S11d Licences (body gap 18): the intro, then four group tabs over lists. Every row puts its
 * licence (`.licence`) under the name through ListRow's `below` slot; a row with a description
 * is a column row with a quiet "Show licence text" (`.show-text-button`), the others are
 * chevron rows.
 */
export function LicencesView({ model }: LicencesViewProps): ReactNode {
  const t = useT();
  return (
    <ScreenFrame testID="licences.screen" edges={UNDER_HOME_INDICATOR_EDGES}>
      <TopBar
        testID="licences.top-bar"
        title={t('settings.licences.label')}
        backLabel={t('common.back')}
        onBack={model.onBack}
        isReducedMotion={model.isReducedMotion}
      />
      <ScreenBody gap="long" isUnderHomeIndicator>
        <AppText text={t('licences.intro', { gameName: model.gameName })} testID="licences.intro" />
        {GROUPS.map((group) => (
          <ListGroup
            key={group.id}
            testID={`licences.group.${group.id}`}
            title={t(group.titleKey)}
            icon={group.icon}
          >
            {model.entries
              .filter((entry) => entry.group === group.id)
              .map((entry, index) => (
                <ListRow
                  key={entry.key}
                  testID={`licences.entry-row.${entry.key}`}
                  label={nameOf(entry)}
                  isFirst={index === 0}
                  below={licenceBlock(entry, model, t)}
                  isReducedMotion={model.isReducedMotion}
                  {...entryProps(entry, model)}
                />
              ))}
          </ListGroup>
        ))}
      </ScreenBody>
    </ScreenFrame>
  );
}
