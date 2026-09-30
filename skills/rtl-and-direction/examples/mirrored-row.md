# Worked example: a settings row that mirrors correctly

Task: the Settings "Numbers" row shows a label at the start, the current value at the end and a chevron after it. In fa/ckb the whole row mirrors: label on the right, value and chevron on the left, chevron pointing left.

In the app, Settings rows are the Toybox `ListRow` (`packages/shell/src/ui/list-row.tsx`, from the components work), which is built exactly this way; do not add a second row component. This minimal row shows the rules on their own, and the same test pattern applies to any component with text or a row.

## The component

```tsx
// packages/shell/src/ui/value-row.tsx
import { StyleSheet, View } from 'react-native';

import { MIN_TOUCH, SPACING } from '@e07/shell/theme/tokens.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';

import { AppText } from './app-text.tsx';
import { Icon } from './icons/icon.tsx';

import type { ReactNode } from 'react';

export type ValueRowProps = {
  /** Already translated (t('settings.numbers.label')). */
  readonly label: string;
  /** Already translated or formatted in the player's digits. */
  readonly value: string;
  readonly testID: string;
};

const styles = StyleSheet.create({
  // 'row' mirrors by itself in RTL: never 'row-reverse', never marginLeft/Right.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    paddingInline: SPACING.md,
    gap: SPACING.sm,
  },
  label: { flex: 1 },
});

export function ValueRow({ label, value, testID }: ValueRowProps): ReactNode {
  const theme = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.label}>
        <AppText text={label} />
      </View>
      <AppText text={value} tone="muted" align="end" />
      {/* chevron is in DIRECTIONAL_ICONS: Icon flips it in RTL. */}
      <Icon name="chevron" color={theme.colors.icon} size={16} />
    </View>
  );
}
```

What each choice buys:

| Choice | Why |
|---|---|
| `flexDirection: 'row'` | the first child (label) sits at the start edge: left in en, right in fa |
| `paddingInline`, `gap` | symmetric and logical: nothing to mirror by hand |
| `AppText align="end"` | maps to the physical side through `TEXT_ALIGN`, with `writingDirection` from the layout |
| `Icon name="chevron"` | `Icon` flips it in RTL; the call site never checks the direction |
| strings as props | the screen's model hook calls `t()` and formats the value with `createNumberFormatter(localeTagFor(…))` |

The same row written wrong, and what `check-rtl.mjs` says:

| Wrong | Rule |
|---|---|
| `flexDirection: 'row-reverse'` when RTL | `row-reverse` |
| `marginLeft: 'auto'` on the value | `physical-style-key` (use `marginStart`) |
| `<Text style={{ textAlign: 'right' }}>` | `text-import`, `text-align-literal` |
| `I18nManager.isRTL ? … : …` | `i18nmanager` (use `useDirection()`) |
| `style={{ transform: [{ scaleX: -1 }] }}` on the chevron | `scale-x-flip` (add it to `DIRECTIONAL_ICONS` instead) |

## The test

```tsx
// packages/shell/src/ui/value-row.test.tsx
import { screen } from '@testing-library/react-native';

import { TEXT_ALIGN } from '@e07/shell/i18n/use-localized-text-style.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';

import { ValueRow } from './value-row.tsx';

describe('ValueRow', () => {
  it('writes the label right to left from the start edge in Persian', async () => {
    await renderWithShell(<ValueRow label="اعداد" value="خودکار" testID="settings.numbers-row" />, {
      language: 'fa',
      direction: 'rtl',
    });
    expect(screen.getByText('اعداد')).toHaveStyle({
      writingDirection: 'rtl',
      textAlign: TEXT_ALIGN.start,
    });
  });
});
```

(In a real screen test the strings come from the catalog through `t()`; literal strings are fine inside tests.)

## Check it

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check-rtl.mjs .
npx jest packages/shell/src/ui/value-row.test.tsx
```

Then capture Settings in fa on the simulator and compare it with the Toybox RTL design screenshot: label on the right, value and a left-pointing chevron on the left.
