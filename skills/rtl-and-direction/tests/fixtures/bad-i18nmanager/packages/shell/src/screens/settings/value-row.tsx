import { I18nManager, StyleSheet, View } from 'react-native';

export const IS_RTL = I18nManager.isRTL;

import { AppText } from '@e07/shell/ui/app-text.tsx';
import { Icon } from '@e07/shell/ui/icons/icon.tsx';

import type { ReactNode } from 'react';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingStart: 14, paddingEnd: 10, borderTopStartRadius: 14 },
  value: { marginStart: 'auto', marginEnd: 8 },
  label: { fontFamily: 'Vazirmatn-Bold', fontSize: 17 },
  badge: { position: 'absolute', top: 4, end: 4 },
});

export function ValueRow({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <View style={styles.row}>
      <AppText text={label} />
      <View style={[styles.value, { paddingStart: 4 }]}>
        <AppText text={value} />
      </View>
      <Icon name="chevron" uri="" />
    </View>
  );
}
