// apps/line-siege/src/rules/line-siege-engine.ts
/** Turn-based: applyMove resolves a placement at once, with no fixed-step phase. */
export const LINE_SIEGE_ENGINE = { panMode: 'drag', selectRegions: ['tray'] } as const;
