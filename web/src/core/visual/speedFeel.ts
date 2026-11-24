/**
 * Pemetaan kecepatan -> efek visual. Murni (tanpa Three.js) agar bisa dites.
 * Semua fungsi menerima rasio kecepatan 0..1 (speed / maxSpeed).
 */

export function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

export function speedRatio(speed: number, maxSpeed: number): number {
  return maxSpeed <= 0 ? 0 : clamp01(speed / maxSpeed);
}

/** FOV target: naik monoton dari `base` ke `max`; `curve` > 1 menahan perubahan di kecepatan rendah. */
export function targetFov(ratio: number, base: number, max: number, curve: number): number {
  return base + (max - base) * Math.pow(clamp01(ratio), curve);
}

/** Intensitas garis kecepatan 0..1: nol di bawah ambang, lalu naik linear sampai 1 di kecepatan maksimum. */
export function speedLineIntensity(ratio: number, threshold: number): number {
  const r = clamp01(ratio);
  if (r <= threshold || threshold >= 1) return 0;
  return (r - threshold) / (1 - threshold);
}

/** Laju partikel debu per detik, sebanding kecepatan. */
export function dustRate(ratio: number, maxRatePerSec: number): number {
  return maxRatePerSec * clamp01(ratio);
}

/** Easing eksponensial yang tidak bergantung frame rate. */
export function easeToward(current: number, target: number, dtSec: number, tau: number): number {
  if (dtSec <= 0) return current;
  if (tau <= 0) return target;
  return current + (target - current) * (1 - Math.exp(-dtSec / tau));
}

/**
 * Goyangan kamera halus: jumlah beberapa gelombang sinus (pseudo-noise) dengan amplitudo
 * sebanding kecepatan. Deterministik terhadap waktu.
 */
export function cameraSway(
  timeSec: number,
  ratio: number,
  amplitude: number,
  frequency: number,
): { x: number; y: number } {
  const a = amplitude * clamp01(ratio);
  if (a === 0) return { x: 0, y: 0 };
  const w = 2 * Math.PI * frequency;
  return {
    x: a * (0.6 * Math.sin(w * timeSec) + 0.4 * Math.sin(w * 2.31 * timeSec + 1.7)),
    y: a * 0.5 * (0.7 * Math.sin(w * 1.63 * timeSec + 0.4) + 0.3 * Math.sin(w * 3.7 * timeSec)),
  };
}
