import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { cameraSway, easeToward, targetFov } from '../../core/visual/speedFeel';

export interface CameraRigInput {
  readonly dtSec: number;
  readonly timeSec: number;
  /** speed / maxSpeed */
  readonly ratio: number;
  /** Akselerasi yang sudah diperhalus (unit/s^2). */
  readonly accel: number;
  /** Amplitudo getar salah ketik. */
  readonly shake: number;
}

/**
 * Kamera di belakang mobil: FOV melebar dan kamera mundur saat ngebut, tertinggal sedikit saat
 * akselerasi (pegas), goyangan halus sebanding kecepatan, dan getar acak saat salah ketik.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly base: THREE.Vector3;
  private readonly lookAt: THREE.Vector3;
  private followZ = 0;

  /** `followX` = posisi x lajur mobil pemain; kamera selalu di belakangnya. */
  constructor(followX = 0) {
    const cfg = gameConfig.visual;
    this.camera = new THREE.PerspectiveCamera(cfg.fov.base, 1, 0.1, 700);
    this.base = new THREE.Vector3(...cfg.camera.offset);
    this.lookAt = new THREE.Vector3(...cfg.camera.lookAt);
    this.base.x += followX;
    this.lookAt.x += followX;
    this.camera.position.copy(this.base);
    this.camera.lookAt(this.lookAt);
  }

  /** Titik tengah garis kecepatan: sumbu pandang kamera. */
  get viewAxisCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.base.x, this.base.y - 0.6, 0);
  }

  update(input: CameraRigInput): void {
    const { camera: c, fov } = gameConfig.visual;
    const { dtSec, timeSec, ratio, accel, shake } = input;

    const lag = Math.max(-c.accelLagMax, Math.min(c.accelLagMax, accel * c.accelLag));
    this.followZ = easeToward(this.followZ, ratio * c.pullBack + lag, dtSec, c.followTau);

    const sway = cameraSway(timeSec, ratio, c.swayAmplitude, c.swayFrequency);
    const bob = Math.sin(timeSec * c.bobFrequency * 2 * Math.PI) * c.bobAmplitude * ratio;
    const jitter = (): number => (Math.random() * 2 - 1) * shake;

    this.camera.position.set(
      this.base.x + sway.x + jitter() * 2,
      this.base.y + sway.y + bob + jitter(),
      this.base.z + this.followZ,
    );
    this.camera.lookAt(this.lookAt.x + sway.x * 0.5, this.lookAt.y, this.lookAt.z);
    this.camera.rotateZ(sway.x * 0.25); // sedikit miring mengikuti goyangan

    const nextFov = easeToward(this.camera.fov, targetFov(ratio, fov.base, fov.max, fov.curve), dtSec, fov.easeTau);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
