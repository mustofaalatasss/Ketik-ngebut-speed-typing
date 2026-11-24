import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { createRoadsideLayout, type RoadsideItem, type RoadsideKind } from '../../core/visual/roadsideLayout';
import { wrapZ } from '../../core/visual/scroll';
import { mergeParts, part, placed } from '../geometryUtils';
import type { ResourceTracker } from '../resourceTracker';

export interface Roadside {
  readonly group: THREE.Group;
  scroll(distance: number): void;
}

function pineGeometry(): THREE.BufferGeometry {
  return mergeParts([
    part(placed(new THREE.CylinderGeometry(0.13, 0.2, 1.4, 6), 0, 0.7, 0), '#6b4a2f'),
    part(placed(new THREE.ConeGeometry(1.25, 2.3, 7), 0, 2.1, 0), '#2f6b35'),
    part(placed(new THREE.ConeGeometry(0.95, 1.9, 7), 0, 3.1, 0), '#367a3c'),
    part(placed(new THREE.ConeGeometry(0.6, 1.5, 7), 0, 4.0, 0), '#3f8744'),
  ]);
}

function roundTreeGeometry(): THREE.BufferGeometry {
  return mergeParts([
    part(placed(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 6), 0, 0.9, 0), '#715036'),
    part(placed(new THREE.IcosahedronGeometry(1.45, 0), 0, 2.7, 0), '#4f9a3e'),
    part(placed(new THREE.IcosahedronGeometry(0.95, 0), 0.7, 3.3, 0.3), '#5dab48'),
  ]);
}

function lampGeometry(): THREE.BufferGeometry {
  return mergeParts([
    part(placed(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 6), 0, 2.6, 0), '#7d838c'),
    part(placed(new THREE.BoxGeometry(1.7, 0.08, 0.08), 0.85, 5.15, 0), '#7d838c'),
    part(placed(new THREE.BoxGeometry(0.55, 0.12, 0.28), 1.6, 5.08, 0), '#5b6068'),
    part(placed(new THREE.BoxGeometry(0.45, 0.04, 0.2), 1.6, 5.0, 0), '#fff6c8'),
  ]);
}

function markerGeometry(): THREE.BufferGeometry {
  return mergeParts([
    part(placed(new THREE.BoxGeometry(0.28, 0.9, 0.14), 0, 0.45, 0), '#f1f1ec'),
    part(placed(new THREE.BoxGeometry(0.29, 0.22, 0.15), 0, 0.82, 0), '#d7262b'),
  ]);
}

function railPostGeometry(): THREE.BufferGeometry {
  return part(placed(new THREE.BoxGeometry(0.12, 0.75, 0.12), 0, 0.375, 0), '#9aa1a9');
}

const geometryFor: Record<RoadsideKind, () => THREE.BufferGeometry> = {
  pine: pineGeometry,
  roundTree: roundTreeGeometry,
  lamp: lampGeometry,
  marker: markerGeometry,
  railPost: railPostGeometry,
};

/** Satu InstancedMesh per jenis objek. Hanya komponen z matriks yang diubah tiap frame. */
class InstancedStrip {
  readonly mesh: THREE.InstancedMesh;
  private readonly zs: Float32Array;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    items: readonly RoadsideItem[],
    private readonly behind: number,
    private readonly span: number,
    tilt = 0,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, items.length);
    this.mesh.frustumCulled = false; // posisi instance berubah; bounding sphere tidak relevan
    this.zs = new Float32Array(items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    items.forEach((item, i) => {
      euler.set(tilt, item.rotationY, 0);
      q.setFromEuler(euler);
      s.setScalar(item.scale);
      p.set(item.x, 0, item.z);
      this.mesh.setMatrixAt(i, m.compose(p, q, s));
      this.zs[i] = item.z;
    });
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  scroll(distance: number): void {
    const array = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.zs.length; i++) {
      const z = wrapZ(this.zs[i]!, distance, this.behind, this.span);
      this.zs[i] = z;
      array[i * 16 + 14] = z; // elemen translasi z pada matriks 4x4 (kolom-mayor)
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Pohon, tiang lampu, patok kilometer, dan tiang pagar pengaman yang lewat dengan cepat.
 * Semua objek didaur ulang (wrapZ) sehingga jumlahnya tetap dan tidak ada alokasi saat balapan.
 */
export function createRoadside(tracker: ResourceTracker, softDot: THREE.Texture): Roadside {
  const cfg = gameConfig.visual.roadside;
  const roadWidth = gameConfig.track.roadWidth;
  const items = createRoadsideLayout({ ...cfg, roadWidth });
  const group = new THREE.Group();
  const strips: InstancedStrip[] = [];

  const material = tracker.track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  for (const kind of Object.keys(geometryFor) as RoadsideKind[]) {
    const ofKind = items.filter((i) => i.kind === kind);
    if (ofKind.length === 0) continue;
    const strip = new InstancedStrip(tracker.track(geometryFor[kind]()), material, ofKind, cfg.behind, cfg.span);
    tracker.track(strip.mesh);
    strips.push(strip);
    group.add(strip.mesh);
  }

  // Bayangan blob di bawah pohon (bidang transparan; jauh lebih murah daripada shadow map).
  const trees = items.filter((i) => i.kind === 'pine' || i.kind === 'roundTree');
  const blobGeo = tracker.track(new THREE.PlaneGeometry(3.2, 3.2));
  blobGeo.rotateX(-Math.PI / 2);
  blobGeo.translate(0, 0.03, 0);
  const blobMat = tracker.track(
    new THREE.MeshBasicMaterial({ map: softDot, color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  );
  const blobs = new InstancedStrip(blobGeo, blobMat, trees, cfg.behind, cfg.span);
  tracker.track(blobs.mesh);
  strips.push(blobs);
  group.add(blobs.mesh);

  // Rel pagar pengaman: dua balok panjang diam (polanya seragam, gerak terlihat dari tiangnya).
  const railLength = cfg.span;
  const railZ = cfg.behind - railLength / 2;
  const railGeo = tracker.track(
    mergeParts(
      [-1, 1].flatMap((side) => [
        part(placed(new THREE.BoxGeometry(0.06, 0.22, railLength), side * (roadWidth / 2 + 1.0), 0.6, railZ), '#c3c8ce'),
      ]),
    ),
  );
  group.add(new THREE.Mesh(railGeo, material));

  return {
    group,
    scroll(distance) {
      if (distance === 0) return;
      for (const s of strips) s.scroll(distance);
    },
  };
}
