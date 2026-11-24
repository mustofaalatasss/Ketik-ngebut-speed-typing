import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gameConfig } from '../config/gameConfig';
import { FrameStats } from '../core/game/frameStats';
import { finishUnitsPerChar, nextFinishDistance } from '../core/visual/finishGate';
import { QualityController } from '../core/visual/qualityController';
import { easeToward, speedLineIntensity, speedRatio } from '../core/visual/speedFeel';
import { CameraRig } from './camera/cameraRig';
import { createCarModel, WHEEL_RADIUS, type CarModel } from './car/carModel';
import { createParticleEffects, type ParticleEffects } from './effects/particles';
import { createSpeedLines, type SpeedLines } from './effects/speedLines';
import { createLighting, type Lighting } from './environment/lighting';
import { createHills, createSky } from './environment/sky';
import { ResourceTracker } from './resourceTracker';
import type { FrameView, RaceSceneLike, SceneDebugInfo, SceneSetup } from './sceneTypes';
import { createSoftDotTexture } from './textures/proceduralTextures';
import { createFinishGate, type FinishGate } from './track/finishGate';
import { createRoadside, type Roadside } from './track/roadside';
import { createRoadSurface, type RoadSurface } from './track/roadSurface';

/**
 * Adegan Three.js. Mobil diam di z = 0; dunia (tekstur jalan, pohon, tiang, partikel, garis
 * kecepatan) bergeser ke arah kamera sejauh speed × dt setiap frame. Gerbang finis ikut dunia
 * dan dikoreksi halus menuju jarak sesuai progres teks.
 */
export class RaceScene implements RaceSceneLike {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly tracker = new ResourceTracker();
  private readonly rig: CameraRig;
  /** Posisi x lajur pemain (BOT-4: 4 lajur). */
  private readonly playerX: number;
  private readonly opponentCars: { id: string; car: CarModel; ahead: number }[] = [];
  private readonly lighting: Lighting;
  private readonly road: RoadSurface;
  private readonly roadside: Roadside;
  private readonly finish: FinishGate;
  private readonly car: CarModel;
  private readonly speedLines: SpeedLines;
  private readonly particles: ParticleEffects;
  private readonly frameStats = new FrameStats();
  private readonly quality = new QualityController(gameConfig.visual.quality);

  /** Belum diketahui sampai frame pertama (dihitung dari sisa karakter). */
  private finishDistance = Infinity;
  private readonly unitsPerChar = finishUnitsPerChar(gameConfig.speed.speedPerWpm, gameConfig.charsPerWord);
  private timeSec = 0;
  private prevSpeed = 0;
  private accel = 0;
  private lastTypoCount = 0;
  private qualityLevel = -1;
  private width = 1;
  private height = 1;
  private debug: SceneDebugInfo = { drawCalls: 0, triangles: 0, quality: 0 };

  constructor(canvas: HTMLCanvasElement, setup: SceneSetup) {
    const visual = gameConfig.visual;
    const { laneX, playerLane } = gameConfig.bots;
    this.playerX = laneX[playerLane] ?? 0;
    this.rig = new CameraRig(this.playerX);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = visual.toneMappingExposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.fog = new THREE.Fog(visual.sky.horizon, visual.sky.fogNear, visual.sky.fogFar);

    // Peta lingkungan untuk pantulan cat dan kaca, dibuat sekali dari RoomEnvironment (tanpa unduhan).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const envTarget = this.tracker.track(pmrem.fromScene(room, 0.04));
    room.dispose();
    pmrem.dispose();

    const softDot = createSoftDotTexture(this.tracker);
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene.add(createSky(this.tracker), createHills(this.tracker));
    this.lighting = createLighting();
    this.scene.add(this.lighting.group);

    this.road = createRoadSurface(this.tracker, anisotropy);
    this.roadside = createRoadside(this.tracker, softDot);
    this.finish = createFinishGate(this.tracker);
    this.finish.setDistance(this.finishDistance);
    this.scene.add(this.road.group, this.roadside.group, this.finish.group);

    this.car = createCarModel(setup.playerColor, this.tracker, envTarget.texture, softDot);
    this.car.root.position.x = this.playerX;
    this.scene.add(this.car.root);

    // Lawan di lajur lain; tanpa shadow map (cukup bayangan blob) agar ringan.
    const otherLanes = laneX.filter((_, i) => i !== playerLane);
    setup.opponents.forEach((o, i) => {
      const car = createCarModel(o.color, this.tracker, envTarget.texture, softDot, {
        ghost: o.kind === 'ghost',
        castShadow: false,
      });
      car.root.position.x = otherLanes[i % otherLanes.length] ?? 0;
      car.root.visible = false;
      this.scene.add(car.root);
      this.opponentCars.push({ id: o.id, car, ahead: Number.NaN });
    });

    this.speedLines = createSpeedLines(this.tracker, this.rig.viewAxisCenter);
    this.particles = createParticleEffects(this.tracker, softDot);
    this.particles.group.position.x = this.playerX;
    this.scene.add(this.speedLines.mesh, this.particles.group);

    this.applyQuality(0);
  }

  update(view: FrameView): void {
    const { dtSec, speed, remainingChars, shake, penaltyActive, typoCount } = view;
    const visual = gameConfig.visual;
    const ratio = speedRatio(speed, gameConfig.speed.maxSpeed);
    const distance = speed * dtSec;
    this.timeSec += dtSec;

    if (dtSec > 0) {
      this.accel = easeToward(this.accel, (speed - this.prevSpeed) / dtSec, dtSec, 0.15);
    }
    this.prevSpeed = speed;

    // Dunia bergerak.
    this.road.scroll(distance);
    this.roadside.scroll(distance);
    this.finishDistance = nextFinishDistance(
      this.finishDistance,
      distance,
      remainingChars,
      this.unitsPerChar,
      dtSec,
      visual.finish.correctionTau,
    );
    this.finish.setDistance(this.finishDistance);

    // Mobil: roda berputar, bodi mengangguk saat gas/rem, suspensi berayun, getar saat salah ketik.
    const spin = distance / WHEEL_RADIUS;
    for (const w of this.car.wheels) w.rotation.x -= spin;
    const c = visual.car;
    this.car.body.rotation.x = Math.max(-c.pitchMax, Math.min(c.pitchMax, this.accel * c.pitchPerAccel));
    this.car.body.position.y = Math.sin(this.timeSec * 13.7) * c.suspensionBob * ratio;
    this.car.setBrake(penaltyActive ? 1 : this.accel < c.brakeAccelThreshold ? 0.6 : 0);
    const jitter = (): number => (Math.random() * 2 - 1) * shake;
    this.car.root.position.x = this.playerX + jitter();
    this.car.root.rotation.z = jitter() * 0.5;

    this.updateOpponents(view, distance);

    // Efek.
    this.speedLines.update(speedLineIntensity(ratio, visual.speedLines.threshold), distance);
    const burst = Math.max(0, typoCount - this.lastTypoCount);
    this.lastTypoCount = typoCount;
    this.particles.update(dtSec, ratio, distance, speed, burst);

    this.rig.update({ dtSec, timeSec: this.timeSec, ratio, accel: this.accel, shake });

    this.renderer.render(this.scene, this.rig.camera);

    // Kualitas adaptif berdasarkan frame time nyata.
    this.frameStats.push(dtSec * 1000);
    const level = this.quality.update(this.frameStats.fps, dtSec);
    if (level !== this.qualityLevel) this.applyQuality(level);

    const info = this.renderer.info.render;
    this.debug = { drawCalls: info.calls, triangles: info.triangles, quality: this.qualityLevel };
  }

  /**
   * Jarak lawan di depan mobil pemain = jarak gerbang finis − sisa karakter lawan × unit per karakter.
   * Diukur dari gerbang, sehingga lawan yang finis pasti tepat di gerbang (konsisten dengan GAM-1).
   */
  private updateOpponents(view: FrameView, worldDistance: number): void {
    if (!Number.isFinite(this.finishDistance)) return;
    for (const o of this.opponentCars) {
      const frame = view.opponents.find((f) => f.id === o.id);
      if (!frame) continue;
      const ahead = this.finishDistance - frame.remainingChars * this.unitsPerChar;
      // Jarak tempuh lawan di dunia = pergeseran dunia + perubahan jarak relatif -> putaran roda.
      const travelled = Number.isNaN(o.ahead) ? 0 : Math.max(0, worldDistance + (ahead - o.ahead));
      o.ahead = ahead;
      o.car.root.position.z = -ahead;
      o.car.root.visible = ahead > -14 && ahead < gameConfig.visual.sky.fogFar;
      for (const w of o.car.wheels) w.rotation.x -= travelled / WHEEL_RADIUS;
    }
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / height);
  }

  getDebugInfo(): SceneDebugInfo {
    return this.debug;
  }

  dispose(): void {
    this.tracker.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }

  /** 0 = penuh, 1 = tanpa bayangan, 2 = pixel ratio 1, 3 = efek separuh. */
  private applyQuality(level: number): void {
    this.qualityLevel = level;
    this.lighting.setShadows(level < 1);
    const maxRatio = level >= 2 ? 1 : gameConfig.visual.maxPixelRatio;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
    this.renderer.setSize(this.width, this.height, false);
    const density = level >= 3 ? 0.5 : 1;
    this.speedLines.setDensity(density);
    this.particles.setDensity(density);
  }
}
