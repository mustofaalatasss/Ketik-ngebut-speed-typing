import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { EmissionAccumulator, ParticlePool } from '../../core/visual/particlePool';
import { dustRate } from '../../core/visual/speedFeel';
import { randomRange } from '../../core/util/random';
import type { ResourceTracker } from '../resourceTracker';

export interface ParticleEffects {
  readonly group: THREE.Group;
  /** ratio = speed / maxSpeed, distance = pergeseran dunia, typoBurst = jumlah salah ketik baru. */
  update(dtSec: number, ratio: number, distance: number, speed: number, typoBurst: number): void;
  setDensity(fraction: number): void;
}

function rgbOf(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Points + pool berkapasitas tetap; hanya [0, count) yang digambar. */
function createPoints(
  tracker: ResourceTracker,
  pool: ParticlePool,
  texture: THREE.Texture,
  size: number,
  blending: THREE.Blending,
): { points: THREE.Points; sync(): void } {
  const geometry = tracker.track(new THREE.BufferGeometry());
  const position = new THREE.BufferAttribute(pool.positions, 3).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.BufferAttribute(pool.colors, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color); // 4 komponen -> alpha per partikel
  geometry.setDrawRange(0, 0);
  const material = tracker.track(
    new THREE.PointsMaterial({
      size,
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending,
      sizeAttenuation: true,
    }),
  );
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    sync() {
      geometry.setDrawRange(0, pool.count);
      position.needsUpdate = true;
      color.needsUpdate = true;
    },
  };
}

/**
 * Debu dari roda belakang (sebanding kecepatan, tertinggal di jalan) dan percikan saat salah ketik.
 */
export function createParticleEffects(tracker: ResourceTracker, softDot: THREE.Texture): ParticleEffects {
  const { dust, sparks } = gameConfig.visual;
  const group = new THREE.Group();
  const random = Math.random;

  const dustPool = new ParticlePool(dust.capacity, rgbOf(dust.color));
  const sparkPool = new ParticlePool(sparks.capacity, rgbOf(sparks.color));
  const dustPoints = createPoints(tracker, dustPool, softDot, dust.size, THREE.NormalBlending);
  const sparkPoints = createPoints(tracker, sparkPool, softDot, sparks.size, THREE.AdditiveBlending);
  group.add(dustPoints.points, sparkPoints.points);

  const emitter = new EmissionAccumulator();
  let density = 1;

  return {
    group,
    update(dtSec, ratio, distance, speed, typoBurst) {
      const n = emitter.take(dustRate(ratio, dust.maxRatePerSec) * density, dtSec);
      for (let i = 0; i < n; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        dustPool.spawn({
          x: side * 0.86 + randomRange(random, -0.2, 0.2),
          y: 0.12,
          z: 1.45 + randomRange(random, 0, 0.3),
          vx: side * randomRange(random, 0.2, 1.2),
          vy: randomRange(random, 0.4, 1.5),
          vz: speed * randomRange(random, 0.05, 0.2),
          life: dust.lifeSec * randomRange(random, 0.6, 1),
        });
      }

      for (let b = 0; b < typoBurst; b++) {
        const count = Math.round(sparks.perTypo * density);
        for (let i = 0; i < count; i++) {
          sparkPool.spawn({
            x: randomRange(random, -0.6, 0.6),
            y: 0.18,
            z: randomRange(random, -1.2, 1.2),
            vx: randomRange(random, -3.5, 3.5),
            vy: randomRange(random, 1.5, 4.5),
            vz: randomRange(random, 0, 3) + speed * 0.1,
            life: sparks.lifeSec * randomRange(random, 0.5, 1),
          });
        }
      }

      dustPool.update(dtSec, distance, -0.6, 1.8); // debu sedikit melayang naik
      sparkPool.update(dtSec, distance, sparks.gravity, 0.5);
      dustPoints.sync();
      sparkPoints.sync();
    },
    setDensity(fraction) {
      density = Math.min(1, Math.max(0, fraction));
    },
  };
}
