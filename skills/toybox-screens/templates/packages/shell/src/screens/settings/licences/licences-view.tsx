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
  // The nudge sits in the middle of the row (the design's .nudge), under the licence line.
  nudge: { alignSelf: 'center' },
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

/**
 * A chevron row: the bold name over its licence (the row's muted description line, `.licence`),
 * the chevron opens the text. A column row (an entry with a description): name, description,
 * licence, then the centred quiet "Show licence text" (`.show-text-button`), no chevron.
 */
function entryProps(
  entry: LicenceEntry,
  model: LicencesModel,
  t: TFunction,
): Partial<ListRowProps> {
  const id = `licences.entry-row.${entry.key}`;
  const handleShowText = (): void => {
    model.onShowText(entry.key);
  };
  if (entry.description === undefined) {
    return {
      description: entry.licence,
      descriptionTestID: `${id}.licence`,
      end: 'chevron',
      onPress: handleShowText,
    };
  }
  return {
    description: entry.description,
    textExtra: (
      <>
        <AppText
          text={entry.licence}
          variant="rowDescription"
          tone="muted"
          testID={`${id}.licence`}
        />
        <View style={styles.nudge}>
          <QuietButton
            testID={`${id}.show-text-button`}
            label={t('licences.show-text')}
            iconEnd="chevron"
            onPress={handleShowText}
            isReducedMotion={model.isReducedMotion}
          />
        </View>
      </>
    ),
  };
}

/**
 * S11d Licences (body gap 18): the intro, then four group tabs over lists of bold names with
 * their licence under them (entryProps: chevron rows and the one column row).
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
                  isStrong
                  isFirst={index === 0}
                  isReducedMotion={model.isReducedMotion}
                  {...entryProps(entry, model, t)}
                />
              ))}
          </ListGroup>
        ))}
      </ScreenBody>
    </ScreenFrame>
  );
}
