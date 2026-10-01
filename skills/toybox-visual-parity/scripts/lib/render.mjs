// Renders design frames with Playwright + the installed Google Chrome at the parity device's
// geometry, and extracts each frame's layout (testID rects, texts, computed styles, text runs).
import { pathToFileURL } from 'node:url';

import { FONT_FACES } from './design-import.mjs';

/** CSS that turns a showcase phone frame into the device screen (sizes from the device profile). */
export function parityCss(device) {
  const w = device.points.width;
  const h = device.points.height;
  const top = device.safeArea.top;
  return [
    ':root{--pz:1 !important;--mz:1 !important}',
    '.phone{zoom:1 !important;padding:0 !important;border-radius:0 !important;box-shadow:none !important;background:none !important}',
    `.scr{border-radius:0 !important;width:${w}px !important}`,
    `.scr:not(.tall){height:${h}px !important}`,
    `.scr.tall{min-height:${h}px !important}`,
    // The design draws a 54 pt status bar for its 390 x 844 phone; the device's safe top is 62.
    `.sb{height:${top}px !important}`,
    `.bg-under{inset:${top}px 0 0 0 !important}`,
    // simctl screenshots have no home indicator, so the reference hides the drawn one.
    '.hi{display:none !important}',
    // State cards are 390-wide fragments at 410 with a 10 px frame; widen the content to the device width.
    `.mini{width:${w + 20}px !important;zoom:1 !important;border-radius:0 !important}`,
    '*,*::before,*::after{animation-duration:0s !important;animation-delay:0s !important;transition-duration:0s !important;transition-delay:0s !important;caret-color:transparent !important}',
    '.parity-pin{position:fixed !important;left:0 !important;top:0 !important;z-index:2147483647 !important;margin:0 !important}',
    '.mini.parity-pin{left:-10px !important;top:-10px !important}',
  ].join('\n');
}

/** Open the design for one theme/language/game in a fresh context. Returns { context, page, blocked }. */
export async function openDesign(browser, { designPath, theme, lang, game, device }) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: device.scale,
    colorScheme: theme,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  await context.addInitScript(({ t, l, g }) => {
    try {
      localStorage.setItem('pa-toybox.theme', t);
      localStorage.setItem('pa-toybox.lang', l);
      localStorage.setItem('pa-toybox.game', g);
    } catch {
      // storage blocked: the page falls back to its defaults (caught by the frame checks)
    }
  }, { t: theme, l: lang, g: game });
  const page = await context.newPage();
  const blocked = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message ?? error)));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  await page.goto(pathToFileURL(designPath).href, { waitUntil: 'load' });
  const fonts = await page.evaluate(async (faces) => {
    await Promise.all(faces.map((f) => document.fonts.load(`${f.weight} 20px "${f.family}"`)));
    await document.fonts.ready;
    return faces.map((f) => ({ ...f, ok: document.fonts.check(`${f.weight} 20px "${f.family}"`) }));
  }, FONT_FACES);
  const state = await page.evaluate(() => {
    const pressed = (set) => document.querySelector(`[data-set="${set}"][aria-pressed="true"]`)?.dataset.val ?? null;
    return { theme: pressed('theme'), lang: pressed('lang'), game: pressed('game') };
  });
  await page.addStyleTag({ content: parityCss(device) });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, blocked, errors, fonts, state };
}

/** In-page: find the frame, pin it to (0,0) and return its caption slug and size in points. */
function pinFrame({ selector }) {
  const list = document.querySelectorAll(selector);
  if (list.length !== 1) return { count: list.length };
  const frame = list[0];
  const isCard = frame.classList.contains('mini');
  const holder = frame.closest('.pg-fig, .mini-w');
  const tag = holder?.querySelector('.pg-tag');
  const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const caption = tag ? slug(`${tag.querySelector('b')?.textContent ?? ''}-${tag.querySelector('span:not(.pg-hole)')?.textContent ?? ''}`) : null;
  const pinTarget = isCard ? frame : frame.closest('.phone');
  pinTarget.classList.add('parity-pin');
  return { count: 1, caption, isCard, width: frame.clientWidth, height: frame.clientHeight };
}

function unpinFrame() {
  document.querySelectorAll('.parity-pin').forEach((el) => el.classList.remove('parity-pin'));
}

/** In-page: the layout of one pinned frame. */
function extractLayout({ selector, elements }) {
  const frame = document.querySelector(selector);
  const fr = frame.getBoundingClientRect();
  const origin = { x: fr.left + frame.clientLeft, y: fr.top + frame.clientTop };
  const r2 = (v) => Math.round(v * 100) / 100;
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
  const rgbHex = (css) => {
    const m = /rgba?\(([^)]+)\)/.exec(css ?? '');
    if (!m) return null;
    const [r, g, b, a = '1'] = m[1].split(',').map((v) => v.trim());
    if (Number(a) === 0) return null;
    const h = [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    return Number(a) < 1 ? `#${h} @${Number(a)}` : `#${h}`;
  };
  const rotation = (transform) => {
    const m = /matrix\(([^)]+)\)/.exec(transform ?? '');
    if (!m) return 0;
    const [a, b] = m[1].split(',').map(Number);
    return r2((Math.atan2(b, a) * 180) / Math.PI);
  };
  const nodeToId = new Map();
  const out = [];
  for (const el of elements) {
    let list;
    try {
      list = el.designSelector === ':scope' ? [frame] : [...frame.querySelectorAll(el.designSelector)];
    } catch (error) {
      out.push({ testID: el.testID, count: 0, error: String(error.message) });
      continue;
    }
    if (list.length !== 1) {
      out.push({ testID: el.testID, count: list.length });
      continue;
    }
    const node = list[0];
    if (!nodeToId.has(node)) nodeToId.set(node, el.testID);
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    let rot = 0;
    for (let p = node; p && p !== frame; p = p.parentElement) rot += rotation(getComputedStyle(p).transform);
    out.push({
      testID: el.testID,
      count: 1,
      // The frame itself is its padding box (a state card's 10 px showcase border is not part of it).
      rect: node === frame ? { x: 0, y: 0, w: frame.clientWidth, h: frame.clientHeight } : { x: r2(r.left - origin.x), y: r2(r.top - origin.y), w: r2(r.width), h: r2(r.height) },
      box: { w: node.offsetWidth ?? r2(r.width), h: node.offsetHeight ?? r2(r.height), rotate: r2(rot) },
      text: norm(node.innerText ?? node.textContent),
      aria: node.getAttribute('aria-label'),
      style: {
        fill: rgbHex(cs.backgroundColor),
        color: rgbHex(cs.color),
        border: cs.borderTopStyle === 'none' ? null : `${cs.borderTopWidth} ${cs.borderTopStyle} ${rgbHex(cs.borderTopColor)}`,
        radius: cs.borderTopLeftRadius,
        shadow: cs.boxShadow === 'none' ? null : cs.boxShadow,
        outline: cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0 ? null : `${cs.outlineWidth} ${cs.outlineStyle} offset ${cs.outlineOffset}`,
        font: `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
      },
    });
  }
  const texts = [];
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const host = n.parentElement;
    if (!host || host.closest('.sb, .island')) continue;
    let owner = null;
    for (let p = host; p && p !== frame.parentElement; p = p.parentElement) {
      if (nodeToId.has(p)) {
        owner = nodeToId.get(p);
        break;
      }
    }
    const cs = getComputedStyle(host);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    // The run's own tilt (every transform between it and the frame): a run outside every mapped
    // element (Home's tilted streak sticker under an S14 dialog) has no owner to take it from.
    let tilt = 0;
    for (let p = host; p && p !== frame; p = p.parentElement) tilt += rotation(getComputedStyle(p).transform);
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const b of range.getClientRects()) {
      if (b.width < 0.5 || b.height < 0.5) continue;
      texts.push({
        text: norm(n.textContent),
        x: r2(b.left - origin.x),
        y: r2(b.top - origin.y),
        w: r2(b.width),
        h: r2(b.height),
        owner,
        font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily.split(',')[0].replace(/["']/g, '')}`,
        ...(r2(tilt) ? { rotate: r2(tilt) } : {}),
      });
    }
  }
  return { width: frame.clientWidth, height: frame.clientHeight, elements: out, texts };
}

/**
 * In-page: a reference variant's DOM change (frames.json variants.<id>.derive), applied to the
 * rendered mockup before it is measured and shot, never to the design file. Each step matches
 * exactly one element of the frame:
 *   hide   display:none (the element stays in the DOM, so the positional selectors of its
 *          siblings still match; the rows below close up as a flex column lays them out)
 *   style  inline CSS properties (the Pause keys share the row in two columns)
 *   text   the element's text after its icon becomes a Shell message ({name, number} placeholders
 *          formatted exactly like the mockup's own N(): Intl.NumberFormat with the deck's
 *          numberLocales tag, ckb falling back to fa-u-nu-arabext, maximumFractionDigits 2)
 * Returns { problems, formatCheck } and keeps what it changed on window.__parityUndo.
 */
function applyDerive({ selector, derive, lang, fixtureScore }) {
  const frame = document.querySelector(selector);
  const undo = [];
  const problems = [];
  const deck = JSON.parse(document.getElementById('pa-deck').textContent);
  let ckb = false;
  try {
    ckb = Intl.NumberFormat.supportedLocalesOf(['ckb']).length > 0;
  } catch {
    ckb = false;
  }
  const tag = lang === 'ckb' ? (ckb ? 'ckb-u-nu-arabext' : 'fa-u-nu-arabext') : (deck.meta.numberLocales[lang] || 'en');
  const number = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const format = (message, values) => message.replace(/\{(\w+), number\}/g, (m, name) => (name in values ? number.format(values[name]) : m));
  // Proof that this formatter is the mockup's own: the fixture score the mockup drew with its N()
  // (the .sc-v value of the win card, type role scoreValue: 44 px display, line height 1, and 1.45
  // for Persian since lead decision L9) must read the same through it.
  const scoreValue = frame.querySelector('.sc-v');
  const formatCheck = scoreValue ? { drawn: scoreValue.textContent.trim(), ours: number.format(fixtureScore) } : null;
  for (const step of derive) {
    const sel = step.hide ?? step.style ?? step.text;
    const list = frame.querySelectorAll(sel);
    if (list.length !== 1) {
      problems.push(`derive selector "${sel}" matched ${list.length} elements`);
      continue;
    }
    const node = list[0];
    if (step.hide !== undefined || step.style !== undefined) {
      undo.push({ node, kind: 'style', value: node.getAttribute('style') });
      if (step.hide !== undefined) node.style.setProperty('display', 'none', 'important');
      else for (const [prop, value] of Object.entries(step.css)) node.style.setProperty(prop, value, 'important');
      continue;
    }
    const message = step.messages?.[lang] ?? step.messages?.en;
    const text = format(message, step.values);
    if (/[{}]/.test(text)) problems.push(`derive text "${message}" has a placeholder the values do not fill`);
    undo.push({ node, kind: 'html', value: node.innerHTML });
    for (const child of [...node.childNodes]) if (!(child.nodeType === 1 && child.matches('svg, .ic'))) child.remove();
    node.append(document.createTextNode(text));
  }
  window.__parityUndo = [...(window.__parityUndo ?? []), ...undo];
  return { problems, formatCheck };
}

/**
 * In-page: the frame's sample fixes (frames.json designFixes), applied to every render of the frame
 * before it is measured. The mockup fills {languageName} of the System row with the fixed sample
 * "English" in every language; the product names the phone's language, which the capture sets to the
 * render language. Each fix re-renders the element's text the way the mockup's own T() does in HTML
 * mode (literal text escaped, each plain {name} placeholder wrapped in <bdi>), from the deck embedded
 * in the page, with "@autonym" replaced by the render language's autonym. Undone with the derive
 * (window.__parityUndo).
 */
function applyDesignFixes({ selector, fixes, lang }) {
  const frame = document.querySelector(selector);
  const deck = JSON.parse(document.getElementById('pa-deck').textContent);
  const problems = [];
  window.__parityUndo ??= [];
  for (const fix of fixes) {
    const list = frame.querySelectorAll(fix.sample);
    const entry = deck.strings[fix.key];
    const message = entry ? (entry[lang] ?? entry.en) : null;
    if (list.length !== 1 || typeof message !== 'string' || /\{[^}]*,/.test(message)) {
      problems.push(list.length !== 1 ? `design fix selector "${fix.sample}" matched ${list.length} elements` : `design fix key "${fix.key}" is not a plain deck message`);
      continue;
    }
    const node = list[0];
    const holder = document.createElement('span');
    for (const part of message.split(/(\{\w+\})/)) {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      if (!name) {
        holder.append(document.createTextNode(part));
        continue;
      }
      const value = fix.values[name] === '@autonym' ? deck.meta.languageNames[lang] : fix.values[name];
      const bdi = document.createElement('bdi');
      bdi.textContent = String(value ?? part);
      holder.append(bdi);
    }
    window.__parityUndo.push({ node, kind: 'html', value: node.innerHTML });
    node.innerHTML = holder.innerHTML;
  }
  return problems;
}

/** In-page: which mapped elements of the frame are hidden (no box), by testID. */
function hiddenElements({ selector, elements }) {
  const frame = document.querySelector(selector);
  const out = {};
  for (const el of elements) {
    let list;
    try {
      list = el.designSelector === ':scope' ? [frame] : [...frame.querySelectorAll(el.designSelector)];
    } catch {
      list = [];
    }
    if (list.length === 1) out[el.testID] = list[0].getClientRects().length === 0;
  }
  return out;
}

/** In-page: the rectangles of the frame's design masks (frames.json designMasks), in frame points. */
function measureMasks({ selector, masks }) {
  const frame = document.querySelector(selector);
  const fr = frame.getBoundingClientRect();
  const origin = { x: fr.left + frame.clientLeft, y: fr.top + frame.clientTop };
  const r2 = (v) => Math.round(v * 100) / 100;
  return masks.map((m) => {
    const list = frame.querySelectorAll(m.selector);
    if (list.length !== 1) return { as: m.as, selector: m.selector, count: list.length };
    const r = list[0].getBoundingClientRect();
    return { as: m.as, selector: m.selector, count: 1, rect: { x: r2(r.left - origin.x), y: r2(r.top - origin.y), w: r2(r.width), h: r2(r.height) } };
  });
}

function undoDerive() {
  for (const step of (window.__parityUndo ?? []).reverse()) {
    if (step.kind === 'html') step.node.innerHTML = step.value;
    else if (step.value === null) step.node.removeAttribute('style');
    else step.node.setAttribute('style', step.value);
  }
  window.__parityUndo = [];
}

/**
 * The derive of a variant changes exactly the elements its facts change: every mapped element it
 * hides must exist only for other facts (a "when" the variant's facts do not match), and every
 * element that exists only for other facts must be hidden or re-texted by it. So a derive that hides
 * the undo key instead of the hint key fails (rule variant-derive).
 */
function deriveProblems({ variant, checkElements, before, after, textTargets }) {
  const problems = [];
  const matches = (el) => Object.entries(el.when ?? {}).every(([k, v]) => variant.facts[k] === v);
  for (const el of checkElements) {
    if (!(el.testID in before) || before[el.testID]) continue;
    const hidden = after[el.testID] === true;
    if (hidden && matches(el)) problems.push(`${variant.id}: the derive hides ${el.testID}, which exists for these facts (${JSON.stringify(variant.when)})`);
    if (!hidden && !matches(el) && !textTargets.includes(el.testID)) problems.push(`${variant.id}: ${el.testID} exists only when ${JSON.stringify(el.when)}, but the derive leaves it on screen`);
  }
  return problems;
}

/**
 * Shoot one frame (or one of its reference variants: `variant` from frames.json, composed by
 * variantFor/referencePlan). Returns { problems[], png (Buffer from Chrome), layout, caption, size }.
 * The frame is pinned at (0,0) and clipped, which avoids the fractional-offset element screenshot
 * (1206 x 2625 instead of 1206 x 2622). The frame's design fixes and a variant's derive are applied
 * after pinning and undone before returning; `checkElements` (every mapped element of the frame for
 * the game, whatever its "when") lets the derive be checked against the map.
 */
export async function shootFrame(page, { frame, elements, checkElements = elements, device, variant = null, lang = 'en', fixtureScore = 1840 }) {
  const pinned = await page.evaluate(pinFrame, { selector: frame.selector });
  if (pinned.count !== 1) return { problems: [{ rule: 'frame-selector', message: `frame selector matched ${pinned.count} elements` }] };
  try {
    const problems = [];
    const probe = checkElements.map((el) => ({ testID: el.testID, designSelector: el.designSelector }));
    if ((frame.designFixes ?? []).length) {
      for (const message of await page.evaluate(applyDesignFixes, { selector: frame.selector, fixes: frame.designFixes, lang })) problems.push({ rule: 'design-fix', message });
      if (problems.length) return { problems };
    }
    if (variant) {
      const before = await page.evaluate(hiddenElements, { selector: frame.selector, elements: probe });
      const derive = variant.derive.map((step) => (step.text === undefined ? step : { ...step, messages: variant.texts[step.key] }));
      const derived = await page.evaluate(applyDerive, { selector: frame.selector, derive, lang, fixtureScore });
      for (const message of derived.problems) problems.push({ rule: 'variant-derive', message: `${variant.id}: ${message}` });
      if (derived.formatCheck && derived.formatCheck.drawn !== derived.formatCheck.ours) {
        problems.push({ rule: 'variant-derive', message: `${variant.id}: the mockup drew the score "${derived.formatCheck.drawn}" but the variant's number format gives "${derived.formatCheck.ours}"` });
      }
      const after = await page.evaluate(hiddenElements, { selector: frame.selector, elements: probe });
      const textSelectors = variant.derive.filter((step) => step.text !== undefined).map((step) => step.text);
      const textTargets = checkElements.filter((el) => textSelectors.includes(el.designSelector)).map((el) => el.testID);
      for (const message of deriveProblems({ variant, checkElements, before, after, textTargets })) problems.push({ rule: 'variant-derive', message });
      if (problems.length) return { problems };
    }
    const size = await page.evaluate((sel) => ({ height: document.querySelector(sel).clientHeight }), frame.selector);
    const width = device.points.width;
    const height = Math.ceil(size.height);
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    // Under load Chrome can hand back a frame before the pinned frame's content is painted (a blank
    // card, seen on 2026-09-30). Wait two animation frames, then shoot until two shots in a row agree.
    const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const shoot = () => page.screenshot({ clip: { x: 0, y: 0, width, height }, animations: 'disabled', caret: 'hide', scale: 'device' });
    await settle();
    let png = await shoot();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await settle();
      const again = await shoot();
      if (again.equals(png)) break;
      png = again;
    }
    const layout = await page.evaluate(extractLayout, { selector: frame.selector, elements: elements.map((el) => ({ testID: el.testID, designSelector: el.designSelector })) });
    if ((frame.designMasks ?? []).length) {
      layout.masks = await page.evaluate(measureMasks, { selector: frame.selector, masks: frame.designMasks });
      for (const m of layout.masks) if (m.count !== 1) problems.push({ rule: 'design-mask', message: `design mask "${m.selector}" (${m.as}) matched ${m.count} elements` });
      if (problems.length) return { problems };
    }
    return { problems: [], png, layout, caption: pinned.caption, isCard: pinned.isCard, size: { w: width, h: height } };
  } finally {
    if (variant || (frame.designFixes ?? []).length) await page.evaluate(undoDerive);
    await page.evaluate(unpinFrame);
    await page.setViewportSize({ width: 1400, height: 1000 });
  }
}
