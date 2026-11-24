import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import type { ResourceTracker } from '../resourceTracker';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // selalu di bidang jauh
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform vec3 sunDir;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = h > 0.0
      ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(horizonColor, bottomColor, clamp(-h * 6.0, 0.0, 1.0));
    float sun = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
    col += vec3(1.0, 0.92, 0.75) * (pow(sun, 600.0) * 1.6 + pow(sun, 12.0) * 0.22);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Kubah langit bergradasi + matahari (satu draw call, tanpa tekstur). */
export function createSky(tracker: ResourceTracker): THREE.Mesh {
  const { top, horizon, bottom, sunDirection } = gameConfig.visual.sky;
  const material = tracker.track(
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color(top) },
        horizonColor: { value: new THREE.Color(horizon) },
        bottomColor: { value: new THREE.Color(bottom) },
        sunDir: { value: new THREE.Vector3(...sunDirection).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  const sky = new THREE.Mesh(tracker.track(new THREE.SphereGeometry(500, 32, 16)), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}

/**
 * Siluet bukit di kejauhan: diam (tidak ikut bergeser) sebagai pembanding kedalaman.
 * Satu geometri gabungan, warna sudah dicampur dengan kabut.
 */
export function createHills(tracker: ResourceTracker): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const hills: readonly [number, number, number, number][] = [
    // x, z, jari-jari, tinggi
    [-260, -330, 120, 55],
    [-90, -380, 140, 75],
    [80, -360, 110, 50],
    [230, -320, 130, 65],
    [-330, -160, 100, 45],
    [330, -170, 110, 50],
  ];
  for (const [x, z, r, h] of hills) {
    const g = new THREE.ConeGeometry(r, h, 9, 1, true);
    g.translate(x, h / 2 - 2, z);
    parts.push(g);
  }
  const geometry = tracker.track(mergeSimple(parts));
  parts.forEach((p) => p.dispose());
  const material = tracker.track(
    new THREE.MeshBasicMaterial({ color: '#8fb3a8', fog: false, side: THREE.DoubleSide }),
  );
  return new THREE.Mesh(geometry, material);
}

/** Menggabung geometri non-indeks maupun berindeks menjadi satu (posisi saja). */
function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const part of parts) {
    const g = part.index ? part.toNonIndexed() : part;
    const attr = g.getAttribute('position');
    for (let i = 0; i < attr.count; i++) positions.push(attr.getX(i), attr.getY(i), attr.getZ(i));
    if (g !== part) g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return merged;
}
