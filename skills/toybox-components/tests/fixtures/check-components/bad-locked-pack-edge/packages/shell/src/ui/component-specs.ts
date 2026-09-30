// packages/shell/src/ui/component-specs.ts
import specs from './component-specs.json' with { type: 'json' };

/**
 * Toybox component measurements in pt as the design references render them (numbers only):
 * write-component-specs.mjs derives component-specs.json from the token file, flooring each CSS
 * border the way Chrome drew the references (2.5 -> 2) and adding the commented mockup overrides
 * (group tab flush, segmented-control gaps). Components take every size, padding, gap, radius,
 * border and elevation from here or from the theme tokens; the JSON is generated, never edited.
 */
export const COMPONENT_SPECS = specs;
