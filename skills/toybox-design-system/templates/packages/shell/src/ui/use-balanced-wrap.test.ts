// packages/shell/src/ui/use-balanced-wrap.test.ts
// device-only half: the layout events come from iOS; the search itself is pure and tested here.
import {
  advance,
  afterTextLayout,
  breaksWord,
  failedSearch,
  firstSearch,
  forText,
  isStale,
  nextSearch,
} from './use-balanced-wrap.ts';

describe('balanced wrap search (CSS text-wrap: balance)', () => {
  it('leaves one-line text alone', () => {
    expect(firstSearch('k', 316, [200])).toMatchObject({ pad: 0, isDone: true });
  });

  it('probes half-way between the average line and the full width', () => {
    // 305 + 56 = 361 over two lines: average 180.5, probe floor(248.25) = 248 -> pad 316 - 248 = 68.
    expect(firstSearch('k', 316, [305, 56])).toMatchObject({ lines: 2, pad: 68, isDone: false });
  });

  it('narrows while the line count holds, always below the widest kept line', () => {
    let search = firstSearch('k', 316, [305, 56]);
    search = nextSearch(search, 316, [200, 161]); // 248 kept 2 lines, widest 200
    expect(search).toMatchObject({ hi: 248, widest: 200, pad: 316 - 199, isDone: false });
  });

  it('goes back to the narrowest kept width after a probe adds a line, then probes between', () => {
    // iOS sends no text layout when the lines come out unchanged, so the search never probes
    // straight from a failed layout: it returns to the last width known to keep the count first.
    let search = firstSearch('k', 316, [305, 56]);
    search = nextSearch(search, 316, [240, 121]); // 248 kept, probe floor((180.5 + 248) / 2) = 214
    search = nextSearch(search, 316, [150, 120, 91]); // 214 added a line
    expect(search).toMatchObject({ lo: 214, hi: 248, pad: 68, isReturning: true, isDone: false });
    search = nextSearch(search, 316, [240, 121]); // back at 248: probe floor((214 + 248) / 2) = 231
    expect(search).toMatchObject({ isReturning: false, isDone: false, pad: 316 - 231 });
  });

  it('counts a probe that breaks a word inside as failed, like one that adds a line (spec 8.11)', () => {
    let search = firstSearch('k', 316, [305, 56]); // probe 248
    search = failedSearch(search, 316); // two lines at 248, but a word split inside
    expect(search).toMatchObject({ lo: 248, hi: 316, pad: 0, isReturning: true, isDone: false });
  });

  it('stops when no width between lo and the widest kept line is left', () => {
    let search = firstSearch('k', 316, [305, 56]);
    search = nextSearch(search, 316, [200, 161]); // 248 kept, widest 200: probe 199
    search = nextSearch(search, 316, [150, 120, 91]); // 199 added a line: 200 is the answer
    expect(search).toMatchObject({ lo: 199, hi: 248, pad: 68, isDone: true });
  });

  it('balances the S11c Persian summary like the design (the last word moves down)', () => {
    // Greedy lines of a 3-line text: the second line keeps its last word only above 262 pt.
    const layoutAt = (room: number): number[] => {
      if (room >= 262) return [255, 262, 180];
      return room >= 255 ? [255, 238, 214] : [230, 240, 200, 60];
    };
    let search = firstSearch('k', 305, [300, 270, 60]);
    for (let step = 0; step < 20 && !search.isDone; step += 1) {
      search = nextSearch(search, 305, layoutAt(305 - search.pad));
    }
    expect(305 - search.pad).toBeGreaterThanOrEqual(255);
    expect(305 - search.pad).toBeLessThan(262);
  });

  it('balances the S11c summary like the design (three lines, the same breaks)', () => {
    // Device measurements of "In short: no accounts, and the game itself collects no data." at 258 pt.
    const layoutAt = (room: number): number[] =>
      room >= 192 ? [Math.min(room, 197.3), 173.7, 143.7] : [107.4, 160.6, 174.4, 72.4];
    let search = firstSearch('k', 258, [235.6, 233.1, 46.1]);
    for (let step = 0; step < 10 && !search.isDone; step += 1) {
      search = nextSearch(search, 258, layoutAt(258 - search.pad));
    }
    expect(search.isDone).toBe(true);
    expect(layoutAt(258 - search.pad)).toHaveLength(3);
    expect(258 - search.pad).toBeLessThan(215);
  });
});

describe('breaksWord (a line break inside a word)', () => {
  it('finds a break inside a word, as iOS wraps a word wider than its line', () => {
    expect(breaksWord('Diesmal nicht', ['Diesm', 'al nicht'])).toBe(true);
    expect(breaksWord('Daily challenge', ['Daily ', 'chall', 'enge'])).toBe(true);
  });

  it('accepts breaks at spaces, whether iOS keeps the space on the line or not', () => {
    expect(breaksWord('Diesmal nicht', ['Diesmal ', 'nicht'])).toBe(false);
    expect(breaksWord('Diesmal nicht', ['Diesmal', 'nicht'])).toBe(false);
    expect(breaksWord('این بار نشد', ['این بار ', 'نشد'])).toBe(false);
  });

  it('accepts a break after a hyphen or a dash', () => {
    expect(breaksWord('Tages-Challenge spielen', ['Tages-', 'Challenge spielen'])).toBe(false);
    expect(breaksWord('Play – Level 12', ['Play –', ' Level 12'])).toBe(false);
  });

  it('looks through bidi isolates around a placeholder', () => {
    const text = '\u2068Saturday\u2069, 26 Sep';
    expect(breaksWord(text, ['\u2068Saturda', 'y\u2069, 26 Sep'])).toBe(true);
    expect(breaksWord(text, ['\u2068Saturday\u2069, ', '26 Sep'])).toBe(false);
  });

  it('says nothing when the lines carry no text or do not spell the text', () => {
    expect(breaksWord('Diesmal nicht', [undefined, undefined])).toBe(false);
    expect(breaksWord('Diesmal nicht', ['Diesm', 'al'])).toBe(false);
  });
});

describe('advance (layout events in either order)', () => {
  it('starts the search once both the width and the full-width lines are known', () => {
    const linesFirst = advance({ text: 't', width: 0, lineWidths: [305, 56], search: null });
    expect(linesFirst.search).toBeNull();
    const thenWidth = advance({ ...linesFirst, width: 316 });
    expect(thenWidth.search).toMatchObject({ lines: 2, isDone: false });
  });

  it('moves the search on with each later text layout and stops when done', () => {
    let measure = advance({ text: 't', width: 316, lineWidths: [305, 56], search: null });
    for (let step = 0; step < 10; step += 1) {
      const tried = 316 - (measure.search?.pad ?? 0);
      measure = advance({ ...measure, lineWidths: tried >= 205 ? [200, 160] : [150, 120, 90] });
    }
    expect(measure.search?.isDone).toBe(true);
  });
});

describe('isStale (a late text layout from a wider pad)', () => {
  const probing = advance({ text: 't', width: 316, lineWidths: [305, 56], search: null });
  const room = 316 - (probing.search?.pad ?? 0);

  it('drops a layout with a line wider than the room the current pad leaves', () => {
    expect(isStale(probing, [305, 56])).toBe(true);
  });

  it('keeps a layout whose lines fit the current room (it wraps the same)', () => {
    expect(isStale(probing, [room - 10, room - 40])).toBe(false);
  });

  it('keeps every layout before the width is known', () => {
    expect(isStale({ ...probing, width: 0 }, [900])).toBe(false);
  });
});

describe('afterTextLayout (the state after a text layout)', () => {
  it('keeps the stored state when a layout repeats the lines of a finished search', () => {
    const settled = afterTextLayout(
      { text: 't', width: 316, lineWidths: null, search: null },
      't',
      [200],
    );
    expect(settled.search?.isDone).toBe(true);
    expect(afterTextLayout(settled, 't', [200])).toBe(settled);
  });

  it('keeps the stored state when a layout before the width repeats its lines', () => {
    const waiting = afterTextLayout(
      { text: 't', width: 0, lineWidths: null, search: null },
      't',
      [305, 56],
    );
    expect(afterTextLayout(waiting, 't', [305, 56])).toBe(waiting);
  });

  it('stores new lines, and moves an unfinished search on', () => {
    const waiting = afterTextLayout(
      { text: 't', width: 0, lineWidths: null, search: null },
      't',
      [305, 56],
    );
    expect(waiting.lineWidths).toStrictEqual([305, 56]);
    const probing = advance({ ...waiting, width: 316 });
    const room = 316 - (probing.search?.pad ?? 0);
    const next = afterTextLayout(probing, 't', [room - 10, room - 40]);
    expect(next.search?.steps).toBe(1);
  });

  it('starts again for a new text and drops a stale layout', () => {
    const probing = advance({ text: 't', width: 316, lineWidths: [305, 56], search: null });
    expect(afterTextLayout(probing, 't', [305, 56])).toBe(probing);
    expect(afterTextLayout(probing, 'u', [120])).toStrictEqual({
      text: 'u',
      width: 0,
      lineWidths: [120],
      search: null,
    });
  });
});

describe('forText (state kept for one text)', () => {
  it('keeps the stored state for its text and starts a new text from nothing', () => {
    const stored = { text: 'Daily', lines: 2 };
    const fresh = (text: string) => ({ text, lines: 0 });
    expect(forText(stored, 'Daily', fresh)).toBe(stored);
    expect(forText(stored, 'Täglich', fresh)).toStrictEqual({ text: 'Täglich', lines: 0 });
  });
});
