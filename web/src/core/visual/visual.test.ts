import { describe, expect, it } from 'vitest';
import { finishUnitsPerChar, nextFinishDistance } from './finishGate';
import { EmissionAccumulator, ParticlePool } from './particlePool';
import { QualityController } from './qualityController';
import { createRoadsideLayout, type RoadsideLayoutOptions } from './roadsideLayout';
import { scrollTextureOffset, wrapZ } from './scroll';
import { cameraSway, dustRate, speedLineIntensity, targetFov } from './speedFeel';

describe('Sensasi kecepatan (GAM-1)', () => {
  it('GAM_1_SpeedFeel_FovNaikMonotonDanDibatasi', () => {
    let previous = -Infinity;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const fov = targetFov(r, 60, 80, 1.6);
      expect(fov).toBeGreaterThanOrEqual(previous);
      previous = fov;
    }
    expect(targetFov(0, 60, 80, 1.6)).toBe(60);
    expect(targetFov(1, 60, 80, 1.6)).toBe(80);
    expect(targetFov(5, 60, 80, 1.6)).toBe(80); // rasio di atas 1 tetap dibatasi
  });

  it('GAM_1_SpeedFeel_GarisKecepatanHanyaSaatNgebut', () => {
    expect(speedLineIntensity(0, 0.5)).toBe(0);
    expect(speedLineIntensity(0.5, 0.5)).toBe(0);
    expect(speedLineIntensity(0.75, 0.5)).toBeCloseTo(0.5, 10);
    expect(speedLineIntensity(1, 0.5)).toBe(1);
    expect(speedLineIntensity(2, 0.5)).toBe(1);
  });

  it('GAM_1_SpeedFeel_GoyanganKameraNolSaatDiam', () => {
    expect(cameraSway(1.23, 0, 0.05, 1.3)).toEqual({ x: 0, y: 0 });
    const fast = cameraSway(1.23, 1, 0.05, 1.3);
    expect(Math.abs(fast.x)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(fast.x) + Math.abs(fast.y)).toBeGreaterThan(0);
  });

  it('GAM_1_Scroll_OffsetTeksturSebandingJarak', () => {
    // Setengah panjang ulangan -> offset bertambah 0,5.
    expect(scrollTextureOffset(0, 6, 12)).toBeCloseTo(0.5, 10);
    // Bergeser 3 ulangan penuh + 0,25 -> tetap modulo 1.
    expect(scrollTextureOffset(0.1, 39, 12)).toBeCloseTo(0.35, 10);
    // Tidak bergerak -> tidak berubah.
    expect(scrollTextureOffset(0.4, 0, 12)).toBe(0.4);
  });

  it('GAM_1_Roadside_ObjekDidaurUlangTetapDiRentang', () => {
    const behind = 25;
    const span = 280;
    let zs = Array.from({ length: 50 }, (_, i) => behind - (i * span) / 50);
    for (let frame = 0; frame < 2_000; frame++) {
      const distance = 0.66 + (frame % 7) * 0.1; // ~40 unit/s pada 60 FPS
      zs = zs.map((z) => wrapZ(z, distance, behind, span));
      for (const z of zs) {
        expect(z).toBeLessThanOrEqual(behind);
        expect(z).toBeGreaterThanOrEqual(behind - span - 1e-9);
      }
    }
    // Jarak antarobjek tetap (tidak menumpuk): selisih berurutan setelah diurutkan tetap span/50.
    const sorted = [...zs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeCloseTo(span / 50, 6);
    }
  });

  it('GAM_1_Roadside_PenempatanDeterministikDenganSeed', () => {
    const options: RoadsideLayoutOptions = {
      seed: 7,
      span: 280,
      behind: 25,
      roadWidth: 8,
      treeCount: 40,
      lampCount: 6,
      markerCount: 4,
      railPostSpacing: 4,
      treeMinOffset: 3,
      treeMaxOffset: 45,
    };
    const a = createRoadsideLayout(options);
    expect(createRoadsideLayout(options)).toEqual(a);
    expect(createRoadsideLayout({ ...options, seed: 8 })).not.toEqual(a);

    // Tidak ada objek di atas jalan.
    for (const item of a) expect(Math.abs(item.x)).toBeGreaterThan(options.roadWidth / 2);
    expect(a.filter((i) => i.kind === 'railPost')).toHaveLength(2 * (280 / 4));
  });
});

describe('Gerbang finis (GAM-1)', () => {
  const UNITS_PER_CHAR = 4.8;
  const TAU = 0.6;
  const DT = 1 / 60;

  /** Simulasi: `remainingAt(t)` sisa karakter, `speedAt(t)` kecepatan dunia (unit/s). */
  const simulate = (remainingAt: (t: number) => number, speedAt: (t: number) => number, seconds: number) => {
    let d = Infinity;
    const trace: number[] = [];
    for (let i = 0; i < seconds * 60; i++) {
      const t = i * DT;
      d = nextFinishDistance(d, speedAt(t) * DT, remainingAt(t), UNITS_PER_CHAR, DT, TAU);
      trace.push(d);
    }
    return trace;
  };

  it('GAM_1_Finish_UnitPerKarakterSesuaiRumusKecepatan', () => {
    // 0,4 unit/s per WPM, 5 karakter per kata -> 4,8 unit per karakter.
    expect(finishUnitsPerChar(0.4, 5)).toBeCloseTo(UNITS_PER_CHAR, 10);
  });

  /** Teks 100 karakter diketik `cps` karakter/detik. */
  const typing = (cps: number) => (t: number) => Math.max(0, 100 - Math.floor(t * cps));

  it('GAM_1_Finish_JarakTidakPernahBertambahSelamaBalapan', () => {
    // Berbagai kombinasi: dunia lebih cepat, sama, atau lebih lambat dari laju ketikan;
    // termasuk berhenti mengetik di tengah dan kecepatan naik-turun.
    const scenarios: [(t: number) => number, (t: number) => number][] = [
      [typing(5), () => 40], // dunia jauh lebih cepat (dulu: gerbang mundur-mundur)
      [typing(5), () => 24], // sesuai perkiraan 4,8 unit per karakter
      [typing(5), () => 8], // dunia lebih lambat (kecepatan dibatasi / penalti)
      [(t) => (t < 6 ? typing(6)(t) : 64), (t) => (t < 6 ? 30 : 0)], // berhenti mengetik
      [typing(4), (t) => 20 + 15 * Math.sin(t * 3)],
    ];
    for (const [remainingAt, speedAt] of scenarios) {
      const trace = simulate(remainingAt, speedAt, 30);
      const firstFinish = trace.findIndex((_, i) => remainingAt(i * DT) === 0);
      const racing = firstFinish === -1 ? trace : trace.slice(0, firstFinish);
      for (let i = 1; i < racing.length; i++) {
        expect(racing[i]!).toBeLessThanOrEqual(racing[i - 1]! + 1e-9);
      }
      expect(racing.every((d) => d > 0)).toBe(true); // tidak tercapai sebelum teks selesai
    }
  });

  it('GAM_1_Finish_KecepatanSesuai_GerbangDiamTerhadapJalan', () => {
    // Laju dunia = sisa karakter × 4,8: gerbang bergerak persis bersama jalan (tidak meluncur).
    const cps = 5;
    const remaining = (t: number) => Math.max(0, 100 - t * cps); // kontinu agar perbandingan pas
    const trace = simulate(remaining, () => cps * UNITS_PER_CHAR, 10);
    for (let i = 60; i < 9 * 60; i++) {
      const roadShift = cps * UNITS_PER_CHAR * DT;
      expect(trace[i - 1]! - trace[i]!).toBeCloseTo(roadShift, 6);
    }
  });

  it('GAM_1_Finish_MobilDiBatasKecepatan_TercapaiSebelumLayarHasil', () => {
    // 9 karakter/detik (108 WPM) melebihi batas 40 unit/s; kecepatan naik bertahap dari 0.
    const cps = 9;
    const remainingAt = (t: number) => Math.max(0, 100 - Math.floor(t * cps));
    const speedAt = (t: number) => Math.min(40, cps * UNITS_PER_CHAR) * (1 - Math.exp(-t / 0.35));
    const trace = simulate(remainingAt, speedAt, 14);
    const finishFrame = trace.findIndex((_, i) => remainingAt(i * DT) === 0);
    const resultsFrame = finishFrame + Math.floor(0.9 * 60); // finishDelayMs
    expect(trace.slice(finishFrame, resultsFrame).some((d) => d <= 0)).toBe(true);
  });

  it('GAM_1_Finish_GerbangTercapaiTepatSaatProgres100', () => {
    const remainingAt = typing(5); // selesai di detik ke-20
    const trace = simulate(remainingAt, () => 12, 26);
    const finishFrame = trace.findIndex((_, i) => remainingAt(i * DT) === 0);
    expect(trace[finishFrame - 1]!).toBeGreaterThan(0);
    // Setelah selesai gerbang mencapai mobil lalu lewat ke belakang bersama jalan.
    expect(trace.slice(finishFrame).some((d) => d === 0)).toBe(true);
    expect(trace.at(-1)!).toBeLessThan(0);
  });
});

describe('Partikel (GAM-1, GAM-2)', () => {
  it('GAM_1_Particles_DebuSebandingKecepatanDanPoolTerbatas', () => {
    expect(dustRate(0, 100)).toBe(0);
    expect(dustRate(0.5, 100)).toBe(50);

    const acc = new EmissionAccumulator();
    let emitted = 0;
    for (let i = 0; i < 60; i++) emitted += acc.take(50, 1 / 60);
    expect(emitted).toBe(50);

    const pool = new ParticlePool(10, [1, 1, 1]);
    for (let i = 0; i < 25; i++) pool.spawn({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, life: 1 });
    expect(pool.count).toBe(10);

    // Partikel tertinggal di jalan (ikut pergeseran dunia), memudar, lalu mati.
    pool.update(0.5, 3, 0, 0);
    expect(pool.positions[2]).toBeCloseTo(3, 6);
    expect(pool.colors[3]).toBeCloseTo(0.5, 6);
    pool.update(0.6, 0, 0, 0);
    expect(pool.count).toBe(0);
  });

  it('GAM_2_Particles_SalahKetikMemicuPercikan', () => {
    const pool = new ParticlePool(90, [1, 0.7, 0.3]);
    const burst = (n: number) => {
      for (let i = 0; i < n; i++) pool.spawn({ x: 0, y: 0.2, z: -1, vx: 1, vy: 3, vz: 0, life: 0.45 });
    };
    burst(26);
    expect(pool.count).toBe(26);
    // Gravitasi menarik ke bawah, tapi tidak menembus tanah.
    for (let i = 0; i < 20; i++) pool.update(0.02, 0, 14, 0);
    expect(pool.positions[1]!).toBeGreaterThanOrEqual(0.02);
    for (let i = 0; i < 10; i++) pool.update(0.05, 0, 14, 0);
    expect(pool.count).toBe(0);
  });
});

describe('Kualitas adaptif (GAM-5)', () => {
  const options = { downgradeFps: 50, sustainSec: 2, warmupSec: 2.5, maxLevel: 3 };
  const run = (q: QualityController, fps: number, seconds: number) => {
    for (let i = 0; i < seconds * 60; i++) q.update(fps, 1 / 60);
    return q.level;
  };

  it('GAM_5_Quality_FpsRendahTurunLevelDenganHisteresis', () => {
    const q = new QualityController(options);
    expect(run(q, 20, 2)).toBe(0); // masa pemanasan diabaikan
    expect(run(q, 60, 5)).toBe(0);

    // Penurunan sesaat (1 detik) tidak mengubah kualitas.
    expect(run(q, 30, 1)).toBe(0);
    expect(run(q, 60, 1)).toBe(0);

    // Penurunan berkelanjutan -> satu tingkat per 2 detik.
    expect(run(q, 30, 2.1)).toBe(1);
    expect(run(q, 30, 2.1)).toBe(2);

    // FPS pulih -> tidak naik lagi (tidak berosilasi).
    expect(run(q, 60, 10)).toBe(2);

    // Tidak pernah melewati tingkat maksimum.
    expect(run(q, 10, 30)).toBe(3);
  });
});
