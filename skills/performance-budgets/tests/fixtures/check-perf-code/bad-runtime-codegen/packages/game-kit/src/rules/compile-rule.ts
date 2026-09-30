export function compileRule(body: string): (x: number) => number {
  return new Function('x', body) as (x: number) => number;
}
