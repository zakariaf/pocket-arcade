const FORMAT = new Intl.DateTimeFormat('de', { hour: 'numeric' });

export function clockText(ms: number): string {
  return FORMAT.format(ms);
}
