// packages/game-kit/src/testing/render-cells.ts — readable ASCII for data goldens ('#' filled, '.' empty).
export function renderCells(cells: readonly number[], cols: number): string {
  const rows: string[] = [];
  for (let start = 0; start < cells.length; start += cols) {
    rows.push(
      cells
        .slice(start, start + cols)
        .map((cell) => (cell === 0 ? '.' : '#'))
        .join(''),
    );
  }
  return rows.join('\n');
}
