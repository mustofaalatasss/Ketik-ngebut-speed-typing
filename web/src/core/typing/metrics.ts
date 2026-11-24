import { gameConfig } from '../../config/gameConfig';
import type { TypingState, TypingStats } from './types';

const MS_PER_MINUTE = 60_000;

/** WPM = (karakter benar / 5) / menit berlalu. */
export function computeWpm(
  correctChars: number,
  elapsedMs: number,
  charsPerWord: number = gameConfig.charsPerWord,
): number {
  if (elapsedMs <= 0) return 0;
  return correctChars / charsPerWord / (elapsedMs / MS_PER_MINUTE);
}

/** Akurasi = keystroke benar / total keystroke (tanpa Backspace). 1 bila belum ada keystroke. */
export function computeAccuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  if (totalKeystrokes <= 0) return 1;
  return correctKeystrokes / totalKeystrokes;
}

/** Statistik pada waktu `nowMs` (ms sejak mulai). Setelah selesai, waktu dibekukan di waktu finis. */
export function computeStats(state: TypingState, nowMs: number): TypingStats {
  const elapsedMs = state.finishedAtMs ?? Math.max(0, nowMs);
  const wpm = computeWpm(state.cursor, elapsedMs);
  const accuracy = computeAccuracy(state.correctKeystrokes, state.totalKeystrokes);
  return {
    correctChars: state.cursor,
    wpm,
    accuracy,
    netWpm: wpm * accuracy,
    progress: state.text.length === 0 ? 1 : state.cursor / state.text.length,
    elapsedMs,
  };
}

/**
 * WPM jendela geser: karakter benar dalam `windowMs` terakhir. Di awal balapan jendela
 * dipendekkan ke waktu yang sudah berlalu (minimal `minWindowMs`) agar mobil cepat bereaksi.
 */
export function computeWindowWpm(
  correctCharTimes: readonly number[],
  nowMs: number,
  windowMs: number = gameConfig.wpmWindowMs,
  minWindowMs: number = gameConfig.wpmWindowMinMs,
): number {
  const effectiveWindow = Math.min(windowMs, Math.max(minWindowMs, nowMs));
  const from = nowMs - effectiveWindow;
  let count = 0;
  for (let i = correctCharTimes.length - 1; i >= 0; i--) {
    const t = correctCharTimes[i]!;
    if (t <= from) break;
    if (t <= nowMs) count++;
  }
  return computeWpm(count, effectiveWindow);
}
