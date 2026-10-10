// packages/shell/src/screens/settings/licences/licence-entries.test.ts
import fc from 'fast-check';

import { shellLicenceEntries } from './licence-entries.ts';

import type { TFunction } from '@e07/shell/i18n/create-t.ts';

/** Returns each message key as its text, so a translated field shows its key. */
const keyAsText: TFunction = (key) => key;

function entriesIn(group: string) {
  return shellLicenceEntries(keyAsText).filter((entry) => entry.group === group);
}

// Spec S11d and 7.6: the Licences page lists open-source components, fonts (Vazirmatn, Lilita
// One and Rubik under the SIL Open Font License) and the sounds; names and licences are never
// translated (N9: the game's sounds are made in code).
describe('shellLicenceEntries', () => {
  it('lists the groups in the order fonts, software, ads-store, sounds (spec S11d)', () => {
    const groups = shellLicenceEntries(keyAsText).map((entry) => entry.group);
    expect([...new Set(groups)]).toStrictEqual(['fonts', 'software', 'ads-store', 'sounds']);
  });

  it('gives Vazirmatn its version, the SIL Open Font License 1.1 and a description (spec 7.6)', () => {
    expect(entriesIn('fonts')[0]).toStrictEqual({
      key: 'vazirmatn',
      group: 'fonts',
      name: 'Vazirmatn',
      version: '33.003',
      licence: 'SIL Open Font License 1.1',
      description: 'licences.entry.vazirmatn',
    });
  });

  it('lists Lilita One and Rubik under the same licence and without a version', () => {
    expect(entriesIn('fonts').slice(1)).toStrictEqual([
      {
        key: 'lilita-one',
        group: 'fonts',
        name: 'Lilita One',
        licence: 'SIL Open Font License 1.1',
      },
      { key: 'rubik', group: 'fonts', name: 'Rubik', licence: 'SIL Open Font License 1.1' },
    ]);
  });

  it('lists the nine software components with their licences', () => {
    expect(entriesIn('software').map(({ key, licence }) => [key, licence])).toStrictEqual([
      ['react-native', 'MIT'],
      ['react', 'MIT'],
      ['expo', 'MIT'],
      ['react-native-skia', 'MIT'],
      ['skia', 'BSD-3-Clause'],
      ['react-native-reanimated', 'MIT'],
      ['react-native-gesture-handler', 'MIT'],
      ['formatjs-react-intl', 'BSD-3-Clause'],
      ['zustand', 'MIT'],
    ]);
  });

  it('lists the three ads and purchase components with their licences', () => {
    expect(entriesIn('ads-store').map(({ key, licence }) => [key, licence])).toStrictEqual([
      ['react-native-google-mobile-ads', 'Apache License 2.0'],
      ['google-mobile-ads-sdk', 'Google Mobile Ads SDK Terms'],
      ['expo-iap', 'MIT'],
    ]);
  });

  it('has exactly one sounds row, the game sounds made in code (spec N9)', () => {
    expect(entriesIn('sounds')).toStrictEqual([
      {
        key: 'game-sounds',
        group: 'sounds',
        name: 'licences.entry.sounds-name',
        licence: 'licences.entry.sounds-licence',
      },
    ]);
  });

  it('keys every row in kebab case, each key once', () => {
    const keys = shellLicenceEntries(keyAsText).map((entry) => entry.key);
    expect(keys.filter((key) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key))).toStrictEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every component name and licence untranslated, whatever the language says', () => {
    const untranslated = (t: TFunction) =>
      shellLicenceEntries(t)
        .filter((entry) => entry.group !== 'sounds')
        .map(({ key, name, version, licence }) => ({ key, name, version, licence }));
    const expected = untranslated(keyAsText);
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(untranslated(() => text)).toStrictEqual(expected);
      }),
    );
  });
});
