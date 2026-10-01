// jest.config.js (fixture stub): the coverage thresholds the wiring check reads.
const LOGIC = { statements: 95, lines: 95, functions: 95, branches: 90 };
module.exports = {
  coverageThreshold: {
    global: { statements: 90, lines: 90, functions: 90, branches: 85 },
    './packages/game-kit/src/': LOGIC,
  },
};
