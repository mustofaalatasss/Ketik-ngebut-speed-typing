import { describe, expect, it } from 'vitest';
import {
  createCarState,
  defaultCarPhysicsConfig as cfg,
  registerTypo,
  shakeAmount,
  stepCar,
  type CarInput,
  type CarState,
} from './carPhysics';

const DT = 1 / 60;
const FRAME_MS = 1000 / 60;

/** Menjalankan fisika selama `seconds` dengan input dari fungsi waktu. */
function simulate(
  car: CarState,
  seconds: number,
  input: (nowMs: number) => Omit<CarInput, 'nowMs'>,
  startMs = 0,
): { car: CarState; nowMs: number; max: number } {
  let now = startMs;
  let max = car.speed;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    now += FRAME_MS;
    car = stepCar(car, { ...input(now), nowMs: now }, DT);
    max = Math.max(max, car.speed);
  }
  return { car, nowMs: now, max };
}

const typingAt = (wpm: number) => () => ({ windowWpm: wpm, msSinceLastCorrect: 100 });

describe('Fisika mobil (GAM-1, GAM-2)', () => {
  it('GAM_1_Kecepatan_DiperhalusTidakLoncat', () => {
    const car = stepCar(createCarState(), { windowWpm: 100, msSinceLastCorrect: 0, nowMs: 0 }, DT);
    expect(car.speed).toBeGreaterThan(0);
    expect(car.speed).toBeLessThan(cfg.maxSpeed * 0.1);
  });

  it('GAM_1_KetikStabil_KecepatanMenujuTarget', () => {
    const { car } = simulate(createCarState(), 3, typingAt(60));
    expect(car.speed).toBeCloseTo(60 * cfg.speedPerWpm, 1);
  });

  it('GAM_1_KetikSangatCepat_TidakMelebihiBatasMaks', () => {
    const { car, max } = simulate(createCarState(), 10, typingAt(1_000));
    expect(max).toBeLessThanOrEqual(cfg.maxSpeed);
    expect(car.speed).toBeCloseTo(cfg.maxSpeed, 1);

    // dt sangat besar pun tidak boleh melewati batas.
    const big = stepCar(car, { windowWpm: 5_000, msSinceLastCorrect: 0, nowMs: 0 }, 10);
    expect(big.speed).toBeLessThanOrEqual(cfg.maxSpeed);
  });

  it('GAM_1_BerhentiMengetik_KecepatanTurunSampaiNol', () => {
    const cruising = simulate(createCarState(), 5, typingAt(150));
    expect(cruising.car.speed).toBeGreaterThan(cfg.maxSpeed * 0.9);

    // Berhenti mengetik: karakter benar terakhir pada waktu cruising.nowMs.
    const lastCorrect = cruising.nowMs;
    let car = cruising.car;
    let now = lastCorrect;
    const speedWhenStopped = car.speed;
    let previous = car.speed;
    let stoppedAtMs: number | null = null;
    while (now - lastCorrect < 10_000) {
      now += FRAME_MS;
      const sinceMs = now - lastCorrect;
      // WPM jendela meluruh selama 3 detik jendela berlalu.
      const windowWpm = Math.max(0, 150 * (1 - sinceMs / 3_000));
      car = stepCar(car, { windowWpm, msSinceLastCorrect: sinceMs, nowMs: now }, DT);
      // Tidak bertambah cepat setelah berhenti mengetik (selisih asimtotik < 0,01 unit/s diabaikan).
      expect(car.speed).toBeLessThanOrEqual(speedWhenStopped + 0.01);
      // Melambat bertahap: tidak ada penurunan mendadak lebih dari 3 unit/s dalam satu frame.
      expect(previous - car.speed).toBeLessThan(3);
      previous = car.speed;
      if (car.speed === 0) {
        stoppedAtMs = sinceMs;
        break;
      }
    }

    expect(stoppedAtMs).not.toBeNull();
    expect(stoppedAtMs!).toBeLessThan(5_000);
    expect(stoppedAtMs!).toBeGreaterThan(1_000); // bertahap, bukan langsung berhenti
  });

  it('GAM_2_SalahKetik_KecepatanTurunSesaatLaluPulih', () => {
    const cruising = simulate(createCarState(), 4, typingAt(80));
    const before = cruising.car.speed;

    const penalised = registerTypo(cruising.car, cruising.nowMs);
    const during = simulate(penalised, cfg.penaltyDurationMs / 1000 - 0.05, typingAt(80), cruising.nowMs);
    expect(during.car.speed).toBeLessThan(before * 0.8);

    const after = simulate(during.car, 3, typingAt(80), during.nowMs);
    expect(after.car.speed).toBeCloseTo(before, 1);
  });

  it('GAM_2_SalahKetik_MemicuGetarSingkat', () => {
    const car = registerTypo(createCarState(), 1_000);
    expect(shakeAmount(createCarState(), 1_000)).toBe(0);
    expect(shakeAmount(car, 1_000)).toBeCloseTo(cfg.shakeIntensity, 10);
    expect(shakeAmount(car, 1_000 + cfg.shakeDurationMs / 2)).toBeGreaterThan(0);
    expect(shakeAmount(car, 1_000 + cfg.shakeDurationMs)).toBe(0);
  });
});
