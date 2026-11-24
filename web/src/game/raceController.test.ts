import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import type { FrameView, RaceSceneLike } from '../scene/sceneTypes';
import { createRaceStores, RaceController } from './raceController';
import { ManualScheduler } from './testing/manualScheduler';

const FRAME_MS = 1000 / 60;
const COUNTDOWN_FRAMES = Math.ceil((gameConfig.countdownSeconds * 1000) / FRAME_MS) + 1;

function setup(text = 'abc') {
  const scheduler = new ManualScheduler();
  const views: FrameView[] = [];
  const scene: RaceSceneLike = {
    update: (v) => views.push(v),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  const stores = createRaceStores(text);
  const onFinish = vi.fn();
  const controller = new RaceController({
    passageId: 'p',
    text,
    scene,
    stores,
    onFinish,
    clock: () => scheduler.nowMs,
    scheduler,
    keyTarget: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  controller.start();
  return { scheduler, views, stores, onFinish, controller };
}

describe('RaceController', () => {
  it('TYP_4_Controller_KetikSaatHitungMundur_TidakTercatat', () => {
    const { scheduler, controller, stores } = setup();
    scheduler.runFrames(10, FRAME_MS);
    controller.handleKey('a');
    expect(stores.typing.getSnapshot().cursor).toBe(0);
    expect(stores.phase.getSnapshot().phase).toBe('countdown');
  });

  it('GAM_2_Controller_SalahKetik_GetarDanPenalti', () => {
    const { scheduler, controller, views, stores } = setup('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    scheduler.runFrames(COUNTDOWN_FRAMES, FRAME_MS);
    for (let i = 0; i < 20; i++) {
      controller.handleKey('a');
      scheduler.runFrames(6, FRAME_MS);
    }
    const speedBefore = views.at(-1)!.speed;
    expect(speedBefore).toBeGreaterThan(0);

    controller.handleKey('x');
    expect(stores.typing.getSnapshot().typoCount).toBe(1);
    scheduler.runFrames(1, FRAME_MS);
    expect(views.at(-1)!.shake).toBeGreaterThan(0);
    scheduler.runFrames(15, FRAME_MS);
    expect(views.at(-1)!.speed).toBeLessThan(speedBefore);
  });

  it('GAM_4_Controller_TeksSelesai_OnFinishSetelahJeda', () => {
    const { scheduler, controller, onFinish, views } = setup('ab');
    scheduler.runFrames(COUNTDOWN_FRAMES, FRAME_MS);
    controller.handleKey('a');
    scheduler.runFrames(10, FRAME_MS);
    controller.handleKey('b');
    scheduler.runFrames(1, FRAME_MS);
    expect(views.at(-1)!.progress).toBe(1);
    expect(onFinish).not.toHaveBeenCalled();

    scheduler.runFrames(Math.ceil(gameConfig.finishDelayMs / FRAME_MS) + 2, FRAME_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
    scheduler.runFrames(60, FRAME_MS);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
