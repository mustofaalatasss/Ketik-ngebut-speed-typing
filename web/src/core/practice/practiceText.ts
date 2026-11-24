import { gameConfig } from '../../config/gameConfig';

/** Bentuk minimum statistik per huruf (sama dengan KeyStatDto dari server). */
export interface KeyStatLike {
  readonly character: string;
  readonly hits: number;
  readonly misses: number;
}

/**
 * POL-2: huruf lemah = rasio salah tertinggi, hanya huruf yang sudah cukup sering dicoba dan pernah salah.
 * Spasi tidak dilatih (tidak bisa dijadikan fokus kata).
 */
export function weakCharacters(
  stats: readonly KeyStatLike[],
  count: number = gameConfig.practice.weakCount,
  minAttempts: number = gameConfig.practice.minAttempts,
): string[] {
  return stats
    .filter((s) => s.character !== ' ' && s.misses > 0 && s.hits + s.misses >= minAttempts)
    .map((s) => ({ c: s.character, rate: s.misses / (s.hits + s.misses), misses: s.misses }))
    .sort((a, b) => b.rate - a.rate || b.misses - a.misses || a.c.localeCompare(b.c))
    .slice(0, count)
    .map((s) => s.c);
}

/** Kata unik dari kumpulan teks (tanda baca ikut kata, sehingga koma/titik juga bisa dilatih). */
export function wordPool(texts: readonly string[]): string[] {
  return [...new Set(texts.flatMap((t) => t.split(/\s+/)).filter((w) => w.length > 0))];
}

const weakCount = (word: string, weak: readonly string[]): number =>
  [...word.toLowerCase()].filter((c) => weak.includes(c)).length;

/**
 * POL-2: teks latihan dari kata-kata yang memuat huruf lemah. Kata dengan lebih banyak huruf lemah
 * lebih sering terpilih. Deterministik untuk `random` yang sama (bisa diberi seed di test).
 */
export function buildPracticeText(
  weak: readonly string[],
  words: readonly string[],
  random: () => number,
  targetLength: number = gameConfig.practice.targetLength,
): string {
  if (words.length === 0) return '';
  const focused = words.filter((w) => weakCount(w, weak) > 0);
  const pool = focused.length > 0 ? focused : [...words];
  const weights = pool.map((w) => Math.max(1, weakCount(w, weak)));
  const total = weights.reduce((a, b) => a + b, 0);

  const picked: string[] = [];
  let length = 0;
  let previous = '';
  while (length < targetLength) {
    let r = random() * total;
    let i = 0;
    while (i < pool.length - 1 && r >= weights[i]!) {
      r -= weights[i]!;
      i++;
    }
    let word = pool[i]!;
    if (word === previous && pool.length > 1) word = pool[(i + 1) % pool.length]!; // hindari kata kembar berurutan
    picked.push(word);
    previous = word;
    length += word.length + 1;
  }
  return picked.join(' ');
}
