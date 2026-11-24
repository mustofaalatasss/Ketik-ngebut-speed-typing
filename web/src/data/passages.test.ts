import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, LANGUAGES, TYPEABLE, parsePassages, passages, pickRandomPassage } from './passages';

describe('Kumpulan teks awal (GAM-6)', () => {
  it('GAM_6_Teks_AdaIndonesiaDanInggris', () => {
    expect(passages.some((p) => p.language === 'id')).toBe(true);
    expect(passages.some((p) => p.language === 'en')).toBe(true);
  });

  it('GAM_6_Teks_AdaSemuaTingkatKesulitan', () => {
    for (const lang of LANGUAGES) {
      for (const diff of DIFFICULTIES) {
        const count = passages.filter((p) => p.language === lang && p.difficulty === diff).length;
        expect(count, `${lang}/${diff}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('GAM_6_Teks_HanyaKarakterQwertyDanIdUnik', () => {
    for (const p of passages) {
      expect(TYPEABLE.test(p.text), p.id).toBe(true);
      expect(p.text).not.toMatch(/ {2}/);
    }
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
  });

  it('GAM_6_Teks_DataTidakValidDitolak', () => {
    expect(() => parsePassages([{ id: 'x', language: 'fr', difficulty: 'easy', text: 'a' }])).toThrow();
    expect(() => parsePassages([{ id: 'x', language: 'id', difficulty: 'easy', text: 'kutip “miring”' }])).toThrow();
  });

  it('GAM_6_PilihAcak_SesuaiBahasaDanTingkat', () => {
    const p = pickRandomPassage('en', 'hard', () => 0.99);
    expect(p.language).toBe('en');
    expect(p.difficulty).toBe('hard');
    const next = pickRandomPassage('en', 'hard', () => 0.99, p.id);
    expect(next.id).not.toBe(p.id);
  });
});
