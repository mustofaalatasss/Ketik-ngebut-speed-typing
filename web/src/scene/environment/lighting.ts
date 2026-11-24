import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';

export interface Lighting {
  readonly group: THREE.Group;
  readonly sun: THREE.DirectionalLight;
  setShadows(enabled: boolean): void;
}

/**
 * Cahaya langit (hemisphere) + matahari dengan bayangan lembut.
 * Kamera bayangan dibuat sempit di sekitar mobil saja agar shadow map 1024 cukup tajam dan murah.
 */
export function createLighting(): Lighting {
  const { light, sky } = gameConfig.visual;
  const group = new THREE.Group();

  group.add(new THREE.HemisphereLight(sky.horizon, '#5b7d43', light.hemisphereIntensity));

  const sun = new THREE.DirectionalLight('#fff3de', light.sunIntensity);
  // Matahari di depan-kiri atas: bayangan mobil jatuh ke belakang-kanan, terlihat dari kamera.
  sun.position.set(-6, 14, -9);
  sun.target.position.set(0, 0, 0.5);
  const cam = sun.shadow.camera;
  cam.left = -light.shadowExtent;
  cam.right = light.shadowExtent;
  cam.top = light.shadowExtent;
  cam.bottom = -light.shadowExtent;
  cam.near = 2;
  cam.far = 40;
  sun.shadow.mapSize.set(light.shadowMapSize, light.shadowMapSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.castShadow = true;
  group.add(sun, sun.target);

  return {
    group,
    sun,
    setShadows(enabled) {
      sun.castShadow = enabled;
    },
  };
}
