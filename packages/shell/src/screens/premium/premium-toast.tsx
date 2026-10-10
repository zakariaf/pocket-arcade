// packages/shell/src/screens/premium/premium-toast.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { LAYOUT } from '@e07/shell/theme/tokens.ts';
import { COMPONENT_SPECS } from '@e07/shell/ui/component-specs.ts';
import { Toast } from '@e07/shell/ui/toast.tsx';

import { premiumToastsFor } from './premium-toasts.ts';

import type { PremiumModel } from './premium-model.ts';
import type { ReactNode } from 'react';

export type PremiumToastProps = { readonly model: PremiumModel };

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    bottom: 14,
    start: LAYOUT.screenGutter,
    end: LAYOUT.screenGutter,
    gap: COMPONENT_SPECS.toast.stackGap,
  },
});

/**
 * The restore outcome as one toast: restoring (busy), restored, nothing found, failed. The model
 * hook announces it to VoiceOver and clears "Purchase restored" after NOTICE_MS. The design's
 * restore card (a parity frame) stacks all four, 10 pt apart.
 */
export function PremiumToast({ model }: PremiumToastProps): ReactNode {
  const t = useT();
  const specs = premiumToastsFor(model);
  if (specs.length === 0) return null;
  return (
    <View style={styles.dock}>
      {specs.map((spec) => (
        <Toast
          key={spec.testID}
          testID={spec.testID}
          text={t(spec.textKey)}
          icon={spec.icon}
          isReducedMotion={model.isReducedMotion}
        />
      ))}
    </View>
  );
}
