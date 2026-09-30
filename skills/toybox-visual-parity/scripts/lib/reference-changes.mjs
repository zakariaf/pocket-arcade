// The log of intended reference changes: assets/reference/<game>/manifest.json "referenceChanges".
// Every deliberate change of the committed references (a design change the owner or the lead
// approved, a re-render of the whole set) is recorded here, never as a waiver:
//   { "id": "L1", "date": "2026-09-30", "frames": ["s11-settings"], "variants": ["s11-settings--no-music"],
//     "what": "<what changed in the references>", "why": "<the decision and who approved it>" }
// shoot-design.mjs --update-reference keeps the log, --check validates it, and check-signoff.mjs
// prints the entries of every frame it signs off, so the owner report can name them.
import { referenceName } from './frames.mjs';

const CHANGE_KEYS = ['id', 'date', 'frames', 'variants', 'what', 'why'];

/** Problems of a manifest's referenceChanges (strings), checked against the frame catalogue. */
export function referenceChangeProblems(manifest, { frames }) {
  const list = manifest?.referenceChanges;
  if (list === undefined) return [];
  if (!Array.isArray(list)) return ['referenceChanges must be a list of { id, date, frames, variants, what, why }'];
  const problems = [];
  const variantNames = new Set([...frames.values()].flatMap((f) => Object.keys(f.variants ?? {}).map((id) => referenceName(f.key, id))));
  const ids = new Set();
  list.forEach((entry, i) => {
    const at = `referenceChanges[${i}]${entry?.id ? ` (${entry.id})` : ''}`;
    if (!entry || typeof entry !== 'object') {
      problems.push(`${at} is not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !CHANGE_KEYS.includes(k));
    if (extra.length) problems.push(`${at} has unknown fields ${extra.join(', ')}`);
    if (typeof entry.id !== 'string' || !entry.id.trim()) problems.push(`${at} needs an id (the decision or item that asked for it, e.g. L1)`);
    else if (ids.has(entry.id)) problems.push(`${at}: the id ${entry.id} is used twice`);
    ids.add(entry.id);
    if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) problems.push(`${at} needs "date": "YYYY-MM-DD"`);
    for (const key of ['frames', 'variants']) {
      if (!Array.isArray(entry[key])) problems.push(`${at} needs "${key}": a list (empty when none)`);
    }
    for (const key of entry.frames ?? []) if (!frames.has(key)) problems.push(`${at} names the unknown frame ${key}`);
    for (const name of entry.variants ?? []) if (!variantNames.has(name)) problems.push(`${at} names the unknown variant ${name}`);
    for (const key of ['what', 'why']) {
      if (typeof entry[key] !== 'string' || entry[key].trim().length < 20) problems.push(`${at} needs "${key}" (20+ characters)`);
    }
  });
  return problems;
}

/** The change entries that touch one frame, or one of its variants. */
export function changesForFrame(manifest, frameKey) {
  return (manifest?.referenceChanges ?? []).filter(
    (entry) => (entry.frames ?? []).includes(frameKey) || (entry.variants ?? []).some((name) => name === frameKey || name.startsWith(`${frameKey}--`)),
  );
}
