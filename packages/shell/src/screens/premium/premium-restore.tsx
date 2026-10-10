// packages/shell/src/screens/premium/premium-restore.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { Button } from '@e07/shell/ui/button.tsx';

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
  const { view } = model;
  if (view === 'success') return null;
  if (view === 'already-owned') {
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
  const isLocked =
    view === 'store-unavailable' || view === 'purchase-in-progress' || view === 'restoring';
  return (
    <View style={styles.quiet}>
      <Button
        testID="premium.restore-button"
        label={t('common.restore-purchase')}
        onPress={model.onRestore}
        kind="quiet"
        icon="restore"
        isDisabled={isLocked}
        isReducedMotion={model.isReducedMotion}
      />
    </View>
  );
}
