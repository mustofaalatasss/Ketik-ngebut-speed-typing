import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Menyiapkan potongan geometri untuk digabung: non-indeks, hanya posisi + normal,
 * dan (opsional) warna per-vertex. Geometri asli dilepas.
 */
export function part(geometry: THREE.BufferGeometry, color?: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geometry.dispose();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  g.clearGroups();
  if (color !== undefined) {
    const c = new THREE.Color(color);
    const count = g.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return g;
}

/** Menggabung beberapa potongan (hasil `part`) menjadi satu geometri = satu draw call. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('Gagal menggabung geometri');
  return merged;
}

/** Bantuan: geometri yang sudah ditranslasi (dan dirotasi). */
export function placed<T extends THREE.BufferGeometry>(
  geometry: T,
  x: number,
  y: number,
  z: number,
  rotation?: { x?: number; y?: number; z?: number },
): T {
  if (rotation?.x) geometry.rotateX(rotation.x);
  if (rotation?.y) geometry.rotateY(rotation.y);
  if (rotation?.z) geometry.rotateZ(rotation.z);
  geometry.translate(x, y, z);
  return geometry;
}
