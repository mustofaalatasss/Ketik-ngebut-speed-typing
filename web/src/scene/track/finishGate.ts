import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import type { ResourceTracker } from '../resourceTracker';
import { createCheckerTexture } from '../textures/proceduralTextures';

export interface FinishGate {
  readonly group: THREE.Group;
  /** Menaruh gerbang `distanceAhead` unit di depan mobil (negatif = sudah di belakang). */
  setDistance(distanceAhead: number): void;
}

export function createFinishGate(tracker: ResourceTracker): FinishGate {
  const roadWidth = gameConfig.track.roadWidth;
  const group = new THREE.Group();
  const checker = createCheckerTexture(tracker);

  const poleGeo = tracker.track(new THREE.CylinderGeometry(0.18, 0.22, 5, 8));
  const poleMat = tracker.track(new THREE.MeshLambertMaterial({ color: '#e1e4e8' }));
  for (const x of [-roadWidth / 2 - 0.7, roadWidth / 2 + 0.7]) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.5, 0);
    group.add(pole);
  }

  const banner = new THREE.Mesh(
    tracker.track(new THREE.BoxGeometry(roadWidth + 1.8, 1.1, 0.12)),
    tracker.track(new THREE.MeshLambertMaterial({ map: checker })),
  );
  banner.position.set(0, 4.6, 0);
  group.add(banner);

  const line = new THREE.Mesh(
    tracker.track(new THREE.PlaneGeometry(roadWidth, 1.2)),
    tracker.track(new THREE.MeshLambertMaterial({ map: checker })),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.025;
  line.receiveShadow = true;
  group.add(line);

  return {
    group,
    setDistance(distanceAhead) {
      if (!Number.isFinite(distanceAhead)) {
        group.visible = false;
        return;
      }
      group.position.z = -distanceAhead;
      group.visible = distanceAhead > -40 && distanceAhead < 280;
    },
  };
}
