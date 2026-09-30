// The two edits that turn the Toybox mockup into this skill's offline design copy:
//   1. the Google Fonts <link> tags become local @font-face rules for the exact TTF files the app
//      bundles (assets/design/fonts/), so a reference never depends on the network or on a font
//      version Google serves that day;
//   2. strings that name project files (handbook chapters, the product spec, the mockup path) are
//      rewritten to plain words, so the copy stands alone. Those strings sit in the page chrome and
//      in the embedded copy deck's metadata, never inside a phone frame, so no frame pixel changes.
// Everything else stays byte-for-byte the same.

export const FONT_FACES = [
  { family: 'Lilita One', weight: 400, file: 'LilitaOne.ttf' },
  { family: 'Rubik', weight: 400, file: 'Rubik-Regular.ttf' },
  { family: 'Rubik', weight: 700, file: 'Rubik-Bold.ttf' },
  { family: 'Vazirmatn', weight: 400, file: 'Vazirmatn-Regular.ttf' },
  { family: 'Vazirmatn', weight: 700, file: 'Vazirmatn-Bold.ttf' },
];

export const FONT_BLOCK = [
  '<style id="pa-local-fonts">',
  '/* toybox-visual-parity: the page loaded Lilita One, Rubik 400/700 and Vazirmatn 400/700 from Google Fonts.',
  '   These rules load the same families from the TTF files the app bundles (fonts/ next to this file),',
  '   with the same weights, so references render offline with exactly the app\'s glyphs. */',
  ...FONT_FACES.map(
    (f) => `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(fonts/${f.file}) format('truetype')}`,
  ),
  '</style>',
].join('\n');

const HOSTED_FONT_LINK = /^[ \t]*<link\b[^>]*\bhref="https:\/\/fonts\.(googleapis|gstatic)\.com[^"]*"[^>]*>[ \t]*\r?\n/gm;

// Same wording as the skill library's shared-file import, so every skill says it the same way.
const REWRITES = [
  [/design\/toybox\.html/g, 'the Toybox HTML mockup'],
  [/docs\/(\d{2})-([a-z0-9-]+)\.md/g, (_match, chapter, slug) => `handbook chapter ${chapter} (${slug.replace(/-/g, ' ')})`],
  [/docs\/(\d{2})\b/g, 'handbook chapter $1'],
  [/spec\.txt/g, 'the product spec'],
];

// What must never survive the import (checked after rewriting).
const LEFTOVERS = [
  [/fonts\.(googleapis|gstatic)\.com/, 'a hosted-font URL'],
  [/<link\b[^>]*\bhref="https?:/, 'a <link> to the network'],
  [/<script\b[^>]*\bsrc="https?:/, 'a <script> from the network'],
  [/\bdocs\/\d{2}/, 'a handbook path'],
  [/\bspec\.txt\b/, 'the spec file name'],
  [/\bdesign\/[a-z]/, 'a design folder path'],
  [new RegExp(['idea', 'hunt'].join('-')), 'a research folder name'],
];

/**
 * Returns { html, problems } where problems is a list of { rule, message, fix }.
 */
export function importDesign(original) {
  const problems = [];
  const links = original.match(HOSTED_FONT_LINK) ?? [];
  const stylesheet = links.find((line) => /rel="stylesheet"/.test(line));
  if (!stylesheet) {
    problems.push({
      rule: 'font-link-missing',
      message: 'the original has no Google Fonts stylesheet <link>, so there is no place to put the local fonts',
      fix: 'Pass the untouched Toybox mockup (it loads Lilita One, Rubik and Vazirmatn from Google Fonts).',
    });
    return { html: original, problems };
  }
  const families = /family=([^"]+)/.exec(stylesheet)?.[1] ?? '';
  for (const name of ['Lilita+One', 'Rubik', 'Vazirmatn']) {
    if (!families.includes(name)) {
      problems.push({
        rule: 'font-families',
        message: `the Google Fonts link no longer loads ${name.replace('+', ' ')} (it asks for "${families}")`,
        fix: 'The design changed its fonts: update FONT_FACES in scripts/lib/design-import.mjs and the shared font files together.',
      });
    }
  }
  let html = original.replace(HOSTED_FONT_LINK, (line) => (line === stylesheet ? `${FONT_BLOCK}\n` : ''));
  for (const [pattern, replacement] of REWRITES) html = html.replace(pattern, replacement);
  html.split('\n').forEach((line, index) => {
    for (const [pattern, what] of LEFTOVERS) {
      if (pattern.test(line)) {
        problems.push({
          rule: 'leftover',
          message: `line ${index + 1} still contains ${what} after the import`,
          fix: 'Add a rewrite for it in scripts/lib/design-import.mjs (the copy must work offline and name no project files).',
        });
      }
    }
  });
  return { html, problems };
}
