/**
 * Matematika "dunia bergerak": mobil diam di z = 0 menghadap -z, dunia bergeser ke +z.
 */

/** Offset tekstur baru setelah dunia bergeser `distance` unit. Disimpan modulo 1 agar presisi tetap. */
export function scrollTextureOffset(offset: number, distance: number, tileLength: number): number {
  if (tileLength <= 0) return offset;
  const next = (offset + distance / tileLength) % 1;
  return next < 0 ? next + 1 : next;
}

/**
 * Menggeser posisi z objek sejauh `distance`. Objek yang lewat ke belakang kamera (z > behind)
 * dipindah ke depan sejauh `span`, sehingga selalu berada di rentang [behind - span, behind].
 */
export function wrapZ(z: number, distance: number, behind: number, span: number): number {
  let next = z + distance;
  if (span <= 0) return next;
  if (next > behind) next -= span * Math.ceil((next - behind) / span);
  return next;
}
