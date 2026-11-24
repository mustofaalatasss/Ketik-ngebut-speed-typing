import { gameConfig } from '../../config/gameConfig';

/** Rata-rata frame time bergulir (buffer melingkar, tanpa alokasi per frame). */
export class FrameStats {
  private readonly samples: Float64Array;
  private count = 0;
  private index = 0;
  private sum = 0;

  constructor(sampleSize: number = gameConfig.frameStats.sampleSize) {
    this.samples = new Float64Array(Math.max(1, sampleSize));
  }

  push(frameMs: number): void {
    if (!(frameMs > 0)) return;
    if (this.count === this.samples.length) {
      this.sum -= this.samples[this.index]!;
    } else {
      this.count++;
    }
    this.samples[this.index] = frameMs;
    this.sum += frameMs;
    this.index = (this.index + 1) % this.samples.length;
  }

  get averageFrameMs(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  get fps(): number {
    const avg = this.averageFrameMs;
    return avg === 0 ? 0 : 1000 / avg;
  }

  get sampleCount(): number {
    return this.count;
  }
}
