// Element bounds of the app, from either source:
//   app.hier.json    `maestro hierarchy` output: resource-id = RN testID, bounds "[x0,y0][x1,y1]" in
//                    whole points, accessibilityText = the accessibility label. Lists only on-screen
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

export function parseMaestroHierarchy(json) {
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
      const [x0, y0, x1, y1] = m.slice(1).map(Number);
      const found = elements.get(id);
      if (found) found.count += 1;
      else elements.set(id, { x: x0, y: y0, w: x1 - x0, h: y1 - y0, label: normText(label), count: 1 });
    }
    for (const child of node?.children ?? []) walk(child);
  };
  walk(json);
  return { source: 'maestro', elements, labels, nodes };
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
