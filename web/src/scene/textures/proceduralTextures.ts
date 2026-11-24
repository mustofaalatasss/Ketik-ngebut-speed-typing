import * as THREE from 'three';
import { seededRandom } from '../../core/util/random';
import type { ResourceTracker } from '../resourceTracker';

/**
 * Tekstur dibuat dengan canvas 2D saat game dimuat: tidak ada berkas gambar yang diunduh.
 */
function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function toTexture(
  canvas: HTMLCanvasElement,
  tracker: ResourceTracker,
  options: { repeat?: boolean; anisotropy?: number; srgb?: boolean } = {},
): THREE.CanvasTexture {
  const tex = tracker.track(new THREE.CanvasTexture(canvas));
  if (options.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (options.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = options.anisotropy ?? 1;
  return tex;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  colors: readonly string[],
  seed: number,
  maxSize = 2,
): void {
  const random = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(random() * colors.length)]!;
    const s = 1 + random() * maxSize;
    ctx.fillRect(random() * w, random() * h, s, s);
  }
}

/**
 * Aspal satu ulangan: bintik-bintik, garis tepi putih, satu marka tengah putus-putus.
 * Sumbu v (tinggi canvas) = arah jalan.
 */
export function createAsphaltTexture(tracker: ResourceTracker, anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = '#3d4147';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 2600, ['#33363b', '#474b52', '#2c2f33', '#52565d'], 11);
    // Bekas ban: dua jalur lebih gelap di tiap lajur (4 lajur, BOT-4).
    ctx.fillStyle = 'rgba(20,20,22,0.16)';
    for (let lane = 0; lane < 4; lane++) {
      const left = (lane / 4) * w;
      ctx.fillRect(left + w * 0.05, 0, w * 0.04, h);
      ctx.fillRect(left + w * 0.16, 0, w * 0.04, h);
    }
    // Garis tepi.
    ctx.fillStyle = '#e9e9e4';
    ctx.fillRect(w * 0.015, 0, w * 0.018, h);
    ctx.fillRect(w * 0.967, 0, w * 0.018, h);
    // Marka lajur putus-putus di 25%, 50%, 75%: setengah ulangan bercat.
    ctx.fillStyle = '#f2f2ec';
    for (const x of [0.25, 0.5, 0.75]) ctx.fillRect(w * x - w * 0.009, h * 0.1, w * 0.018, h * 0.45);
  }
  return toTexture(canvas, tracker, { repeat: true, anisotropy });
}

/** Kerb merah-putih di bahu jalan: pola paling kuat memberi kesan laju. */
export function createKerbTexture(tracker: ResourceTracker, anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(32, 64);
  if (ctx) {
    ctx.fillStyle = '#d7262b';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 32, 32, 32);
  }
  return toTexture(canvas, tracker, { repeat: true, anisotropy });
}

/** Rumput dengan pola potongan melintang (bergaris) agar gerakan terlihat. */
export function createGrassTexture(tracker: ResourceTracker, anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const [canvas, ctx] = makeCanvas(w, h);
  if (ctx) {
    ctx.fillStyle = '#4f8f3b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5a9c44';
    ctx.fillRect(0, 0, w, h / 2);
    speckle(ctx, w, h, 3200, ['#447f33', '#64a84c', '#3d7330', '#6fb356'], 23, 3);
  }
  return toTexture(canvas, tracker, { repeat: true, anisotropy });
}

/** Titik lembut (gradasi radial) untuk partikel, cahaya lampu, dan bayangan blob. */
export function createSoftDotTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return toTexture(canvas, tracker, { srgb: false });
}

/** Spanduk kotak-kotak untuk gerbang finis. */
export function createCheckerTexture(tracker: ResourceTracker): THREE.CanvasTexture {
  const size = 32;
  const [canvas, ctx] = makeCanvas(size * 10, size * 2);
  if (ctx) {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 10; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }
  const tex = toTexture(canvas, tracker);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
