// packages/shell/src/app/parity/parity-doc.test.ts
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { TALLY_GAME } from '@e07/shell/testing/tally-game.ts';

import { parityDoc } from './parity-doc.ts';
import { PARITY_FIXTURE } from './parity-fixture.ts';
import { PARITY_PLANS } from './parity-plans.ts';
import { parseParityRequest } from './parity-request.ts';

import type { ParityFrameKey } from './parity-plans.ts';
import type { ParityRequest } from './parity-request.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/** The tally test game with a level 12, so the fixture's "Continue – Level 12" run exists. */
const GAME = {
  ...TALLY_GAME,
  levels: {
    ...TALLY_GAME.levels,
    table: Array.from({ length: 12 }, (_, index) => ({
      level: index + 1,
      seed: index + 1,
      difficulty: 2,
      stars: { kind: 'par' as const, par: 3 },
    })),
  },
};

function requestFor(frame: ParityFrameKey, lang = 'en'): ParityRequest {
  const query = `frame=${frame}&theme=light&lang=${lang}&game=lineSiege&date=2026-09-27&animations=off`;
  const parsed = parseParityRequest(query);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.request;
}

/** One launch: the harness writes the frame's document through the one save service. */
function launch(save: SaveService, frame: ParityFrameKey, lang = 'en'): void {
  save.update((doc) => parityDoc({ base: doc, game: GAME, request: requestFor(frame, lang) }));
}

describe('parityDoc', () => {
  it.each(Object.keys(PARITY_PLANS) as ParityFrameKey[])(
    'writes a valid save document for %s (the strict save service validates it)',
    (frame) => {
      const { save, readSlot } = createTestSave();

      launch(save, frame);

      const plan = PARITY_PLANS[frame];
      expect(readSlot('current')).toStrictEqual(save.doc());
      expect(save.doc().premium.owned).toBe(plan.premium);
      expect(save.doc().firstRun.languageChosen).toBe(plan.progress !== 'first-run');
      expect(Object.keys(save.doc().progress.levels)).toHaveLength(
        plan.progress === 'demo' ? 11 : 0,
      );
    },
  );

  it('writes the demo player in save-document terms', () => {
    const { save } = createTestSave();

    launch(save, 's4-home');

    const doc = save.doc();
    expect(doc.progress.endlessBest).toBe(4210);
    expect(doc.run?.ref).toStrictEqual({ kind: 'level', level: 12 });
    expect(doc.run?.resumeOnLaunch).toBe(false);
    expect(doc.daily.streak).toStrictEqual({ lastDate: '2026-09-26', length: 5 });
    expect(doc.stats.counters).toStrictEqual({
      'monsters-defeated': 1284,
      'beams-fired': 3907,
      'biggest-combo': 6,
    });
    expect(doc.settings.soundVolume).toBe(70);
    expect(doc.settings.language).toBeNull();
    expect(doc.ads.consent.canRequestAds).toBe(true);
  });

  it('turns Premium off with a revocation date when a normal frame follows a Premium one', () => {
    const { save } = createTestSave();

    launch(save, 's4-home-premium');
    expect(save.doc().premium).toMatchObject({ owned: true, revokedAtMs: null });
    launch(save, 's4-home');

    expect(save.doc().premium).toStrictEqual({
      owned: false,
      ownedSinceMs: null,
      lastCheckedAtMs: null,
      revokedAtMs: PARITY_FIXTURE.premium.revokedAtMs,
    });
    launch(save, 's11-settings');
    expect(save.doc().premium.owned).toBe(false);
  });

  it('leaves ad consent to be asked, the tutorial done and no Premium for the consent moment', () => {
    const { save } = createTestSave();

    launch(save, 's3-consent-moment');

    const doc = save.doc();
    expect(doc.ads.consent.canRequestAds).toBe(false);
    expect(doc.firstRun).toStrictEqual({ languageChosen: true, tutorialDone: true });
    expect(doc.premium.owned).toBe(false);
  });

  it('keeps a player who never had Premium free of any revocation', () => {
    const { save } = createTestSave();

    launch(save, 's4-home');

    expect(save.doc().premium.revokedAtMs).toBeNull();
  });

  it('sets the Language setting to the render language outside English', () => {
    const { save } = createTestSave();

    launch(save, 's11-settings', 'fa');

    expect(save.doc().settings.language).toBe('fa');
  });

  it('gives a new player nothing but finished first-run steps', () => {
    const { save } = createTestSave();

    launch(save, 's4-home');
    launch(save, 's10-statistics-empty');

    const doc = save.doc();
    expect(doc.run).toBeNull();
    expect(doc.stats.gamesPlayed).toBe(0);
    expect(doc.daily.streak).toStrictEqual({ lastDate: null, length: 0 });
    expect(doc.firstRun).toStrictEqual({ languageChosen: true, tutorialDone: true });
  });

  it('leaves the run out when the game has no such level', () => {
    const { save } = createTestSave();

    save.update((doc) =>
      parityDoc({ base: doc, game: TALLY_GAME, request: requestFor('s4-home') }),
    );

    expect(save.doc().run).toBeNull();
  });

  it('shows the counters of the game the capture asked for', () => {
    const { save } = createTestSave();
    const request = { ...requestFor('s10-statistics'), game: 'flockTilt' };

    save.update((doc) => parityDoc({ base: doc, game: GAME, request }));

    expect(save.doc().stats.counters).toStrictEqual({
      'sheep-penned': 612,
      'tilts-made': 2145,
      'solved-at-par': 38,
    });
  });
});
