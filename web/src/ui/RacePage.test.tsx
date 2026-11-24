// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { ManualScheduler } from '../game/testing/manualScheduler';
import type { RaceSceneLike } from '../scene/sceneTypes';
import { RacePage } from './RacePage';

const passage = { id: 't1', language: 'en', difficulty: 'easy', text: 'hello world' } as const;
const FRAME_MS = 1000 / 60;

function stubScene() {
  const scene: RaceSceneLike & { updates: number } = {
    updates: 0,
    update: vi.fn(() => {
      scene.updates++;
    }),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return scene;
}

function setup() {
  const scheduler = new ManualScheduler();
  const scene = stubScene();
  const clock = () => scheduler.nowMs;
  const createScene = () => scene;
  const onFinish = vi.fn();
  let commits = 0;
  const utils = render(
    <Profiler id="race" onRender={() => commits++}>
      <RacePage
        passage={passage}
        carColor="#ff0000"
        onFinish={onFinish}
        createScene={createScene}
        scheduler={scheduler}
        clock={clock}
      />
    </Profiler>,
  );
  return { ...utils, scheduler, scene, onFinish, getCommits: () => commits };
}

afterEach(() => cleanup());

describe('RacePage dan game loop (GAM-5)', () => {
  it('GAM_5_300Frame_ReactTidakRenderSetiapFrame', () => {
    const { scheduler, scene, getCommits } = setup();
    const before = getCommits();

    // 5 detik: 3 detik hitung mundur + 2 detik balapan, sambil mengetik beberapa huruf.
    const frames = 300;
    act(() => {
      scheduler.runFrames(frames, FRAME_MS, (i) => {
        if (i > 190 && i % 20 === 0) {
          const ch = passage.text[(i - 200) / 20] ?? 'h';
          window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
        }
      });
    });

    const commits = getCommits() - before;
    expect(scene.updates).toBe(frames); // adegan diperbarui setiap frame...
    // ...tetapi React hanya render pada frekuensi HUD (+ hitung mundur dan keystroke).
    const maxExpected = 5 * gameConfig.hud.updateHz + gameConfig.countdownSeconds + 1 + 6;
    expect(commits).toBeLessThanOrEqual(maxExpected);
    expect(commits).toBeLessThan(frames / 4);
  });

  it('GAM_1_Unmount_SceneDisposeDanListenerDilepas', () => {
    const { scheduler, scene, unmount } = setup();
    act(() => scheduler.runFrames(10, FRAME_MS));
    expect(scheduler.pendingCount).toBe(1);

    unmount();

    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(scheduler.pendingCount).toBe(0); // requestAnimationFrame dibatalkan

    const updates = scene.updates;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    scheduler.runFrames(5, FRAME_MS);
    expect(scene.updates).toBe(updates);
  });

  it('TYP_4_RacePage_HitungMundurTampilLaluHilang', () => {
    const { scheduler, getByTestId, queryByTestId } = setup();
    act(() => scheduler.runFrames(1, FRAME_MS));
    expect(getByTestId('countdown').textContent).toBe('3');
    act(() => scheduler.runFrames(70, FRAME_MS));
    expect(getByTestId('countdown').textContent).toBe('2');
    act(() => scheduler.runFrames(130, FRAME_MS));
    expect(queryByTestId('countdown')).toBeNull();
  });

  it('GAM_4_RacePage_TeksSelesai_OnFinishDipanggilSekali', () => {
    const { scheduler, onFinish } = setup();
    act(() => scheduler.runFrames(200, FRAME_MS)); // lewati hitung mundur
    act(() => {
      for (const ch of passage.text) {
        scheduler.runFrames(6, FRAME_MS);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
      }
    });
    act(() => scheduler.runFrames(120, FRAME_MS));

    expect(onFinish).toHaveBeenCalledTimes(1);
    const result = onFinish.mock.calls[0]![0];
    expect(result.status).toBe('finished');
    expect(result.correctChars).toBe(passage.text.length);
    expect(result.accuracy).toBe(1);
  });
});
