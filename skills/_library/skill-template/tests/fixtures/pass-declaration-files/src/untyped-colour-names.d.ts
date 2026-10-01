// Ambient declarations for a module without types; a .d.ts file is not a module rule target.
declare module 'untyped-colour-names' {
  const names: readonly string[];
  export default names;
}
