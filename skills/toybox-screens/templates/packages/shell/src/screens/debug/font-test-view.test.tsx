// packages/shell/src/screens/debug/font-test-view.test.tsx
// allow-style-assertion: the font family of each alphabet is spec 7.6's contract (every letter in every bundled font).
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FONT_FAMILIES } from '@e07/shell/i18n/fonts.ts';
import { findInaccessiblePressables } from '@e07/shell/testing/find-inaccessible-pressables.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { FONT_TEST_SAMPLES, FONT_TEST_VARIANTS, fontTestRowsOf } from './font-test-samples.ts';
import { FontTestView } from './font-test-view.tsx';

import type { TextStyle } from 'react-native';

describe('FontTestView', () => {
  it('names each type variant and draws the four samples in it', async () => {
    const rows = fontTestRowsOf(['levelNumber', 'body'], FONT_TEST_SAMPLES);
    await renderWithShell(<FontTestView model={{ rows }} />);

    expect(screen.getByTestId('font-test.screen')).toBeOnTheScreen();
    expect(screen.getByText('levelNumber')).toBeOnTheScreen();
    for (const sample of FONT_TEST_SAMPLES)
      expect(screen.getAllByText(sample.text)).toHaveLength(2);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('FontTestView, the game-name rows', () => {
  it('draws only the Latin texts in a game-name row, the script Lilita One is made for (spec 7.6)', async () => {
    // Game names are Latin in every language and Lilita One has no Arabic letters: Persian and
    // Sorani there fell back to a system font, and with the names' tracking TextKit looped on the
    // main thread until the simulator's UI queries timed out (E17).
    const rows = fontTestRowsOf(['gameNameHome'], FONT_TEST_SAMPLES);
    await renderWithShell(<FontTestView model={{ rows }} />);

    const drawn = [...(rows[0]?.samples ?? []), ...(rows[0]?.alphabets ?? [])]
      .filter((entry) => screen.queryByText(entry.text, { exact: false }) !== null)
      .map((entry) => entry.language);
    expect(drawn).toStrictEqual(['en', 'de', 'en', 'de']);
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('FontTestView, a window of rows', () => {
  it('mounts only the first rows and draws the rest as the page scrolls (XCUITest can read it)', async () => {
    // The whole page is about 570 texts: drawn at once, XCUITest's hierarchy query timed out on
    // the simulator (main thread busy 30 s), so no flow could scroll or screenshot it (E17).
    const rows = fontTestRowsOf(FONT_TEST_VARIANTS, FONT_TEST_SAMPLES);
    await renderWithShell(<FontTestView model={{ rows }} />);

    expect(screen.getByText(FONT_TEST_VARIANTS[0] ?? '')).toBeOnTheScreen();
    expect(screen.queryByText(FONT_TEST_VARIANTS.at(-1) ?? '')).not.toBeOnTheScreen();
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});

describe('FontTestView, every font (spec 7.6)', () => {
  it('draws the en and de alphabets in every Latin face and the fa and ckb alphabets in both Vazirmatn weights', async () => {
    const rows = fontTestRowsOf(FONT_TEST_VARIANTS, FONT_TEST_SAMPLES);
    await renderWithShell(<FontTestView model={{ rows }} />);

    const families = { latin: new Set<unknown>(), arabic: new Set<unknown>() };
    for (const alphabet of rows[0]?.alphabets ?? []) {
      const script = alphabet.language === 'fa' || alphabet.language === 'ckb' ? 'arabic' : 'latin';
      for (const text of screen.getAllByText(alphabet.text))
        families[script].add(StyleSheet.flatten(text.props['style'] as TextStyle)?.fontFamily);
    }

    expect([...families.latin].sort()).toStrictEqual(
      [FONT_FAMILIES.display, FONT_FAMILIES.textBold, FONT_FAMILIES.textRegular].sort(),
    );
    expect([...families.arabic].sort()).toStrictEqual(
      [FONT_FAMILIES.arabicBold, FONT_FAMILIES.arabicRegular].sort(),
    );
    expect(findInaccessiblePressables(screen.container)).toStrictEqual([]);
  });
});
