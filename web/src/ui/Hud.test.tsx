// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { HudSnapshot } from '../game/raceController';
import { createStore, shallowEqual } from '../game/store';
import { Hud } from './Hud';

afterEach(() => cleanup());

describe('HUD (GAM-3)', () => {
  it('GAM_3_Hud_TampilkanWpmAkurasiProgresWaktu', () => {
    const store = createStore<HudSnapshot>(
      { wpm: 0, accuracy: 1, progress: 0, elapsedMs: 0, speedKmh: 0, fps: 0, drawCalls: 0, triangles: 0, quality: 0, position: 1, racers: 1 },
      shallowEqual,
    );
    render(<Hud store={store} />);

    act(() =>
      store.publish({ wpm: 62, accuracy: 0.955, progress: 0.4, elapsedMs: 83_400, speedKmh: 120, fps: 60, drawCalls: 30, triangles: 41000, quality: 0, position: 1, racers: 1 }),
    );

    expect(screen.getByTestId('hud-wpm').textContent).toBe('62');
    expect(screen.getByTestId('hud-accuracy').textContent).toBe('96%');
    expect(screen.getByTestId('hud-progress').textContent).toBe('40%');
    expect(screen.getByTestId('hud-time').textContent).toBe('1:23.4');
    expect(screen.getByTestId('hud-speed').textContent).toBe('120');
    expect(screen.queryByTestId('hud-fps')).toBeNull();
  });

  it('GAM_5_Hud_TampilkanFpsSaatDebug', () => {
    const store = createStore<HudSnapshot>({ wpm: 0, accuracy: 1, progress: 0, elapsedMs: 0, speedKmh: 0, fps: 59, drawCalls: 30, triangles: 41000, quality: 1, position: 2, racers: 4 });
    render(<Hud store={store} showFps />);
    expect(screen.getByTestId('hud-fps').textContent).toBe('59');
  });

  it('BOT_5_Hud_TampilkanPosisiSaatAdaLawan', () => {
    const store = createStore<HudSnapshot>({ wpm: 0, accuracy: 1, progress: 0, elapsedMs: 0, speedKmh: 0, fps: 0, drawCalls: 0, triangles: 0, quality: 0, position: 2, racers: 4 });
    render(<Hud store={store} />);
    expect(screen.getByTestId('hud-position').textContent).toBe('2/4');
  });

  it('BOT_5_Hud_TanpaLawan_PosisiTidakDitampilkan', () => {
    const store = createStore<HudSnapshot>({ wpm: 0, accuracy: 1, progress: 0, elapsedMs: 0, speedKmh: 0, fps: 0, drawCalls: 0, triangles: 0, quality: 0, position: 1, racers: 1 });
    render(<Hud store={store} />);
    expect(screen.queryByTestId('hud-position')).toBeNull();
  });
});
