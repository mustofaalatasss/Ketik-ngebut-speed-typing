import { randomRange } from '../util/random';

/**
 * Jadwal ketikan: `times[i]` = waktu (ms sejak balapan mulai) saat karakter ke-i selesai diketik benar.
 * Dipakai untuk bot (dibangkitkan acak berseed) dan ghost (dari log keystroke rekaman).
 */
export type Schedule = readonly number[];

export interface BotStyle {
  readonly keyIntervalCv: number;
  readonly typoChance: number;
  readonly typoRecoveryMs: readonly [number, number];
  readonly pauseChance: number;
  readonly pauseMs: readonly [number, number];
}

const MS_PER_CHAR_AT_1_WPM = 12_000; // 60 000 ms / 5 karakter per kata

/** Bilangan acak berdistribusi normal standar (Box-Muller). */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const mean = (range: readonly [number, number]): number => (range[0] + range[1]) / 2;

/**
 * BOT-1: membangkitkan jadwal bot dengan WPM target. Jarak antar ketikan acak di sekitar rata-rata,
 * kadang jeda setelah spasi, kadang salah ketik lalu dikoreksi: bot melambat dan mempercepat di
 * dalam balapan. Seluruh jadwal lalu diskalakan agar WPM rata-ratanya tepat sama dengan target,
 * sehingga urutan bot lambat, setara, dan cepat (BOT-4) selalu terjaga.
 */
export function createBotSchedule(
  text: string,
  targetWpm: number,
  style: BotStyle,
  random: () => number,
): Schedule {
  if (text.length === 0 || targetWpm <= 0) return [];
  const spaces = [...text].filter((c) => c === ' ').length / text.length;
  const expectedExtra = style.typoChance * mean(style.typoRecoveryMs) + spaces * style.pauseChance * mean(style.pauseMs);
  const base = Math.max(30, MS_PER_CHAR_AT_1_WPM / targetWpm - expectedExtra);

  const raw: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    const factor = Math.max(0.3, 1 + style.keyIntervalCv * gaussian(random));
    t += base * factor;
    if (random() < style.typoChance) t += randomRange(random, ...style.typoRecoveryMs);
    if (text[i - 1] === ' ' && random() < style.pauseChance) t += randomRange(random, ...style.pauseMs);
    raw.push(t);
  }

  const scale = (text.length * MS_PER_CHAR_AT_1_WPM) / targetWpm / t;
  return raw.map((v) => v * scale);
}

/**
 * Jumlah karakter (pecahan, untuk gerak halus) yang sudah selesai pada waktu `t`.
 * Di antara dua karakter nilainya diinterpolasi linear; tepat di waktu karakter selesai nilainya bulat.
 */
export function progressAt(schedule: Schedule, t: number): number {
  if (schedule.length === 0 || t <= 0) return 0;
  // Pencarian biner: jumlah karakter dengan waktu <= t.
  let lo = 0;
  let hi = schedule.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (schedule[mid]! <= t) lo = mid + 1;
    else hi = mid;
  }
  const done = lo;
  if (done >= schedule.length) return schedule.length;
  const prev = done === 0 ? 0 : schedule[done - 1]!;
  const next = schedule[done]!;
  return done + (next > prev ? (t - prev) / (next - prev) : 0);
}

/** Waktu selesai seluruh teks, atau null bila jadwal tidak mencakup seluruh teks. */
export function finishTime(schedule: Schedule, textLength: number): number | null {
  return schedule.length >= textLength && textLength > 0 ? schedule[textLength - 1]! : null;
}

/** WPM rata-rata sebuah jadwal sampai selesai. */
export function scheduleWpm(schedule: Schedule): number {
  const last = schedule.at(-1);
  return last && last > 0 ? schedule.length / 5 / (last / 60_000) : 0;
}
