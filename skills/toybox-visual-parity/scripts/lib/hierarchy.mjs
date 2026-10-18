// Element bounds of the app, from either source:
//   app.hier.json    `maestro hierarchy` output: resource-id = RN testID, bounds "[x0,y0][x1,y1]" in
//                    whole points on iOS and in screen pixels on Android (run.json "hierarchyPxPerPt":
//                    the density, 3), accessibilityText = the accessibility label. Lists only on-screen
//                    elements and hides the children of accessible elements.
//   app.layout.json  an in-app layout reporter (test builds): { elements: [{ testID, x, y, w, h, text }] }
//                    in points, floats, children included.
import { TESTID_PATTERN } from './frames.mjs';

const BOUNDS = /^\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]$/;
const INVISIBLE_BIDI = /[‎‏‪-‮⁦-⁩]/g;

/** Whitespace-normalised text without invisible bidi controls (the app may isolate names). */
export function normText(text) {
  return String(text ?? '').replace(INVISIBLE_BIDI, '').replace(/\s+/g, ' ').trim();
}

/** Maestro's hierarchy; pxPerPt divides Android's pixel bounds into points (1 on iOS). */
export function parseMaestroHierarchy(json, { pxPerPt = 1 } = {}) {
  const elements = new Map();
  const labels = [];
  let nodes = 0;
  const walk = (node) => {
    nodes += 1;
    const a = node?.attributes ?? {};
    const id = a['resource-id'];
    const m = BOUNDS.exec(a.bounds ?? '');
    const label = a.accessibilityText || a.text || a.value || '';
    if (label) labels.push(label);
    if (id && TESTID_PATTERN.test(id) && m) {
      const [x0, y0, x1, y1] = m.slice(1).map((v) => Number(v) / pxPerPt);
      const found = elements.get(id);
      if (found) found.count += 1;
      else elements.set(id, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, label: normText(label), count: 1 });
    }
    for (const child of node?.children ?? []) walk(child);
  };
  walk(json);
  return { source: 'maestro', elements, labels, nodes };
}

/**
 * Android reports accessibility bounds clipped to what is visible (iOS reports the whole frame), so
 * a body element of a tall frame that runs past the body window comes back cut at the window's edge.
 * `box` is the element's reported box, `top` where its top should be (its design y plus the scroll),
 * `height` its design height, `window` the body window ({ top, bottom }: the fixed header's bottom and
 * the body's bottom, screen pt) and `tolerance` the bounds tolerance in pt. Any part past an edge is
 * cut, a sliver too (S11's Privacy tab ran 1.6 pt under the top bar and came back 2.2 pt short,
 * E18-T22). Returns the box rebuilt from its visible edge and the design height, { y, h, cut } with
 * cut 'top', 'bottom' or 'top and bottom', or null when the box is not cut. The gates and the sheets
 * (eye pages through a cut cover) both normalise through here.
 */
export function unclipBodyBounds(box, { top, height, window, tolerance }) {
  const isCutTop = top < window.top && Math.abs(box.y - window.top) <= tolerance;
  const isCutBottom = top + height > window.bottom && Math.abs(box.y + box.h - window.bottom) <= tolerance;
  if (isCutTop && isCutBottom) return { y: top, h: height, cut: 'top and bottom' };
  if (isCutTop) return { y: box.y + box.h - height, h: height, cut: 'top' };
  if (isCutBottom) return { y: box.y, h: height, cut: 'bottom' };
  return null;
}

/**
 * The parity harness's scroll markers: a ScreenBody that has scrolled in a parity capture draws an
 * invisible element parity.scroll.<y> with the contentOffset it reached (hundredths of a point,
 * "n" before a negative offset). Returns [{ testID, y }] in the order found (none in an old capture).
 */
export const SCROLL_MARKER = /^parity\.scroll\.(n?)(\d+)\.(\d{2})$/;
export function scrollMarkersOf(bounds) {
  const markers = [];
  for (const testID of bounds?.elements?.keys?.() ?? []) {
    const m = SCROLL_MARKER.exec(testID);
    if (m) markers.push({ testID, y: (m[1] ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 100) });
  }
  return markers;
}

export function parseAppLayout(json) {
  const elements = new Map();
  for (const el of json?.elements ?? []) {
    if (!el || typeof el.testID !== 'string' || !TESTID_PATTERN.test(el.testID)) continue;
    const found = elements.get(el.testID);
    if (found) found.count += 1;
    else elements.set(el.testID, { x: Number(el.x), y: Number(el.y), w: Number(el.w), h: Number(el.h), label: normText(el.text ?? ''), count: 1 });
  }
  return { source: 'layout', elements, labels: [], nodes: elements.size };
}
