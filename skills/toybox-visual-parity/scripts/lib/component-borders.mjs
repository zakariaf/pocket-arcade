// Edge widths: the app's component specs (packages/shell/src/ui/component-specs.json, written by the
// toybox-components skill) against what the committed references draw. Chrome renders every CSS
// border of 1 px or more at a whole CSS px (2.5 -> 2, 1.5 -> 1), so each .layout.json style says
// "2px solid ..." where the token file says 2.5; the specs must hold the as-rendered width, or
// every tab, segment and icon tile fails [border] or [structure] on the simulator.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which spec value a reference border belongs to, per map component (and kind, when one component
 * draws several edges). paths: spec paths ("groupTab.border"); a reference width must equal one of
 * their values. null: the element's border is not a component edge (plain Views, placeholders) or
 * transparent (quiet buttons), so it is not compared.
 */
export const COMPONENT_BORDERS = [
  { component: 'Button', kind: /quiet/, paths: null },
  { component: 'Button', kind: /hero/, paths: ['heroKey.border', 'heroKey.capBorder'] },
  { component: 'Button', paths: ['button.border'] },
  { component: 'KeyButton', paths: ['button.border'] },
  { component: 'RowButton', paths: ['button.border'] },
  { component: 'IconButton', paths: ['iconButton.border'] },
  { component: 'Toggle', paths: ['toggle.border'] },
  { component: 'ToggleKey', paths: ['toggleKey.border'] },
  { component: 'SegmentedControl', paths: ['segmentedControl.border'] },
  { component: 'Slider', paths: ['slider.trackBorder'] },
  { component: 'ProgressBar', paths: ['progressBar.border'] },
  { component: 'RadioMark', paths: ['radio.border'] },
  { component: 'OptionCard', paths: ['optionCard.border'] },
  { component: 'ListGroup', paths: ['list.border'] },
  { component: 'ListRow', paths: ['row.separator'] },
  { component: 'StatList', paths: ['statList.separator'] },
  { component: 'GroupTab', paths: ['groupTab.border'] },
  { component: 'IconTile', paths: ['iconTile.border'] },
  { component: 'Panel', paths: ['panel.border'] },
  { component: 'NotePanel', paths: ['panel.border'] },
  { component: 'ScorePanel', paths: ['panel.border'] },
  { component: 'LevelTile', paths: ['levelTile.border', 'levelTile.borderCurrent'] },
  { component: 'AdBannerSlot', paths: ['bannerSlot.borderDashed'] },
  { component: 'DialogCard', paths: ['dialog.border'] },
  { component: 'Sticker', kind: /Today tag/, paths: ['weekStrip.tag.border'] },
  { component: 'Sticker', paths: ['sticker.border'] },
  { component: 'Chip', paths: ['chip.border'] },
  { component: 'ArtTile', paths: ['art.border'] },
  { component: 'PremiumArt', paths: ['premiumArt.border'] },
  { component: 'LogoTile', kind: /splash/, paths: ['logoTile.splash.border'] },
  { component: 'LogoTile', paths: ['logoTile.border'] },
  { component: 'CalendarTile', paths: ['calendarTile.border'] },
  { component: 'WeekStrip', paths: ['weekStrip.markBorder', 'weekStrip.markXsBorder'] },
  { component: 'OfferBox', paths: ['offer.border'] },
  { component: 'HazardStrip', paths: ['hazardStrip.border'] },
  { component: 'HowToStage', paths: ['howToStage.border'] },
  { component: 'PagerDots', paths: ['pagerDots.border'] },
  { component: 'Confetti', paths: ['confetti.border'] },
  { component: 'WeekBars', paths: ['barChart.border'] },
];

/** The rule for one layout element, or undefined when its component has no spec edge. */
export function borderRuleFor(el) {
  return COMPONENT_BORDERS.find((r) => r.component === el.component && (!r.kind || r.kind.test(el.kind ?? '')));
}

/** "2px solid #1D1B3A" -> 2; null for no border or a transparent one ("3px solid null"). */
export function borderWidthOf(border) {
  const m = /^(\d+(?:\.\d+)?)px (solid|dashed|dotted) (#[0-9A-Fa-f]{6})/.exec(String(border ?? ''));
  return m ? Number(m[1]) : null;
}

/** The value at a dotted path of the specs ("weekStrip.tag.border"), or undefined. */
export function specValue(specs, path) {
  return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), specs);
}

/** Every .layout.json under a reference root (<game>/<theme>-<lang>/<frame>.layout.json). */
export function referenceLayouts(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const game of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const combo of readdirSync(join(root, game.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const file of readdirSync(join(root, game.name, combo.name)).filter((f) => f.endsWith('.layout.json')).sort()) {
        out.push({ rel: `${game.name}/${combo.name}/${file}`, layout: JSON.parse(readFileSync(join(root, game.name, combo.name, file), 'utf8')) });
      }
    }
  }
  return out;
}

/**
 * Compares the specs with every reference border. Returns { checked, problems: [{ path, message,
 * fix }] }, one problem per spec path and drawn width that disagree (with the first place drawn).
 */
export function compareComponentBorders(specs, layouts) {
  const seen = new Map();
  let checked = 0;
  for (const { rel, layout } of layouts) {
    for (const el of layout.elements ?? []) {
      const width = borderWidthOf(el.style?.border);
      if (width === null) continue;
      const rule = borderRuleFor(el);
      if (!rule || rule.paths === null) continue;
      checked += 1;
      const values = rule.paths.map((path) => ({ path, value: specValue(specs, path) }));
      if (values.some((v) => v.value === width)) continue;
      const key = `${rule.paths.join('|')}@${width}`;
      if (!seen.has(key)) seen.set(key, { rule, width, values, first: `${el.testID} in ${rel}`, count: 0 });
      seen.get(key).count += 1;
    }
  }
  const problems = [...seen.values()].map(({ rule, width, values, first, count }) => {
    const specText = values.map((v) => `${v.path} = ${v.value === undefined ? 'missing' : v.value}`).join(', ');
    return {
      path: rule.paths[0],
      message: `the references draw ${rule.component} edges ${width} pt wide (${count} time${count === 1 ? '' : 's'}, first ${first}), but component-specs.json has ${specText}`,
      fix: `Set ${rule.paths[0]} to the as-rendered width ${width} (asRenderedBorder: a CSS border of 1 px or more renders floored), by regenerating component-specs.json with the toybox-components skill; never edit the references.`,
    };
  });
  return { checked, problems };
}
