// packages/shell/src/screens/settings/licences/licence-entries.ts
// Pure: the S11d rows every Pocket Arcade app shows (fonts, software, ads and store, sounds).
// A game adds its own credits (GAME_ART.credits: word lists, an extra font) after these, through
// creditRowsOf(useGameHost().credits) from packages/shell/src/art/credit-rows.ts.
// Names and licences are never translated; only the Shell's own descriptions are.
import type { TFunction } from '@e07/shell/i18n/create-t.ts';

export type LicenceGroupId = 'fonts' | 'software' | 'ads-store' | 'sounds';

export type LicenceEntry = {
  /** Kebab-case component name: the row testID is licences.entry-row.<key>. */
  readonly key: string;
  readonly group: LicenceGroupId;
  readonly name: string;
  readonly version?: string;
  readonly licence: string;
  /** Rows with a description are column rows with a "Show licence text" nudge. */
  readonly description?: string;
};

const OFL = 'SIL Open Font License 1.1';
const MIT = 'MIT';
const BSD = 'BSD-3-Clause';

const SOFTWARE: readonly Omit<LicenceEntry, 'group'>[] = [
  { key: 'react-native', name: 'React Native', licence: MIT },
  { key: 'react', name: 'React', licence: MIT },
  { key: 'expo', name: 'Expo', licence: MIT },
  { key: 'react-native-skia', name: 'React Native Skia', licence: MIT },
  { key: 'skia', name: 'Skia', licence: BSD },
  { key: 'react-native-reanimated', name: 'React Native Reanimated', licence: MIT },
  { key: 'react-native-gesture-handler', name: 'React Native Gesture Handler', licence: MIT },
  { key: 'formatjs-react-intl', name: 'FormatJS (react-intl)', licence: BSD },
  { key: 'zustand', name: 'Zustand', licence: MIT },
];

const ADS_STORE: readonly Omit<LicenceEntry, 'group'>[] = [
  {
    key: 'react-native-google-mobile-ads',
    name: 'react-native-google-mobile-ads',
    licence: 'Apache License 2.0',
  },
  {
    key: 'google-mobile-ads-sdk',
    name: 'Google Mobile Ads SDK',
    licence: 'Google Mobile Ads SDK Terms',
  },
  { key: 'expo-iap', name: 'expo-iap', licence: MIT },
];

export function shellLicenceEntries(t: TFunction): LicenceEntry[] {
  return [
    {
      key: 'vazirmatn',
      group: 'fonts',
      name: 'Vazirmatn',
      version: '33.003',
      licence: OFL,
      description: t('licences.entry.vazirmatn'),
    },
    // The S11d design names these two without a version (only the deck's Vazirmatn has one).
    { key: 'lilita-one', group: 'fonts', name: 'Lilita One', licence: OFL },
    { key: 'rubik', group: 'fonts', name: 'Rubik', licence: OFL },
    ...SOFTWARE.map((entry) => ({ ...entry, group: 'software' as const })),
    ...ADS_STORE.map((entry) => ({ ...entry, group: 'ads-store' as const })),
    {
      key: 'game-sounds',
      group: 'sounds',
      name: t('licences.entry.sounds-name'),
      licence: t('licences.entry.sounds-licence'),
    },
  ];
}

/**
 * Every row under a key of its own, in order: a game's credit keys come from their names, so two
 * names can share one, a non-Latin name gives "game-" and a credit called "Sounds" the Shell's
 * "game-sounds". A repeated key is numbered from 2 ("game-sounds-2"), so each row's testID and
 * "Show licence text" name exactly that row.
 */
export function withUniqueKeys(entries: readonly LicenceEntry[]): LicenceEntry[] {
  const used = new Set<string>();
  return entries.map((entry) => {
    const base = entry.key.replace(/-+$/, '');
    let key = base;
    for (let count = 2; used.has(key); count += 1) key = `${base}-${String(count)}`;
    used.add(key);
    return key === entry.key ? entry : { ...entry, key };
  });
}
