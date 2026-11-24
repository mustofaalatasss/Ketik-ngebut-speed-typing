import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { mergeParts, part, placed } from '../geometryUtils';
import type { ResourceTracker } from '../resourceTracker';

export const WHEEL_RADIUS = 0.36;

export interface CarModel {
  /** Akar mobil (diam di z = 0); roda menempel di sini. */
  readonly root: THREE.Group;
  /** Bodi yang bisa mengangguk (pitch) dan berayun terpisah dari roda. */
  readonly body: THREE.Group;
  readonly wheels: readonly THREE.Group[];
  /** 0 = lampu belakang biasa, 1 = rem penuh. */
  setBrake(amount: number): void;
}

const BEVEL = 0.07;

/** Profil samping bodi bawah (sumbu X = panjang mobil, depan = +X; Y = tinggi), dengan lengkung roda. */
function lowerBodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(2.12, 0.32);
  s.lineTo(1.78, 0.32);
  s.absarc(1.3, 0.32, 0.48, 0, Math.PI, false); // lengkung roda depan
  s.lineTo(-0.82, 0.32);
  s.absarc(-1.3, 0.32, 0.48, 0, Math.PI, false); // lengkung roda belakang
  s.lineTo(-2.08, 0.32);
  s.lineTo(-2.14, 0.62);
  s.lineTo(-2.1, 0.82);
  s.lineTo(-1.05, 0.9);
  s.lineTo(1.05, 0.86);
  s.lineTo(1.95, 0.66);
  s.lineTo(2.2, 0.5);
  s.lineTo(2.12, 0.32);
  return s;
}

/** Profil kabin (kaca). */
function cabinShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.02, 0.86);
  s.lineTo(-0.6, 1.3);
  s.lineTo(0.38, 1.32);
  s.lineTo(1.08, 0.86);
  s.lineTo(-1.02, 0.86);
  return s;
}

/** Ekstrusi profil menjadi bodi selebar `width`, diputar agar depan menghadap -z dan berpusat di x = 0. */
function extrudeProfile(shape: THREE.Shape, width: number, bevel: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.rotateY(Math.PI / 2); // X profil -> -z dunia (depan), kedalaman ekstrusi -> +x
  g.translate(-(width - bevel * 2) / 2, 0, 0);
  return g;
}

function standard(
  tracker: ResourceTracker,
  params: THREE.MeshStandardMaterialParameters,
): THREE.MeshStandardMaterial {
  return tracker.track(new THREE.MeshStandardMaterial(params));
}

/**
 * Mobil low-poly yang lebih detail: bodi berbevel dengan lengkung roda, kabin kaca, atap, pilar,
 * spion, spoiler, lampu depan/belakang (emissive), knalpot, dan velg berjari-jari.
 * Bagian dengan material sama digabung sehingga mobil hanya sekitar 15 draw call.
 */
export interface CarModelOptions {
  /** BOT-3: mobil bayangan (transparan, tanpa bayangan). */
  readonly ghost?: boolean;
  /** Ikut shadow map; hanya mobil pemain agar ringan. */
  readonly castShadow?: boolean;
}

export function createCarModel(
  color: string,
  tracker: ResourceTracker,
  envMap: THREE.Texture | null,
  softDot: THREE.Texture,
  options: CarModelOptions = {},
): CarModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = standard(tracker, { color, metalness: 0.25, roughness: 0.38, envMap, envMapIntensity: 0.4 });
  const glass = standard(tracker, { color: '#0d1620', metalness: 0.2, roughness: 0.06, envMap, envMapIntensity: 1.5 });
  const trim = standard(tracker, { color: '#1b1e23', metalness: 0.2, roughness: 0.7 });
  const chrome = standard(tracker, { color: '#d4d9df', metalness: 0.95, roughness: 0.22, envMap, envMapIntensity: 1.2 });
  const tyre = standard(tracker, { color: '#131313', roughness: 0.95 });
  const headLight = standard(tracker, { color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 2.2 });
  const tailLight = standard(tracker, {
    color: '#5a0000',
    emissive: '#ff1a1a',
    emissiveIntensity: gameConfig.visual.car.tailLightIntensity,
  });

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, castShadow = true): THREE.Mesh => {
    const mesh = new THREE.Mesh(tracker.track(geometry), material);
    mesh.castShadow = castShadow;
    body.add(mesh);
    return mesh;
  };

  // Bodi + atap + pilar + spion + sayap spoiler: satu geometri cat.
  add(
    mergeParts([
      part(extrudeProfile(lowerBodyShape(), 1.86, BEVEL)),
      part(placed(new THREE.BoxGeometry(1.48, 0.07, 1.02), 0, 1.355, 0.08)),
      part(placed(new THREE.BoxGeometry(1.5, 0.42, 0.12), 0, 1.1, 0.12)),
      part(placed(new THREE.BoxGeometry(0.24, 0.12, 0.12), -0.98, 0.98, -0.78)),
      part(placed(new THREE.BoxGeometry(0.24, 0.12, 0.12), 0.98, 0.98, -0.78)),
      part(placed(new THREE.BoxGeometry(1.8, 0.06, 0.4), 0, 1.08, 1.86, { x: -0.08 })),
    ]),
    paint,
  );

  add(part(extrudeProfile(cabinShape(), 1.52, 0.05)), glass);

  // Bagian gelap: gril, bumper, diffuser, rok samping, kolong, penyangga spoiler.
  add(
    mergeParts([
      part(placed(new THREE.BoxGeometry(1.2, 0.16, 0.1), 0, 0.42, -2.25)),
      part(placed(new THREE.BoxGeometry(1.7, 0.1, 0.16), 0, 0.3, -2.18)),
      part(placed(new THREE.BoxGeometry(1.55, 0.16, 0.12), 0, 0.36, 2.2)),
      part(placed(new THREE.BoxGeometry(0.06, 0.1, 2.0), -0.94, 0.3, 0)),
      part(placed(new THREE.BoxGeometry(0.06, 0.1, 2.0), 0.94, 0.3, 0)),
      part(placed(new THREE.BoxGeometry(1.6, 0.08, 3.9), 0, 0.27, 0)),
      part(placed(new THREE.BoxGeometry(0.06, 0.22, 0.1), -0.55, 0.95, 1.86)),
      part(placed(new THREE.BoxGeometry(0.06, 0.22, 0.1), 0.55, 0.95, 1.86)),
    ]),
    trim,
  );

  // Knalpot ganda.
  add(
    mergeParts(
      [-0.45, 0.45].map((x) =>
        part(placed(new THREE.CylinderGeometry(0.065, 0.065, 0.22, 10), x, 0.3, 2.22, { x: Math.PI / 2 })),
      ),
    ),
    chrome,
    false,
  );

  // Lampu depan (miring mengikuti hidung) dan lampu belakang.
  add(
    mergeParts(
      [-0.6, 0.6].map((x) => part(placed(new THREE.BoxGeometry(0.44, 0.1, 0.22), x, 0.6, -2.08, { x: 0.45 }))),
    ),
    headLight,
    false,
  );
  add(
    mergeParts([-0.58, 0.58].map((x) => part(placed(new THREE.BoxGeometry(0.5, 0.13, 0.06), x, 0.7, 2.17)))),
    tailLight,
    false,
  );

  // Cahaya lampu belakang (sprite aditif) yang membesar saat rem.
  const glowMat = tracker.track(
    new THREE.SpriteMaterial({
      map: softDot,
      color: '#ff3020',
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.35,
    }),
  );
  const glows = [-0.58, 0.58].map((x) => {
    const sprite = new THREE.Sprite(glowMat);
    sprite.position.set(x, 0.7, 2.3);
    sprite.scale.setScalar(0.7);
    body.add(sprite);
    return sprite;
  });

  // Roda: ban + velg berjari-jari (berputar di grupnya sendiri).
  const tyreGeo = tracker.track(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.27, 22).rotateZ(Math.PI / 2));
  const rimGeo = tracker.track(
    mergeParts([
      part(new THREE.CylinderGeometry(0.235, 0.235, 0.28, 16).rotateZ(Math.PI / 2)),
      ...[0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => part(new THREE.BoxGeometry(0.29, 0.44, 0.06).rotateX(a))),
      part(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8).rotateZ(Math.PI / 2)),
    ]),
  );
  const rimMat = standard(tracker, { color: '#9aa2ab', metalness: 0.85, roughness: 0.3, envMap, envMapIntensity: 1 });
  const wheels: THREE.Group[] = [];
  for (const [x, z] of [
    [-0.86, -1.3],
    [0.86, -1.3],
    [-0.86, 1.3],
    [0.86, 1.3],
  ] as const) {
    const wheel = new THREE.Group();
    const t = new THREE.Mesh(tyreGeo, tyre);
    t.castShadow = true;
    wheel.add(t, new THREE.Mesh(rimGeo, rimMat));
    wheel.position.set(x, WHEEL_RADIUS, z);
    root.add(wheel);
    wheels.push(wheel);
  }

  // Bayangan blob lembut di bawah mobil (tetap ada saat shadow map dimatikan).
  const blob = new THREE.Mesh(
    tracker.track(new THREE.PlaneGeometry(2.6, 5.2).rotateX(-Math.PI / 2)),
    tracker.track(
      new THREE.MeshBasicMaterial({ map: softDot, color: '#000000', transparent: true, opacity: 0.55, depthWrite: false }),
    ),
  );
  blob.position.y = 0.03;
  root.add(blob);

  const castShadow = options.castShadow ?? true;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!castShadow) obj.castShadow = false;
    if (options.ghost && obj !== blob) {
      // Material mobil ini milik mobil ini saja, jadi aman diubah langsung.
      const m = obj.material as THREE.Material;
      m.transparent = true;
      m.opacity = gameConfig.bots.ghostOpacity;
      m.depthWrite = false;
    }
  });
  if (options.ghost) blob.visible = false;

  const { tailLightIntensity, brakeLightIntensity } = gameConfig.visual.car;
  return {
    root,
    body,
    wheels,
    setBrake(amount) {
      const a = Math.min(1, Math.max(0, amount));
      tailLight.emissiveIntensity = tailLightIntensity + (brakeLightIntensity - tailLightIntensity) * a;
      glowMat.opacity = 0.35 + 0.55 * a;
      for (const g of glows) g.scale.setScalar(0.7 + 0.6 * a);
    },
  };
}
