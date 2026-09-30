// packages/shell/src/ui/toybox-styles.test.ts
import { dieCutRing, focusRing, hardShadow } from './toybox-styles.ts';

describe('toybox styles', () => {
  it('draws hard shadows straight down with no blur', () => {
    expect(hardShadow(8, '#1D1B3A')).toStrictEqual({
      boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 0, spreadDistance: 0, color: '#1D1B3A' }],
    });
  });

  it('draws the die-cut ring as a spread with no offset', () => {
    expect(dieCutRing(3.5, '#FFFFFF')).toStrictEqual({
      boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3.5, color: '#FFFFFF' }],
    });
  });

  it('draws the focus ring 3 pt wide and 2 pt away', () => {
    expect(focusRing('#C8157A')).toStrictEqual({
      outlineWidth: 3,
      outlineStyle: 'solid',
      outlineOffset: 2,
      outlineColor: '#C8157A',
    });
  });
});
