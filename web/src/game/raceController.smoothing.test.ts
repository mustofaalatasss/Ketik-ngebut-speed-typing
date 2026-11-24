import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { createOpponents, opponentsConfigFor } from '../core/bots/opponents';
import { seededRandom } from '../core/util/random';
import type { RaceSceneLike } from '../scene/sceneTypes';
import { createRaceStores, RaceController } from './raceController';
import { ManualScheduler } from './testing/manualScheduler';

const FRAME_MS = 1000 / 60;
const COUNTDOWN_FRAMES = Math.ceil((gameConfig.countdownSeconds * 1000) / FRAME_MS) + 1;
const TEXT =
  'Setiap hari Sabtu, Rina berlatih mengetik selama tiga puluh menit. Ia mencatat kecepatan dan ketepatannya.';

/** Menyimpan salinan nilai per frame (controller memakai ulang objek lawan antarframe). */
function setup() {
  const scheduler = new ManualScheduler();
  const frames: { remaining: number; bots: number[] }[] = [];
  const scene: RaceSceneLike = {
    update: (v) => frames.push({ remaining: v.remainingChars, bots: v.opponents.map((o) => o.remainingChars) }),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  const controller = new RaceController({
    passageId: 'p',
    text: TEXT,
    scene,
    stores: createRaceStores(TEXT),
    opponents: createOpponents(TEXT, opponentsConfigFor('advanced'), seededRandom(11)),
    onFinish: vi.fn(),
    clock: () => scheduler.nowMs,
    scheduler,
    keyTarget: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  controller.start();
  return { scheduler, frames, controller };
}

/** Perubahan terbesar per frame dan perubahan "kecepatan" terbesar antarframe. */
function roughness(series: number[]): { maxStep: number; maxAccel: number } {
  let maxStep = 0;
  let maxAccel = 0;
  for (let i = 2; i < series.length; i++) {
    const v1 = series[i - 1]! - series[i - 2]!;
    const v2 = series[i]! - series[i - 1]!;
    maxStep = Math.max(maxStep, Math.abs(v2));
    maxAccel = Math.max(maxAccel, Math.abs(v2 - v1));
  }
  return { maxStep, maxAccel };
}

describe('Gerak halus lawan dan gerbang (BOT-1, GAM-1)', () => {
  it('BOT_1_PosisiBot_BergerakHalusTanpaLonjakanKecepatan', () => {
    const { scheduler, frames } = setup();
    scheduler.runFrames(COUNTDOWN_FRAMES + 10 * 60, FRAME_MS);
    const racing = frames.slice(COUNTDOWN_FRAMES + 30); // setelah start

    for (let b = 0; b < 3; b++) {
      const series = racing.map((f) => f.bots[b]!);
      const { maxAccel } = roughness(series);
      // Interpolasi lurus per karakter membuat kecepatan melonjak di setiap batas karakter
      // (~0,03–0,06 karakter/frame). Setelah diperhalus perubahannya jauh lebih kecil.
      expect(maxAccel).toBeLessThan(0.01);
      // Tetap maju (tidak pernah mundur).
      expect(series.every((r, i) => i === 0 || r <= series[i - 1]! + 1e-9)).toBe(true);
    }
  });

  it('GAM_1_SisaKarakterPemain_BerubahHalusSaatMengetik', () => {
    const { scheduler, frames, controller } = setup();
    scheduler.runFrames(COUNTDOWN_FRAMES, FRAME_MS);
    const start = frames.length;
    for (const ch of TEXT.slice(0, 30)) {
      controller.handleKey(ch);
      scheduler.runFrames(12, FRAME_MS); // 5 karakter/detik
    }
    const series = frames.slice(start).map((f) => f.remaining);
    // Tanpa perhalusan sisa karakter melompat 1 karakter (4,8 unit) per ketikan.
    expect(roughness(series).maxStep).toBeLessThan(0.35);
    expect(series.at(-1)!).toBeLessThan(TEXT.length - 25);
  });

  it('GAM_1_SisaKarakterPemain_TepatNolSetelahSelesai', () => {
    const { scheduler, frames, controller } = setup();
    scheduler.runFrames(COUNTDOWN_FRAMES, FRAME_MS);
    for (const ch of TEXT) {
      controller.handleKey(ch);
      scheduler.runFrames(3, FRAME_MS);
    }
    scheduler.runFrames(60, FRAME_MS);
    expect(frames.at(-1)!.remaining).toBe(0); // gerbang finis bisa tercapai tepat
  });
});
