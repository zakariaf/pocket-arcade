// app-text.tsx: stand-in for the module toybox-design-system ships (the checker needs it to exist and to
// offer onLineCount, which NotePanel reads).
export type AppTextProps = { readonly onLineCount?: (lines: number) => void };
