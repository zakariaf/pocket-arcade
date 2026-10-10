// packages/shell/src/screens/settings/use-settings-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { PARITY_PLANS } from '@e07/shell/app/parity/parity-plans.ts';
import { endParitySession, startParitySession } from '@e07/shell/app/parity/parity-session.ts';
import { createFakeAudio } from '@e07/shell/services/audio/fake-audio.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useSettingsModel } from './use-settings-model.ts';

import type { SettingsContext } from './settings-rows.ts';
import type { RenderWithShellOptions } from '@e07/shell/testing/render-with-shell.tsx';

const CONTEXT: SettingsContext = {
  hasMusic: false,
  canVibrate: true,
  isPrivacyOptionsRequired: false,
  isPremium: false,
};

async function setup(options: RenderWithShellOptions = {}) {
  const audio = createFakeAudio();
  const haptics = createFakeHaptics();
  const { wrapper, stores } = createShellWrapper({ ...options, services: { audio, haptics } });
  const { result } = await renderHook(() => useSettingsModel(CONTEXT), { wrapper });
  return { result, stores, audio, haptics };
}

describe('useSettingsModel', () => {
  it('shows "System (English)" while the language follows the phone', async () => {
    const { result } = await setup();
    // t() isolates text placeholders with FSI ... PDI so names never jump sides in RTL.
    expect(result.current.languageValue).toBe('System (\u2068English\u2069)');
  });

  it('shows the autonym once a language is chosen', async () => {
    const { result } = await setup({ settings: { language: 'de' } });
    expect(result.current.languageValue).toBe('Deutsch');
  });

  it('previews Persian digits for the Local style in Persian', async () => {
    const { result } = await setup({ language: 'fa' });
    expect(result.current.digitPreviews).toStrictEqual({
      automatic: '۱۲۳',
      latin: '123',
      local: '۱۲۳',
    });
  });

  it('reflects a dispatched change on the next render', async () => {
    const { result } = await setup();
    await act(() => {
      result.current.actions.onToggleSound();
    });
    expect(result.current.settings.soundEnabled).toBe(false);
  });

  it('plays the toggle sound and the selection pulse after a switch flips', async () => {
    const { result, audio, haptics } = await setup();
    await act(() => {
      result.current.actions.onToggleHints();
    });
    expect(audio.calls).toContainEqual({ kind: 'play', soundId: 'ui.toggle', delayMs: 0 });
    expect(haptics.played).toStrictEqual(['selection']);
  });

  it('writes the opposite of the reduce-motion state it shows', async () => {
    const { result } = await setup({ settings: { reduceMotion: 'on' } });
    expect(result.current.isReduceMotionOn).toBe(true);
    await act(() => {
      result.current.actions.onToggleReduceMotion();
    });
    expect(result.current.settings.reduceMotion).toBe('off');
  });

  it('shows the saved Reduce motion choice while a parity capture freezes the motion', async () => {
    startParitySession({
      frame: 's11-settings',
      plan: PARITY_PLANS['s11-settings'],
      theme: 'light',
      lang: 'en',
      game: 'lineSiege',
      date: '2026-09-27',
      scrollY: 0,
    });
    try {
      const { result } = await setup({ settings: { reduceMotion: 'off' } });
      expect(result.current.isReduceMotionOn).toBe(false);
    } finally {
      endParitySession();
    }
  });
});
