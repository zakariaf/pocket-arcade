// packages/shell/src/screens/premium/premium-offer.tsx
import { StyleSheet, View } from 'react-native';

import { useT } from '@e07/shell/i18n/t-context.ts';
import { AppText } from '@e07/shell/ui/app-text.tsx';
import { ListRow } from '@e07/shell/ui/list-row.tsx';
import { List } from '@e07/shell/ui/list.tsx';
import { PremiumArt } from '@e07/shell/ui/premium-art.tsx';

import type { PremiumModel } from './premium-model.ts';
import type { ReactNode } from 'react';

export type PremiumOfferProps = { readonly model: PremiumModel };

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingBlock: 6 },
  title: { flex: 1, gap: 6 },
});

/** S12 normal page, top part: Premium art, title and subtitle, the three benefits (a List: no tab). */
export function PremiumOffer({ model }: PremiumOfferProps): ReactNode {
  const t = useT();
  return (
    <>
      <View style={styles.header} testID="premium.header">
        <PremiumArt testID="premium.art" />
        <View style={styles.title}>
          <AppText text={t('common.premium')} variant="display" isHeader testID="premium.title" />
          <AppText
            text={t('premium.subtitle', { gameName: model.gameName })}
            tone="muted"
            testID="premium.subtitle"
          />
        </View>
      </View>
      <List testID="premium.benefits-list">
        <ListRow
          testID="premium.benefit.no-ads"
          icon="close"
          iconPaint="accent"
          label={t('premium.benefit.no-ads')}
          isFirst
          isReducedMotion={model.isReducedMotion}
        />
        <ListRow
          testID="premium.benefit.free-perks"
          icon="hint"
          iconPaint="accent"
          label={t('premium.benefit.free-perks')}
          isReducedMotion={model.isReducedMotion}
        />
        <ListRow
          testID="premium.benefit.support"
          icon="star-filled"
          iconPaint="accent"
          label={t('premium.benefit.support')}
          isReducedMotion={model.isReducedMotion}
        />
      </List>
    </>
  );
}
