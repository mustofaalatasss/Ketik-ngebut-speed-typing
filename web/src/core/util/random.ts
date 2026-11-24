/** Generator acak berseed (mulberry32): hasil sama untuk seed yang sama, nilai 0..1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nilai acak di rentang [min, max). */
export function randomRange(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}
