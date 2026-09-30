const FORMAT = new Intl.NumberFormat('fa');

export function scoreText(score: number): string {
  return FORMAT.format(score);
}
