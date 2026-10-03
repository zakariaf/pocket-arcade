// packages/shell/src/theme/type-styles.test.ts
import { TYPE_SCALE } from './tokens.ts';
import { TYPE_STYLES, lineHeightOf, snapToGrid, typeStyleOf } from './type-styles.ts';

describe('Toybox type', () => {
  it('resolves roles and component styles through one lookup', () => {
    expect(typeStyleOf('heading')).toBe(TYPE_SCALE.heading);
    expect(typeStyleOf('stickerXs')).toBe(TYPE_STYLES.stickerXs);
  });

  it('keeps display faces for titles and text faces for labels', () => {
    expect(typeStyleOf('topBarTitle')).toMatchObject({ fontSize: 27, face: 'display' });
    expect(typeStyleOf('chip')).toMatchObject({ fontSize: 15, face: 'text', weight: 'bold' });
  });

  it('tracks only the game name', () => {
    const tracked = Object.entries(TYPE_STYLES)
      .filter(([, style]) => 'letterSpacingEm' in style)
      .map(([name]) => name);
    expect(tracked).toStrictEqual(['gameNameHome', 'gameNameSplash', 'gameNameAbout']);
  });

  it('keeps strong and danger row labels at the row line heights, in Bold', () => {
    expect(TYPE_STYLES.rowLabelStrong).toStrictEqual({
      ...TYPE_STYLES.rowLabel,
      weight: 'bold',
    });
  });
});

describe('Toybox line heights on the pixel grid', () => {
  it('snaps to the nearest device pixel at 3x, never to whole points', () => {
    expect(lineHeightOf('rowDescription', 'latin', 3)).toBe(55 / 3); // 14 x 1.3 = 18.2
    expect(lineHeightOf('rowLabel', 'latin', 3)).toBe(67 / 3); // 17 x 1.32 = 22.44
    expect(lineHeightOf('rowLabel', 'arabic', 3)).toBe(77 / 3); // 17 x 1.5 = 25.5, not 26
    expect(lineHeightOf('rowLabelStrong', 'latin', 3)).toBe(67 / 3);
  });

  it('gives Persian level numbers a 1.45 box, so iOS does not clip the Vazirmatn digits', () => {
    expect(lineHeightOf('levelNumber', 'latin', 3)).toBe(21); // 21 x 1
    expect(lineHeightOf('levelNumber', 'arabic', 3)).toBe(91 / 3); // 21 x 1.45 = 30.45
  });

  it('gives Persian scores the same 1.45 box (S7, the endless and daily results)', () => {
    expect(lineHeightOf('scoreValue', 'latin', 3)).toBe(44); // 44 x 1
    expect(lineHeightOf('scoreValue', 'arabic', 3)).toBe(191 / 3); // 44 x 1.45 = 63.8
  });

  it('keeps values that are already on the grid', () => {
    expect(snapToGrid(25.5, 2)).toBe(25.5);
    expect(snapToGrid(18.2, 2)).toBe(18);
    expect(lineHeightOf('display', 'latin', 3)).toBe(125 / 3); // 38 x 1.1 = 41.8
  });
});
