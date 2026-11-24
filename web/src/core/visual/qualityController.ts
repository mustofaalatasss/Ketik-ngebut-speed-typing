export interface QualityOptions {
  readonly downgradeFps: number;
  readonly sustainSec: number;
  readonly warmupSec: number;
  readonly maxLevel: number;
}

/**
 * Menurunkan kualitas grafis satu tingkat bila FPS rata-rata terus di bawah ambang selama
 * `sustainSec`. Hanya turun, tidak pernah naik lagi: ini mencegah naik-turun berulang
 * (di monitor 60 Hz FPS tidak bisa melebihi 60, jadi sinyal "naik" tidak bisa dipercaya).
 */
export class QualityController {
  private elapsed = 0;
  private lowFor = 0;
  private current = 0;

  constructor(private readonly options: QualityOptions) {}

  get level(): number {
    return this.current;
  }

  /** Dipanggil setiap frame dengan FPS rata-rata terkini. Mengembalikan tingkat kualitas. */
  update(averageFps: number, dtSec: number): number {
    this.elapsed += dtSec;
    if (this.elapsed < this.options.warmupSec || averageFps <= 0) return this.current;
    if (this.current >= this.options.maxLevel) return this.current;

    if (averageFps < this.options.downgradeFps) {
      this.lowFor += dtSec;
      if (this.lowFor >= this.options.sustainSec) {
        this.current++;
        this.lowFor = 0;
      }
    } else {
      this.lowFor = 0;
    }
    return this.current;
  }
}
