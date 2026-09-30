// packages/shell/src/stores/settings-store.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';

function setup() {
  const store = createFakeSaveStore();
  const clock = { nowMs: () => 1_790_000_000_000, today: () => '2026-09-26' };
  const errorLog = { record: jest.fn(), entries: () => [] };
  const plan = planLoad({ current: null, backup: null, gameId: 'line-siege' });
  const save = createSaveService(
    { store, clock, errorLog, appVersion: '1.0.0', isStrict: true },
    plan,
    0,
  );
  save.applyLoadWrites();
  return { store, settings: createSettingsStore(save) };
}

describe('settings store', () => {
  it('persists a change before publishing it', () => {
    const { store, settings } = setup();
    settings.getState().dispatch({ type: 'set-theme', theme: 'dark' });
    const current = store.read('current');
    if (current === null) throw new Error('current slot missing');
    const decoded = decodeSlot(current, 'line-siege');
    expect(decoded.kind === 'ok' && decoded.doc.settings.theme).toBe('dark');
    expect(settings.getState().settings.theme).toBe('dark');
  });

  it('clamps volumes into 0..100', () => {
    const { settings } = setup();
    settings.getState().dispatch({ type: 'set-sound', enabled: true, volume: 180 });
    expect(settings.getState().settings.soundVolume).toBe(100);
  });
});
