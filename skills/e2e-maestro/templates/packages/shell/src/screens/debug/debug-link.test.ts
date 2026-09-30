// packages/shell/src/screens/debug/debug-link.test.ts
import { parseDebugLink } from './debug-link.ts';

const LINK = 'e07-line-siege://debug/setup';

describe('parseDebugLink', () => {
  it('reads every parameter the flows use', () => {
    const query =
      'lang=fa&digits=auto&theme=system&seed=42&level=12&date=2026-09-26&ads=off&premium=1' +
      '&offline=0&firstRun=0&reduceMotion=1&stars=1:3,2:0&screen=game&action=win-level&boardLayout=1';
    expect(parseDebugLink(`${LINK}?${query}`)).toStrictEqual({
      kind: 'request',
      request: {
        lang: 'fa',
        digits: 'automatic',
        theme: 'system',
        seed: 42,
        level: 12,
        date: '2026-09-26',
        ads: 'off',
        premium: true,
        offline: false,
        firstRun: false,
        reduceMotion: true,
        stars: [
          { level: 1, stars: 3 },
          { level: 2, stars: 0 },
        ],
        screen: 'game',
        action: 'win-level',
        boardLayout: true,
      },
    });
  });

  it('reads the screenshot star fixture and a link without a query', () => {
    expect(parseDebugLink(`${LINK}?stars=demo`)).toStrictEqual({
      kind: 'request',
      request: { stars: 'demo' },
    });
    expect(parseDebugLink(LINK)).toStrictEqual({ kind: 'request', request: {} });
  });

  it('decodes escaped values', () => {
    expect(parseDebugLink(`${LINK}?screen=how%2Dto%2Dplay`)).toStrictEqual({
      kind: 'request',
      request: { screen: 'how-to-play' },
    });
  });

  it.each([
    ['lang=it', 'debug parameter lang="it" is not allowed'],
    ['colour=red', 'unknown debug parameter "colour"'],
    ['offline=1&offline=0', 'debug parameter "offline" is repeated'],
    ['date=2026-02-30', 'debug parameter date="2026-02-30" is not allowed'],
    ['level=0', 'debug parameter level="0" is not allowed'],
    ['seed=4294967296', 'debug parameter seed="4294967296" is not allowed'],
    ['stars=1:4', 'debug parameter stars="1:4" is not allowed'],
    ['stars=0:3', 'debug parameter stars="0:3" is not allowed'],
    ['screen=%E0%A4%A', '"screen=%E0%A4%A" has a broken %-escape'],
  ])('refuses %s instead of ignoring it', (query, message) => {
    expect(parseDebugLink(`${LINK}?${query}`)).toStrictEqual({ kind: 'error', message });
  });

  it('leaves every other link alone', () => {
    expect(parseDebugLink('e07-line-siege://levels')).toStrictEqual({ kind: 'not-debug' });
    expect(parseDebugLink('e07-line-siege://settings/debug/setup')).toStrictEqual({
      kind: 'not-debug',
    });
  });
});
