// packages/shell/src/screens/home/home-music.ts
export function makeContext(Ctor: new () => object): object {
  return new AudioContext();
}
