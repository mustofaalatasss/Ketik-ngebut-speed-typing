/**
 * Jarak dunia (unit) yang ditempuh mobil per karakter benar pada kecepatan "normal".
 * speed = windowWpm × speedPerWpm, dan windowWpm = karakter/detik × 60 / charsPerWord,
 * sehingga unit per karakter = speedPerWpm × 60 / charsPerWord (4,8 dengan konfigurasi awal).
 */
export function finishUnitsPerChar(speedPerWpm: number, charsPerWord: number): number {
  return charsPerWord <= 0 ? 0 : (speedPerWpm * 60) / charsPerWord;
}

/**
 * Posisi gerbang finis (jarak di depan mobil) frame berikutnya.
 *
 * Target = sisa karakter × unit per karakter: skala yang sama dengan laju jalan, sehingga bila
 * mobil melaju sesuai ketikan, gerbang bergerak persis bersama jalan.
 * - Mobil lebih lambat dari perkiraan (batas kecepatan, penalti): gerbang ikut jalan lalu
 *   didekatkan halus ke target.
 * - Mobil lebih cepat dari perkiraan: gerbang menunggu di target (tidak dilewati sebelum teks selesai).
 * - Selama balapan jarak tidak pernah bertambah: gerbang tidak pernah terlihat mundur.
 * - Setelah teks selesai dan gerbang tercapai, gerbang hanya ikut jalan dan lewat ke belakang mobil.
 */
export function nextFinishDistance(
  current: number,
  worldDistance: number,
  remainingChars: number,
  unitsPerChar: number,
  dtSec: number,
  correctionTau: number,
): number {
  const target = Math.max(0, remainingChars * unitsPerChar);
  if (!Number.isFinite(current)) return target; // frame pertama

  const finished = remainingChars <= 0;
  const moved = current - Math.max(0, worldDistance);
  if (finished && current <= 0) return moved;

  let next: number;
  if (moved <= target) {
    next = Math.min(current, target);
  } else {
    const k = dtSec <= 0 ? 0 : correctionTau <= 0 ? 1 : 1 - Math.exp(-dtSec / correctionTau);
    next = moved + (target - moved) * k;
  }

  if (finished && next < 0.05) return 0;
  return next;
}
