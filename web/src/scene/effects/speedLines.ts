import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { wrapZ } from '../../core/visual/scroll';
import { randomRange, seededRandom } from '../../core/util/random';
import type { ResourceTracker } from '../resourceTracker';

export interface SpeedLines {
  readonly mesh: THREE.InstancedMesh;
  /** `intensity` 0..1 dari speedLineIntensity; `distance` = pergeseran dunia frame ini. */
  update(intensity: number, distance: number): void;
  /** Mengurangi jumlah garis (kualitas rendah). */
  setDensity(fraction: number): void;
}

/**
 * Garis-garis tipis di tepi pandangan yang melesat ke arah kamera saat ngebut.
 * Satu InstancedMesh aditif; disembunyikan sepenuhnya di bawah ambang kecepatan.
 */
export function createSpeedLines(tracker: ResourceTracker, center: THREE.Vector3): SpeedLines {
  const cfg = gameConfig.visual.speedLines;
  const random = seededRandom(99);

  // Bidang tipis panjang 1 unit sepanjang z; panjang sebenarnya diatur lewat skala z.
  const geometry = tracker.track(new THREE.PlaneGeometry(0.035, 1).rotateX(-Math.PI / 2));
  const material = tracker.track(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  const mesh = tracker.track(new THREE.InstancedMesh(geometry, material, cfg.count));
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.visible = false;

  const behind = center.z + 4;
  const span = cfg.depth;
  const angles = new Float32Array(cfg.count);
  const radii = new Float32Array(cfg.count);
  const zs = new Float32Array(cfg.count);
  for (let i = 0; i < cfg.count; i++) {
    // Hindari bagian bawah tengah (jalan di depan mobil) agar tidak menutupi pandangan.
    let a = randomRange(random, 0, Math.PI * 2);
    if (Math.sin(a) < -0.55) a = Math.PI - a;
    angles[i] = a;
    radii[i] = randomRange(random, cfg.innerRadius, cfg.outerRadius);
    zs[i] = behind - random() * span;
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  return {
    mesh,
    update(intensity, distance) {
      if (intensity <= 0) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      material.opacity = cfg.maxOpacity * intensity;
      const length = cfg.minLength + (cfg.maxLength - cfg.minLength) * intensity;
      const shift = distance * cfg.speedMultiplier;
      for (let i = 0; i < cfg.count; i++) {
        const z = wrapZ(zs[i]!, shift, behind, span);
        zs[i] = z;
        const a = angles[i]!;
        // Putar bidang agar normalnya menghadap sumbu pandang (terlihat dari kamera).
        q.setFromAxisAngle(zAxis, a + Math.PI / 2);
        p.set(center.x + Math.cos(a) * radii[i]!, center.y + Math.sin(a) * radii[i]!, z);
        s.set(1, 1, length);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    setDensity(fraction) {
      mesh.count = Math.max(0, Math.round(cfg.count * Math.min(1, fraction)));
    },
  };
}
