// packages/shell/src/app-env.d.ts
// Expo inlines EXPO_PUBLIC_* only when read with dot access, so each one is declared here.
// App programs load neither @types/node nor expo-env.d.ts, so `process` is declared too.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_APP_VARIANT?: 'test' | 'store';
  }
}
declare const process: { readonly env: NodeJS.ProcessEnv };
