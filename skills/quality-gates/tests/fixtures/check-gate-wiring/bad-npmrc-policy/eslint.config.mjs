// eslint.config.mjs (fixture stub): only the linter options the wiring check reads.
export default [
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
];
