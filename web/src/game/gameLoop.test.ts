import { describe, expect, it } from 'vitest';
import { GameLoop } from './gameLoop';
import { ManualScheduler } from './testing/manualScheduler';

describe('Game loop (GAM-5)', () => {
  it('GAM_5_GameLoop_MemakaiRequestAnimationFrame', () => {
    const scheduler = new ManualScheduler();
    const dts: number[] = [];
    const loop = new GameLoop((dt) => dts.push(dt), scheduler, 0.1);

    loop.start();
    expect(scheduler.pendingCount).toBe(1);
    scheduler.runFrames(3, 16);

    expect(dts).toHaveLength(3);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016, 10);
    expect(scheduler.pendingCount).toBe(1); // selalu satu frame berikutnya yang terjadwal
  });

  it('GAM_5_DtDibatasi_SetelahTabTidakAktif', () => {
    const scheduler = new ManualScheduler();
    const dts: number[] = [];
    const loop = new GameLoop((dt) => dts.push(dt), scheduler, 0.1);
    loop.start();
    scheduler.runFrames(1, 16);
    scheduler.runFrames(1, 5_000);
    expect(dts[1]).toBe(0.1);
  });

  it('GAM_5_Stop_MembatalkanAnimationFrame', () => {
    const scheduler = new ManualScheduler();
    let frames = 0;
    const loop = new GameLoop(() => frames++, scheduler);
    loop.start();
    scheduler.runFrames(2, 16);
    loop.stop();

    expect(loop.running).toBe(false);
    expect(scheduler.pendingCount).toBe(0);
    scheduler.runFrames(5, 16);
    expect(frames).toBe(2);
  });
});
