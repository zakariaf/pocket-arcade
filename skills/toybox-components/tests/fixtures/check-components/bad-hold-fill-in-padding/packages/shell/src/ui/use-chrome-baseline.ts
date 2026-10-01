// packages/shell/src/ui/use-chrome-baseline.ts
import { useLocalizedTextStyle } from '@e07/shell/i18n/use-localized-text-style.ts';
import { typeStyleOf } from '@e07/shell/theme/type-styles.ts';

import { chromeBaseline } from './text-metrics.ts';

import type { TypeVariant } from '@e07/shell/theme/type-styles.ts';

/** The baseline a text style has in the design (from the top of its line box), in this language. */
export function useChromeBaseline(variant: TypeVariant): number {
  const style = typeStyleOf(variant);
  const localized = useLocalizedTextStyle({
    fontSize: style.fontSize,
    weight: style.weight,
    face: style.face,
    lineHeight: style.lineHeight,
    align: 'start',
  });
  return chromeBaseline(
    localized.fontFamily ?? '',
    style.fontSize,
    localized.lineHeight ?? style.fontSize,
  );
}
