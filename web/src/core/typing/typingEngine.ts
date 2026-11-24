import { gameConfig } from '../../config/gameConfig';
import { BACKSPACE, type CharStatus, type Keystroke, type TypingState } from './types';

export interface TypingOptions {
  readonly maxErrorBuffer: number;
}

const defaultOptions: TypingOptions = { maxErrorBuffer: gameConfig.maxErrorBuffer };

export function createTypingState(text: string): TypingState {
  return {
    text,
    cursor: 0,
    errorBuffer: '',
    correctKeystrokes: 0,
    totalKeystrokes: 0,
    correctCharTimes: [],
    log: [],
    finishedAtMs: text.length === 0 ? 0 : null,
    lastResult: 'ignored',
  };
}

export function isFinished(state: TypingState): boolean {
  return state.finishedAtMs !== null;
}

/** Kunci yang diterima mesin: tepat satu karakter, atau Backspace. */
export function isAcceptedKey(key: string): boolean {
  return key === BACKSPACE || [...key].length === 1;
}

/**
 * Fungsi murni: state lama + keystroke -> state baru. Tidak membaca jam atau DOM,
 * sehingga memutar ulang log yang sama selalu menghasilkan state yang sama (TYP-2).
 */
export function applyKeystroke(
  state: TypingState,
  keystroke: Keystroke,
  options: TypingOptions = defaultOptions,
): TypingState {
  if (isFinished(state) || !isAcceptedKey(keystroke.key)) {
    return state.lastResult === 'ignored' ? state : { ...state, lastResult: 'ignored' };
  }

  const log = [...state.log, keystroke];

  if (keystroke.key === BACKSPACE) {
    // TYP-3: Backspace hanya menghapus kesalahan; karakter benar sudah terkunci.
    return {
      ...state,
      log,
      errorBuffer: state.errorBuffer.slice(0, -1),
      lastResult: 'backspace',
    };
  }

  const expected = state.text[state.cursor];
  const totalKeystrokes = state.totalKeystrokes + 1;

  if (state.errorBuffer.length === 0 && keystroke.key === expected) {
    const cursor = state.cursor + 1;
    return {
      ...state,
      log,
      cursor,
      totalKeystrokes,
      correctKeystrokes: state.correctKeystrokes + 1,
      correctCharTimes: [...state.correctCharTimes, keystroke.t],
      finishedAtMs: cursor === state.text.length ? keystroke.t : null,
      lastResult: 'correct',
    };
  }

  // Salah: kursor tidak maju. Selama masih ada kesalahan, ketikan berikutnya juga dihitung salah.
  const errorBuffer =
    state.errorBuffer.length < options.maxErrorBuffer
      ? state.errorBuffer + keystroke.key
      : state.errorBuffer;
  return { ...state, log, errorBuffer, totalKeystrokes, lastResult: 'incorrect' };
}

/** Status setiap karakter teks untuk tampilan (hijau, merah, kursor, belum). */
export function charStatuses(state: TypingState): CharStatus[] {
  const errorEnd = Math.min(state.text.length, state.cursor + state.errorBuffer.length);
  return [...state.text].map((_, i) => {
    if (i < state.cursor) return 'correct';
    if (i < errorEnd) return 'incorrect';
    if (i === state.cursor && !isFinished(state)) return 'current';
    return 'pending';
  });
}
