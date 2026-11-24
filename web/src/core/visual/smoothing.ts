import { easeToward } from './speedFeel';

/**
 * Penghalus dua tahap (dua easing eksponensial berurutan). Satu tahap saja membuat posisi
 * kontinu tetapi kecepatan masih berubah mendadak; dua tahap membuat kecepatan pun berubah
 * bertahap, sehingga gerak mobil tidak terlihat patah-patah. Murni, tanpa Three.js.
 */
export class SmoothedValue {
  private stage1: number;
  private stage2: number;

  constructor(
    private readonly tau: number,
    initial = 0,
  ) {
    this.stage1 = initial;
    this.stage2 = initial;
  }

  get value(): number {
    return this.stage2;
  }

  update(target: number, dtSec: number): number {
    this.stage1 = easeToward(this.stage1, target, dtSec, this.tau);
    this.stage2 = easeToward(this.stage2, this.stage1, dtSec, this.tau);
    return this.stage2;
  }

  /** Langsung ke nilai target (dipakai bila sudah sangat dekat agar akhir balapan tepat). */
  snap(target: number): void {
    this.stage1 = target;
    this.stage2 = target;
  }
}
