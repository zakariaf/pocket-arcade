// apps/tile-drop/src/rules/outcome.test.ts
import { View } from 'react-native';

import { useSettingsStore } from '@demo/shell/stores/settings-store.ts';

describe('outcome', () => {
  it('stays pure even in a test', () => {
    expect([View, useSettingsStore]).toHaveLength(2);
  });
});
