// packages/shell/src/testing/rendered-parts.test.tsx
import { StyleSheet, View } from 'react-native';

import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';

import { renderWithShell } from './render-with-shell.tsx';
import { ancestorStyle, iconsIn } from './rendered-parts.ts';
import { TEST_PALETTE } from './test-palette.ts';

// The helper reads each icon's glyph from this mock's image uri (the root mock gives every icon
// the same image); every test file that calls iconsIn keeps the same mock.
jest.mock('@e07/shell/ui/icons/icon-raster.ts', () => ({
  getIconUri: (name: string) => `icon:${name}`,
}));

const INK = TEST_PALETTE.standard.light.text;

const styles = StyleSheet.create({
  outer: { flexDirection: 'row', gap: 4 },
  face: { minHeight: 62 },
  dashed: { borderStyle: 'dashed' },
  inner: { flexDirection: 'row', gap: 8 },
});

describe('iconsIn', () => {
  it('lists the glyph names of the icons drawn inside a part, in order', async () => {
    await renderWithShell(
      <View testID="zz.row">
        <Icon name="globe" color={INK} />
        <View>
          <Icon name="chevron" color={INK} />
        </View>
      </View>,
    );
    expect(iconsIn('zz.row')).toStrictEqual(['globe', 'chevron']);
  });

  it('reads a part hidden from the screen reader', async () => {
    await renderWithShell(
      <View
        testID="zz.toggle"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="dash" color={INK} />
      </View>,
    );
    expect(iconsIn('zz.toggle')).toStrictEqual(['dash']);
  });

  it('returns no names for a part without icons', async () => {
    await renderWithShell(<View testID="zz.empty" />);
    expect(iconsIn('zz.empty')).toStrictEqual([]);
  });
});

describe('ancestorStyle', () => {
  it('returns the flattened style of the nearest ancestor that passes the test', async () => {
    await renderWithShell(
      <View style={styles.outer}>
        <View style={[styles.face, styles.dashed]}>
          <View style={styles.inner}>
            <AppText text="9" testID="zz.number" />
          </View>
        </View>
      </View>,
    );
    expect(ancestorStyle('zz.number', (style) => style.minHeight !== undefined)).toStrictEqual({
      minHeight: 62,
      borderStyle: 'dashed',
    });
    expect(ancestorStyle('zz.number', (style) => style.flexDirection === 'row')).toStrictEqual({
      flexDirection: 'row',
      gap: 8,
    });
  });

  it('returns an empty style when no ancestor passes the test', async () => {
    await renderWithShell(
      <View style={styles.outer}>
        <AppText text="Sound" testID="zz.label" />
      </View>,
    );
    expect(ancestorStyle('zz.label', (style) => style.minHeight !== undefined)).toStrictEqual({});
  });
});
