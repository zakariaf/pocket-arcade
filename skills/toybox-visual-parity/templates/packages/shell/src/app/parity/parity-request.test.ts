// packages/shell/src/app/parity/parity-request.test.ts
import { PARITY_PLANS } from './parity-plans.ts';
import { parseParityRequest } from './parity-request.ts';

const BASE = 'frame=s4-home&theme=dark&lang=fa&game=lineSiege&date=2026-09-27&animations=off';

describe('parseParityRequest', () => {
  it('reads the query the capture script sends', () => {
    expect(parseParityRequest(BASE)).toStrictEqual({
      ok: true,
      request: {
        frame: 's4-home',
        plan: PARITY_PLANS['s4-home'],
        theme: 'dark',
        lang: 'fa',
        game: 'lineSiege',
        date: '2026-09-27',
        scrollY: 0,
      },
    });
  });

  it('reads the scroll offset of a tall frame', () => {
    const result = parseParityRequest(
      'frame=s11-settings&theme=light&lang=en&game=lineSiege&date=2026-09-27&animations=off&scrollY=600',
    );

    expect(result).toMatchObject({ ok: true, request: { frame: 's11-settings', scrollY: 600 } });
  });

  it('reads the board probe launch of a Game-route frame', () => {
    const result = parseParityRequest(`${BASE.replace('s4-home', 's6-pause')}&probe=board`);

    expect(result).toMatchObject({ ok: true, request: { frame: 's6-pause', probe: 'board' } });
  });

  it('reads the launch nonce the capture script proves the hierarchy with', () => {
    const result = parseParityRequest(`${BASE}&nonce=3f9a0c1d2e4b`);

    expect(result).toMatchObject({
      ok: true,
      request: { frame: 's4-home', nonce: '3f9a0c1d2e4b' },
    });
  });

  it('has no probe on a capture launch', () => {
    const result = parseParityRequest(BASE);

    expect(result.ok && 'probe' in result.request).toBe(false);
  });

  it('knows every frame the harness has a plan for, and carries that plan', () => {
    for (const [frame, plan] of Object.entries(PARITY_PLANS)) {
      expect(parseParityRequest(BASE.replace('s4-home', frame))).toMatchObject({
        ok: true,
        request: { frame, plan },
      });
    }
  });

  it.each([
    [`${BASE}&speed=2`, 'unknown parameter "speed"'],
    [`${BASE}&theme=light`, 'parameter "theme" given twice'],
    [BASE.replace('&animations=off', ''), 'missing animations'],
    [BASE.replace('s4-home', 's5-game'), 'frame "s5-game" is not a design frame key'],
    [BASE.replace('dark', 'sepia'), 'theme "sepia" must be light or dark'],
    [BASE.replace('lang=fa', 'lang=fr'), 'lang "fr" must be en, de, fa or ckb'],
    [BASE.replace('lineSiege', 'line-siege'), 'game "line-siege" must be a camelCase game id'],
    [BASE.replace('2026-09-27', '2026-02-30'), 'date "2026-02-30" must be a real YYYY-MM-DD'],
    [BASE.replace('animations=off', 'animations=on'), 'animations "on" must be off'],
    [`${BASE}&scrollY=-40`, 'scrollY "-40" must be whole points >= 0'],
    [`${BASE}&probe=layout`, 'probe "layout" must be board'],
    [`${BASE}&nonce=ABC123`, 'nonce "ABC123" must be 6 to 32 lower-case letters and digits'],
    [`${BASE}&nonce=a1`, 'nonce "a1" must be 6 to 32 lower-case letters and digits'],
    [BASE.replace('lineSiege', 'line%E0'), 'parameter "game" has a broken %-escape'],
  ])('refuses %s', (query, error) => {
    expect(parseParityRequest(query)).toStrictEqual({ ok: false, error });
  });
});
