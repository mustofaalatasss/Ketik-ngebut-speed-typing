import {
  DIFFICULTIES,
  LANGUAGES,
  pickRandomPassage,
  TYPEABLE,
  type Difficulty,
  type Language,
  type Passage,
} from '../data/passages';
import type { Api } from './endpoints';
import type { PassageDto } from './types';

function toPassage(dto: PassageDto): Passage | null {
  const language = LANGUAGES.find((l) => l === dto.language);
  const difficulty = DIFFICULTIES.find((d) => d === dto.difficulty);
  if (!language || !difficulty || typeof dto.id !== 'string' || !TYPEABLE.test(dto.text)) return null;
  return { id: dto.id, language, difficulty, text: dto.text };
}

/**
 * PAS-1: ambil teks acak dari API; bila server tidak bisa dihubungi atau jawabannya tidak valid,
 * pakai teks lokal (passages.json) agar tamu tetap bisa bermain tanpa backend.
 */
export async function loadPassage(
  api: Pick<Api, 'getRandomPassage'>,
  language: Language,
  difficulty: Difficulty,
  excludeId?: string,
  random: () => number = Math.random,
): Promise<Passage> {
  try {
    let passage = toPassage(await api.getRandomPassage(language, difficulty));
    // Hindari teks yang sama dua kali berturut-turut (coba sekali lagi).
    if (passage && passage.id === excludeId) passage = toPassage(await api.getRandomPassage(language, difficulty));
    if (passage) return passage;
  } catch {
    // jatuh ke teks lokal
  }
  return pickRandomPassage(language, difficulty, random, excludeId);
}
