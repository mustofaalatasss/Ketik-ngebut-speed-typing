import { gameConfig } from '../../config/gameConfig';

export interface CarPhysicsConfig {
  readonly maxSpeed: number;
  readonly speedPerWpm: number;
  readonly accelTau: number;
  readonly decelTau: number;
  readonly idleStopMs: number;
  readonly stopEpsilon: number;
  readonly penaltyDurationMs: number;
  readonly penaltyFactor: number;
  readonly shakeDurationMs: number;
  readonly shakeIntensity: number;
}

export const defaultCarPhysicsConfig: CarPhysicsConfig = {
  maxSpeed: gameConfig.speed.maxSpeed,
  speedPerWpm: gameConfig.speed.speedPerWpm,
  accelTau: gameConfig.speed.accelTau,
  decelTau: gameConfig.speed.decelTau,
  idleStopMs: gameConfig.speed.idleStopMs,
  stopEpsilon: gameConfig.speed.stopEpsilon,
  penaltyDurationMs: gameConfig.penalty.durationMs,
  penaltyFactor: gameConfig.penalty.factor,
  shakeDurationMs: gameConfig.shake.durationMs,
  shakeIntensity: gameConfig.shake.intensity,
};

export interface CarState {
  /** unit/s, selalu 0..maxSpeed */
  readonly speed: number;
  readonly penaltyUntilMs: number;
  readonly shakeUntilMs: number;
}

export interface CarInput {
  /** WPM jendela geser saat ini. */
  readonly windowWpm: number;
  /** ms sejak karakter benar terakhir (Infinity bila belum ada). */
  readonly msSinceLastCorrect: number;
  readonly nowMs: number;
}

export function createCarState(): CarState {
  return { speed: 0, penaltyUntilMs: -Infinity, shakeUntilMs: -Infinity };
}

/** GAM-2: salah ketik memicu penalti kecepatan dan getar singkat. */
export function registerTypo(
  car: CarState,
  nowMs: number,
  cfg: CarPhysicsConfig = defaultCarPhysicsConfig,
): CarState {
  return {
    ...car,
    penaltyUntilMs: nowMs + cfg.penaltyDurationMs,
    shakeUntilMs: nowMs + cfg.shakeDurationMs,
  };
}

/** Kecepatan target dari WPM jendela, dibatasi maxSpeed, dikurangi saat penalti. */
export function targetSpeed(
  car: CarState,
  input: CarInput,
  cfg: CarPhysicsConfig = defaultCarPhysicsConfig,
): number {
  if (input.msSinceLastCorrect > cfg.idleStopMs) return 0;
  const raw = Math.min(cfg.maxSpeed, Math.max(0, input.windowWpm * cfg.speedPerWpm));
  return input.nowMs < car.penaltyUntilMs ? raw * cfg.penaltyFactor : raw;
}

/** Satu langkah fisika: easing eksponensial menuju target, tidak pernah melewati target maupun maxSpeed. */
export function stepCar(
  car: CarState,
  input: CarInput,
  dtSec: number,
  cfg: CarPhysicsConfig = defaultCarPhysicsConfig,
): CarState {
  const target = targetSpeed(car, input, cfg);
  const tau = target > car.speed ? cfg.accelTau : cfg.decelTau;
  const blend = dtSec <= 0 ? 0 : 1 - Math.exp(-dtSec / tau);
  let speed = car.speed + (target - car.speed) * blend;
  speed = Math.min(cfg.maxSpeed, Math.max(0, speed));
  if (target === 0 && speed < cfg.stopEpsilon) speed = 0;
  return speed === car.speed ? car : { ...car, speed };
}

/** Amplitudo getar saat ini (meluruh linear ke 0). */
export function shakeAmount(
  car: CarState,
  nowMs: number,
  cfg: CarPhysicsConfig = defaultCarPhysicsConfig,
): number {
  const remaining = car.shakeUntilMs - nowMs;
  if (remaining <= 0) return 0;
  return cfg.shakeIntensity * (remaining / cfg.shakeDurationMs);
}
