import rawPassages from './passages.json';

export const LANGUAGES = ['id', 'en'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type Language = (typeof LANGUAGES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Passage {
  readonly id: string;
  readonly language: Language;
  readonly difficulty: Difficulty;
  readonly text: string;
}

/** Karakter yang bisa diketik langsung di keyboard QWERTY (ASCII cetak). */
export const TYPEABLE = /^[\x20-\x7e]+$/;

function isOneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (values as readonly string[]).includes(v);
}

/** Memvalidasi isi JSON saat dimuat agar kesalahan data ketahuan lebih awal. */
export function parsePassages(raw: unknown): Passage[] {
  if (!Array.isArray(raw)) throw new Error('passages.json harus berupa array');
  return raw.map((item: unknown, i) => {
    const p = item as Record<string, unknown>;
    if (
      typeof p.id !== 'string' ||
      !isOneOf(LANGUAGES, p.language) ||
      !isOneOf(DIFFICULTIES, p.difficulty) ||
      typeof p.text !== 'string' ||
      !TYPEABLE.test(p.text) ||
      p.text !== p.text.trim()
    ) {
      throw new Error(`Teks ke-${i} tidak valid`);
    }
    return { id: p.id, language: p.language, difficulty: p.difficulty, text: p.text };
  });
}

export const passages: readonly Passage[] = parsePassages(rawPassages);

/** Memilih teks acak sesuai bahasa dan tingkat; `excludeId` mencegah teks yang sama dua kali berturut-turut. */
export function pickRandomPassage(
  language: Language,
  difficulty: Difficulty,
  random: () => number = Math.random,
  excludeId?: string,
  source: readonly Passage[] = passages,
): Passage {
  const matching = source.filter((p) => p.language === language && p.difficulty === difficulty);
  const pool = matching.length > 1 ? matching.filter((p) => p.id !== excludeId) : matching;
  const picked = pool[Math.floor(random() * pool.length)] ?? source[0];
  if (!picked) throw new Error('Tidak ada teks');
  return picked;
}
