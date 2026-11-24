import { gameConfig } from '../config/gameConfig';

/** Abstraksi requestAnimationFrame agar loop bisa dites dengan jadwal palsu. */
export interface FrameScheduler {
  request(callback: (timeMs: number) => void): number;
  cancel(id: number): void;
}

export const browserScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export type FrameCallback = (dtSec: number, nowMs: number) => void;

/**
 * Game loop berbasis requestAnimationFrame (GAM-5). Tidak tahu apa pun tentang React:
 * callback mengubah objek biasa dan scene Three.js, bukan state React.
 */
export class GameLoop {
  private frameId: number | null = null;
  private lastMs: number | null = null;

  constructor(
    private readonly onFrame: FrameCallback,
    private readonly scheduler: FrameScheduler = browserScheduler,
    private readonly maxDtSec: number = gameConfig.maxFrameDtSec,
  ) {}

  get running(): boolean {
    return this.frameId !== null;
  }

  start(): void {
    if (this.frameId !== null) return;
    this.lastMs = null;
    this.frameId = this.scheduler.request(this.tick);
  }

  stop(): void {
    if (this.frameId !== null) {
      this.scheduler.cancel(this.frameId);
      this.frameId = null;
    }
  }

  private readonly tick = (nowMs: number): void => {
    const dtSec = this.lastMs === null ? 0 : Math.min(this.maxDtSec, (nowMs - this.lastMs) / 1000);
    this.lastMs = nowMs;
    // Jadwalkan frame berikutnya dulu, supaya onFrame boleh memanggil stop().
    this.frameId = this.scheduler.request(this.tick);
    this.onFrame(dtSec, nowMs);
  };
}
