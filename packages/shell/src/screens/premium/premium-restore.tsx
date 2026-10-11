// packages/shell/src/screens/premium/premium-restore.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';

import { PREMIUM_VIEWS } from './premium-views.ts';

import type { PremiumModel } from './premium-model.ts';
import type { ReactNode } from 'react';

export type PremiumRestoreProps = { readonly model: PremiumModel };

const styles = StyleSheet.create({ quiet: { alignSelf: 'center' } });

/**
 * Restore purchase: a quiet centred link (locked while offline, purchasing or restoring), a
 * secondary block button for owners, and nothing on the success page.
 */
export function PremiumRestore({ model }: PremiumRestoreProps): ReactNode {
  const t = useT();
  const restore = PREMIUM_VIEWS[model.view].restore;
  if (restore === null) return null;
  if (restore === 'block') {
    return (
      <Button
        testID="premium.restore-button"
        label={t('common.restore-purchase')}
        onPress={model.onRestore}
        icon="restore"
        isBlock
        isReducedMotion={model.isReducedMotion}
      />
    );
  }
  return (
    <View style={styles.quiet}>
      <Button
        testID="premium.restore-button"
        label={t('common.restore-purchase')}
        onPress={model.onRestore}
        kind="quiet"
        icon="restore"
        isDisabled={restore === 'locked'}
        isReducedMotion={model.isReducedMotion}
      />
    </View>
  );
}
