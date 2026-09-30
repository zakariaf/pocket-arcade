// palette-rules.mjs: the Toybox palette rules in plain JS (the same rules as the app's
// packages/shell/src/testing/toybox-palette-checks.ts), for check-design-system.mjs and write-palette.mjs.

const HEX = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/;

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value);
}

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [, r, g, b] = HEX.exec(hex);
  return 0.2126 * channel(parseInt(r, 16)) + 0.7152 * channel(parseInt(g, 16)) + 0.0722 * channel(parseInt(b, 16));
}

/** WCAG 2.2 contrast ratio, 1..21. */
export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export const TEXT_PAIRS = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'sunken', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['textMuted', 'sunken', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onPop', 'pop', 4.5],
  ['danger', 'surface', 4.5],
  ['border', 'background', 3],
  ['border', 'surface', 3],
  ['focus', 'background', 3],
  ['focus', 'sunken', 3],
  ['starOff', 'surface', 3],
];

export const FILLS = [
  ['primary', 'background'],
  ['pop', 'background'],
  ['starOn', 'surface'],
];

export const TOY_INK = '#1D1B3A';
export const PENCIL = '#43406A';
export const LIGHT_INK = {
  text: TOY_INK,
  border: TOY_INK,
  shadow: TOY_INK,
  onPrimary: TOY_INK,
  onPop: TOY_INK,
  icon: TOY_INK,
  textMuted: PENCIL,
  starOff: PENCIL,
};

/** Shell constants copied into every palette (they never change with the game). */
export function shellFields(tokens, scheme) {
  const shell = tokens.color.shell[scheme];
  return { danger: shell.danger, focus: shell.focus, starOn: shell.star };
}

/**
 * Problems of one scheme's ColorTokens. Each is { rule, message }.
 * rules: palette-hex, palette-contrast, palette-fill, palette-one-ink, palette-shell-constant
 */
export function schemeProblems(scheme, colors, fields, tokens) {
  const problems = [];
  for (const field of fields) {
    if (!isHex(colors[field])) {
      problems.push({ rule: 'palette-hex', message: `${scheme}.${field} is ${colors[field] === undefined ? 'missing' : `"${colors[field]}"`}, expected an uppercase #RRGGBB` });
    }
  }
  if (problems.length > 0) return problems;
  for (const [fg, bg, min] of TEXT_PAIRS) {
    const value = contrast(colors[fg], colors[bg]);
    if (value < min) problems.push({ rule: 'palette-contrast', message: `${scheme}: ${fg} on ${bg} is ${value.toFixed(2)}:1, needs ${min}:1` });
  }
  for (const [fill, base] of FILLS) {
    const best = Math.max(contrast(colors.border, colors[fill]), contrast(colors[fill], colors[base]));
    if (best < 3) problems.push({ rule: 'palette-fill', message: `${scheme}: ${fill} stands only ${best.toFixed(2)}:1 off its edge and off ${base}, needs 3:1 from one of them` });
  }
  if (scheme === 'light') {
    for (const [field, hex] of Object.entries(LIGHT_INK)) {
      if (colors[field] !== hex) problems.push({ rule: 'palette-one-ink', message: `light.${field} is ${colors[field]}, but light Toybox uses one ink: ${hex}` });
    }
  }
  if (tokens) {
    for (const [field, hex] of Object.entries(shellFields(tokens, scheme))) {
      if (colors[field] !== hex) problems.push({ rule: 'palette-shell-constant', message: `${scheme}.${field} is ${colors[field]}, but it is a Shell constant: ${hex}` });
    }
  }
  return problems;
}
