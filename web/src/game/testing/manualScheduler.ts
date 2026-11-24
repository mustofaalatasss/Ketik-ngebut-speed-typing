import type { FrameScheduler } from '../gameLoop';

/** Pengganti requestAnimationFrame untuk test: frame dijalankan manual dengan jam palsu. */
export class ManualScheduler implements FrameScheduler {
  private nextId = 1;
  private readonly callbacks = new Map<number, (t: number) => void>();
  nowMs = 0;

  request(callback: (timeMs: number) => void): number {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.callbacks.delete(id);
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }

  /** Menjalankan `count` frame, masing-masing memajukan jam sebesar `stepMs`. */
  runFrames(count: number, stepMs: number, beforeFrame?: (i: number) => void): void {
    for (let i = 0; i < count; i++) {
      this.nowMs += stepMs;
      beforeFrame?.(i);
      const pending = [...this.callbacks.entries()];
      this.callbacks.clear();
      for (const [, cb] of pending) cb(this.nowMs);
    }
  }
}
