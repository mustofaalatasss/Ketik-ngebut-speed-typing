import { describe, expect, it } from 'vitest';
import { FrameStats } from './frameStats';

describe('Statistik frame (GAM-5, AC 60 FPS)', () => {
  it('GAM_5_FrameStats_RataRataFrameTimeDanFps', () => {
    const stats = new FrameStats(4);
    expect(stats.fps).toBe(0);

    [10, 20, 30, 40].forEach((ms) => stats.push(ms));
    expect(stats.averageFrameMs).toBe(25);
    expect(stats.fps).toBe(40);

    // Buffer bergulir: sampel tertua (10) dibuang.
    stats.push(50);
    expect(stats.averageFrameMs).toBe(35);
    expect(stats.sampleCount).toBe(4);

    // Nilai tidak valid diabaikan.
    stats.push(0);
    stats.push(Number.NaN);
    expect(stats.averageFrameMs).toBe(35);
  });
});
