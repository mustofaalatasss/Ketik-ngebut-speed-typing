// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpponents, opponentsConfigFor } from '../core/bots/opponents';
import type { Standing } from '../core/bots/standings';
import { seededRandom } from '../core/util/random';
import { ManualScheduler } from '../game/testing/manualScheduler';
import type { FrameView, RaceSceneLike, SceneSetup } from '../scene/sceneTypes';
import { RacePage } from './RacePage';

const passage = { id: 't1', language: 'id', difficulty: 'easy', text: 'aku suka kopi' } as const;
const FRAME_MS = 1000 / 60;

afterEach(() => cleanup());

function setup() {
  const scheduler = new ManualScheduler();
  const views: FrameView[] = [];
  let sceneSetup: SceneSetup | null = null;
  const scene: RaceSceneLike = {
    update: (v) => views.push({ ...v, opponents: v.opponents.map((o) => ({ ...o })) }),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  const onFinish = vi.fn<(r: unknown, s: readonly Standing[]) => void>();
  // Bot Pemula sangat lambat di teks pendek ini, jadi pemain pasti di depan.
  const opponents = createOpponents(passage.text, opponentsConfigFor('beginner'), seededRandom(5));
  render(
    <RacePage
      passage={passage}
      carColor="#ff0000"
      opponents={opponents}
      playerName="rina"
      onFinish={onFinish}
      createScene={(_, s) => {
        sceneSetup = s;
        return scene;
      }}
      scheduler={scheduler}
      clock={() => scheduler.nowMs}
    />,
  );
  return { scheduler, views, onFinish, opponents, getSetup: () => sceneSetup };
}

describe('Balapan 4 mobil (BOT-4, BOT-5)', () => {
  it('BOT_4_Balapan_Tepat4Mobil', () => {
    const { scheduler, views, getSetup } = setup();
    act(() => scheduler.runFrames(400, FRAME_MS)); // hitung mundur + ~3,6 detik balapan

    // 1 pemain + 3 lawan dengan warna/identitas berbeda.
    expect(getSetup()!.opponents).toHaveLength(3);
    expect(new Set(getSetup()!.opponents.map((o) => o.id)).size).toBe(3);
    expect(views.every((v) => v.opponents.length === 3)).toBe(true);

    // Lawan diam selama hitung mundur, lalu maju.
    const atStart = views[10]!.opponents.map((o) => o.remainingChars);
    expect(atStart.every((r) => r === passage.text.length)).toBe(true);
    const later = views.at(-1)!.opponents.map((o) => o.remainingChars);
    expect(later.every((r) => r < passage.text.length)).toBe(true);
    expect(screen.getByTestId('hud-position').textContent).toMatch(/\/4$/);
  });

  it('BOT_5_FinisPemain_PeringkatEmpatMobil', () => {
    const { scheduler, onFinish } = setup();
    act(() => scheduler.runFrames(200, FRAME_MS));
    act(() => {
      for (const ch of passage.text) {
        scheduler.runFrames(5, FRAME_MS);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ch }));
      }
    });
    act(() => scheduler.runFrames(120, FRAME_MS));

    expect(onFinish).toHaveBeenCalledTimes(1);
    const standings = onFinish.mock.calls[0]![1];
    expect(standings).toHaveLength(4);
    expect(standings.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    // Pemain mengetik ~12 karakter/detik, jauh lebih cepat dari bot Pemula.
    expect(standings[0]!.kind).toBe('player');
    expect(standings[0]!.name).toBe('rina');
    // Urutan finis: waktu selesai naik.
    const times = standings.map((s) => s.finishMs ?? Infinity);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
