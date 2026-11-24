/**
 * Pool partikel berkapasitas tetap (struktur array, tanpa alokasi per frame).
 * Partikel hidup selalu berada di indeks [0, count) sehingga bisa dirender dengan drawRange.
 */
export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export class ParticlePool {
  readonly capacity: number;
  /** xyz per partikel; langsung dipakai sebagai atribut posisi. */
  readonly positions: Float32Array;
  /** rgba per partikel; alpha memudar sesuai umur. */
  readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lives: Float32Array;
  private alive = 0;

  constructor(
    capacity: number,
    private readonly rgb: readonly [number, number, number],
  ) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 4);
    this.velocities = new Float32Array(this.capacity * 3);
    this.ages = new Float32Array(this.capacity);
    this.lives = new Float32Array(this.capacity);
  }

  get count(): number {
    return this.alive;
  }

  /** Menambah partikel; false bila pool penuh. */
  spawn(p: ParticleSpawn): boolean {
    if (this.alive >= this.capacity || p.life <= 0) return false;
    const i = this.alive++;
    const v = i * 3;
    const c = i * 4;
    this.positions[v] = p.x;
    this.positions[v + 1] = p.y;
    this.positions[v + 2] = p.z;
    this.velocities[v] = p.vx;
    this.velocities[v + 1] = p.vy;
    this.velocities[v + 2] = p.vz;
    this.colors[c] = this.rgb[0];
    this.colors[c + 1] = this.rgb[1];
    this.colors[c + 2] = this.rgb[2];
    this.colors[c + 3] = 1;
    this.ages[i] = 0;
    this.lives[i] = p.life;
    return true;
  }

  /**
   * Memajukan simulasi. `worldShiftZ` = pergeseran dunia frame ini (partikel tertinggal di jalan),
   * `gravity` ke bawah, `drag` = redaman kecepatan per detik (0..1).
   */
  update(dtSec: number, worldShiftZ: number, gravity: number, drag: number): void {
    if (dtSec <= 0) return;
    const damp = Math.max(0, 1 - drag * dtSec);
    let i = 0;
    while (i < this.alive) {
      const age = this.ages[i]! + dtSec;
      const life = this.lives[i]!;
      if (age >= life) {
        this.removeAt(i);
        continue;
      }
      this.ages[i] = age;
      const p = i * 3;
      const vy = this.velocities[p + 1]! - gravity * dtSec;
      this.velocities[p] = this.velocities[p]! * damp;
      this.velocities[p + 1] = vy * damp;
      this.velocities[p + 2] = this.velocities[p + 2]! * damp;
      this.positions[p] = this.positions[p]! + this.velocities[p]! * dtSec;
      this.positions[p + 1] = Math.max(0.02, this.positions[p + 1]! + this.velocities[p + 1]! * dtSec);
      this.positions[p + 2] = this.positions[p + 2]! + this.velocities[p + 2]! * dtSec + worldShiftZ;
      this.colors[i * 4 + 3] = 1 - age / life;
      i++;
    }
  }

  clear(): void {
    this.alive = 0;
  }

  /** Hapus dengan menukar partikel terakhir ke indeks i (O(1)). */
  private removeAt(i: number): void {
    const last = --this.alive;
    if (i === last) return;
    this.positions.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.velocities.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.colors.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.ages[i] = this.ages[last]!;
    this.lives[i] = this.lives[last]!;
  }
}

/** Mengubah laju (per detik) menjadi jumlah partikel bulat per frame tanpa kehilangan pecahan. */
export class EmissionAccumulator {
  private carry = 0;

  take(ratePerSec: number, dtSec: number): number {
    if (ratePerSec <= 0 || dtSec <= 0) return 0;
    this.carry += ratePerSec * dtSec;
    const n = Math.floor(this.carry);
    this.carry -= n;
    return n;
  }
}
