import { describe, expect, it } from 'vitest';
import { computeStats } from './metrics';
import { applyKeystroke, charStatuses, createTypingState } from './typingEngine';
import { BACKSPACE, type TypingState } from './types';

/** Mengetik deretan kunci dengan jarak waktu tetap. */
function typeKeys(state: TypingState, keys: string[], startMs = 0, stepMs = 100): TypingState {
  return keys.reduce((s, key, i) => applyKeystroke(s, { key, t: startMs + i * stepMs }), state);
}

describe('Mesin mengetik (TYP-1, TYP-3)', () => {
  it('TYP_1_KetikAbcBenar_TigaBenarAkurasi100Selesai', () => {
    const state = typeKeys(createTypingState('abc'), ['a', 'b', 'c']);
    const stats = computeStats(state, 1_000);

    expect(stats.correctChars).toBe(3);
    expect(stats.accuracy).toBe(1);
    expect(state.finishedAtMs).not.toBeNull();
    expect(stats.progress).toBe(1);
  });

  it('TYP_1_StatusPerKarakter_BenarDanSalah', () => {
    let state = applyKeystroke(createTypingState('abcd'), { key: 'a', t: 0 });
    expect(state.lastResult).toBe('correct');
    state = applyKeystroke(state, { key: 'x', t: 100 });
    expect(state.lastResult).toBe('incorrect');
    expect(charStatuses(state)).toEqual(['correct', 'incorrect', 'pending', 'pending']);

    state = applyKeystroke(state, { key: BACKSPACE, t: 200 });
    expect(charStatuses(state)).toEqual(['correct', 'current', 'pending', 'pending']);
  });

  it('TYP_1_Akurasi_BackspaceTidakDihitung', () => {
    // a (benar), x (salah), Backspace, b (benar) -> 2 benar dari 3 keystroke karakter
    const state = typeKeys(createTypingState('ab'), ['a', 'x', BACKSPACE, 'b']);
    expect(state.totalKeystrokes).toBe(3);
    expect(state.correctKeystrokes).toBe(2);
    expect(computeStats(state, 1_000).accuracy).toBeCloseTo(2 / 3, 10);
  });

  it('TYP_1_WpmBersih_SamaDenganWpmKaliAkurasi', () => {
    const state = typeKeys(createTypingState('hello'), ['h', 'q', BACKSPACE, 'e', 'l', 'l', 'o']);
    const stats = computeStats(state, 0);
    expect(stats.netWpm).toBeCloseTo(stats.wpm * stats.accuracy, 10);
    expect(stats.netWpm).toBeLessThan(stats.wpm);
  });

  it('TYP_1_SetelahSelesai_InputDiabaikan', () => {
    const done = typeKeys(createTypingState('ab'), ['a', 'b']);
    const after = applyKeystroke(done, { key: 'c', t: 999 });
    expect(after.cursor).toBe(2);
    expect(after.totalKeystrokes).toBe(done.totalKeystrokes);
    expect(after.log).toEqual(done.log);
    expect(after.lastResult).toBe('ignored');
  });

  it('TYP_3_KarakterSalah_KursorTidakMaju', () => {
    const state = typeKeys(createTypingState('abc'), ['a', 'x']);
    expect(state.cursor).toBe(1);
    expect(state.errorBuffer).toBe('x');
  });

  it('TYP_3_BackspaceLaluBenar_KursorMaju', () => {
    const state = typeKeys(createTypingState('abc'), ['a', 'x', BACKSPACE, 'b']);
    expect(state.cursor).toBe(2);
    expect(state.errorBuffer).toBe('');
  });

  it('TYP_3_BackspaceTanpaKesalahan_KarakterBenarTetap', () => {
    const state = typeKeys(createTypingState('abc'), ['a', 'b', BACKSPACE, BACKSPACE]);
    expect(state.cursor).toBe(2);
    expect(state.lastResult).toBe('backspace');
  });

  it('TYP_3_KesalahanBeruntun_HarusDihapusSemua', () => {
    // Setelah salah, karakter yang "benar" pun dianggap salah sampai kesalahan dihapus.
    let state = typeKeys(createTypingState('abc'), ['x', 'a', 'b']);
    expect(state.cursor).toBe(0);
    expect(state.errorBuffer).toBe('xab');

    state = typeKeys(state, [BACKSPACE, BACKSPACE], 1_000);
    state = applyKeystroke(state, { key: 'a', t: 2_000 });
    expect(state.cursor).toBe(0);

    state = typeKeys(state, [BACKSPACE, BACKSPACE, 'a'], 3_000);
    expect(state.cursor).toBe(1);
  });

  it('TYP_3_BufferKesalahan_DibatasiMaxErrorBuffer', () => {
    const keys = Array.from({ length: 20 }, () => 'z');
    const state = keys.reduce(
      (s, key, i) => applyKeystroke(s, { key, t: i }, { maxErrorBuffer: 4 }),
      createTypingState('abc'),
    );
    expect(state.errorBuffer).toBe('zzzz');
    expect(state.totalKeystrokes).toBe(20);
  });
});
