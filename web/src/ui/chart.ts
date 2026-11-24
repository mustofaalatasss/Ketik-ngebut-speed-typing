export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Memetakan deret nilai ke koordinat SVG (0..width, 0..height; y terbalik karena SVG ke bawah).
 * Skala y mulai dari 0 sampai nilai maksimum (minimal 1 agar tidak membagi dengan nol).
 */
export function chartPoints(values: readonly number[], width: number, height: number, padding = 0): ChartPoint[] {
  if (values.length === 0) return [];
  const max = Math.max(1, ...values);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: padding + (values.length > 1 ? i * step : innerW / 2),
    y: padding + innerH - (Math.max(0, v) / max) * innerH,
  }));
}

export function toPolyline(points: readonly ChartPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
