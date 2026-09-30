// Minimal stand-in for 'react' when check-ad-behaviour.mjs runs the ads adapter under Node:
// createElement returns a plain { type, props } record the checker can inspect. Not an entry point.

export function createElement(type, props) {
  return { type, props };
}

export default { createElement };
