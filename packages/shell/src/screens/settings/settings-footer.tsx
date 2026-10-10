// packages/shell/src/screens/settings/settings-footer.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { useTheme } from '@e07/shell/theme/use-theme.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';

import type { ReactNode } from 'react';

export type SettingsFooterProps = { readonly versionText: string };

const styles = StyleSheet.create({
  footer: { gap: 4, paddingTop: 0, paddingInline: 4, paddingBottom: 8 },
  // The note row and the version line are as wide as their content (Toybox inline-flex / inline).
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  version: { alignSelf: 'flex-start' },
});

/** S11 footer: a check and "Changes apply right away." (no Save button), then the version. */
export function SettingsFooter({ versionText }: SettingsFooterProps): ReactNode {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={styles.footer} testID="settings.footer">
      <View style={styles.note} testID="settings.autosave-note">
        <Icon
          name="check"
          color={theme.colors.textMuted}
          size={18}
          testID="settings.autosave-note.icon"
        />
        <AppText text={t('settings.autosave-note')} variant="settingsFooter" tone="muted" />
      </View>
      <View style={styles.version}>
        <AppText
          text={t('about.version', { versionText })}
          variant="settingsFooter"
          tone="muted"
          testID="settings.version"
        />
      </View>
    </View>
  );
}
