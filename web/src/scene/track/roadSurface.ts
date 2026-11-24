import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { scrollTextureOffset } from '../../core/visual/scroll';
import type { ResourceTracker } from '../resourceTracker';
import { createAsphaltTexture, createGrassTexture, createKerbTexture } from '../textures/proceduralTextures';

export interface RoadSurface {
  readonly group: THREE.Group;
  /** Menggeser tekstur jalan, kerb, dan rumput sejauh jarak tempuh frame ini. */
  scroll(distance: number): void;
}

/**
 * Jalan, kerb, dan rumput adalah bidang diam; yang bergerak hanya offset teksturnya.
 * Murah (tanpa memindah geometri) tetapi marka dan kerb terlihat jelas melaju ke arah kamera.
 */
export function createRoadSurface(tracker: ResourceTracker, anisotropy: number): RoadSurface {
  const { road } = gameConfig.visual;
  const roadWidth = gameConfig.track.roadWidth;
  const kerbWidth = 0.7;
  const shoulderWidth = 1.6;
  const length = road.length;
  const centerZ = road.behind - length / 2;
  const group = new THREE.Group();

  const asphalt = createAsphaltTexture(tracker, anisotropy);
  asphalt.repeat.set(1, length / road.textureTileLength);
  const kerb = createKerbTexture(tracker, anisotropy);
  kerb.repeat.set(1, length / road.kerbTileLength);
  const grass = createGrassTexture(tracker, anisotropy);
  const grassWidth = 420;
  grass.repeat.set(grassWidth / road.grassTileLength, length / road.grassTileLength);

  const flat = (width: number, map: THREE.Texture | null, color: string, x: number, y: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(
      tracker.track(new THREE.PlaneGeometry(width, length)),
      tracker.track(new THREE.MeshLambertMaterial({ map, color })),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, centerZ);
    mesh.receiveShadow = true;
    return mesh;
  };

  group.add(flat(grassWidth, grass, '#ffffff', 0, -0.02));
  group.add(flat(roadWidth, asphalt, '#ffffff', 0, 0));

  // Bahu jalan (kerikil) dan kerb di kedua sisi; kerb kiri dan kanan memakai satu geometri gabungan.
  const shoulderMat = tracker.track(new THREE.MeshLambertMaterial({ color: '#8a8373' }));
  const shoulderGeo = tracker.track(new THREE.PlaneGeometry(shoulderWidth, length));
  for (const side of [-1, 1]) {
    const s = new THREE.Mesh(shoulderGeo, shoulderMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(side * (roadWidth / 2 + kerbWidth + shoulderWidth / 2), -0.01, centerZ);
    s.receiveShadow = true;
    group.add(s);
  }
  const kerbMat = tracker.track(new THREE.MeshLambertMaterial({ map: kerb }));
  const kerbGeo = tracker.track(new THREE.PlaneGeometry(kerbWidth, length));
  for (const side of [-1, 1]) {
    const k = new THREE.Mesh(kerbGeo, kerbMat);
    k.rotation.x = -Math.PI / 2;
    k.position.set(side * (roadWidth / 2 + kerbWidth / 2), 0.015, centerZ);
    k.receiveShadow = true;
    group.add(k);
  }

  return {
    group,
    scroll(distance) {
      if (distance === 0) return;
      // Offset tekstur bertambah -> pola bergerak ke +z (ke arah kamera).
      asphalt.offset.y = scrollTextureOffset(asphalt.offset.y, distance, road.textureTileLength);
      kerb.offset.y = scrollTextureOffset(kerb.offset.y, distance, road.kerbTileLength);
      grass.offset.y = scrollTextureOffset(grass.offset.y, distance, road.grassTileLength);
    },
  };
}
