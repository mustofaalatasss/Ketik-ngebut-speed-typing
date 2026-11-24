import { replay } from '../typing/replay';
import type { Keystroke } from '../typing/types';
import { progressAt, type Schedule } from './botSchedule';

/**
 * BOT-3: jadwal ghost dari log keystroke rekaman, diputar ulang dengan mesin mengetik yang sama.
 * Teks sama -> waktu tiap karakter persis seperti rekaman.
 * Teks berbeda -> progres dinormalisasi: karakter ke-j dari L selesai saat rekaman mencapai j/L teksnya.
 */
export function createGhostSchedule(
  recordedText: string,
  log: readonly Keystroke[],
  targetText: string,
): Schedule {
  const recorded = replay(recordedText, log).correctCharTimes;
  if (recordedText === targetText) return [...recorded];
  if (recorded.length === 0 || targetText.length === 0) return [];

  const total = recordedText.length;
  const result: number[] = [];
  for (let j = 1; j <= targetText.length; j++) {
    const needed = (j / targetText.length) * total; // karakter rekaman yang setara
    if (needed > recorded.length + 1e-9) break; // rekaman tidak sampai sejauh ini
    result.push(timeAtProgress(recorded, needed));
  }
  return result;
}

/** Kebalikan dari progressAt: waktu saat jadwal mencapai `chars` karakter (pecahan diinterpolasi). */
export function timeAtProgress(schedule: Schedule, chars: number): number {
  if (chars <= 0) return 0;
  const whole = Math.floor(chars);
  const frac = chars - whole;
  if (whole >= schedule.length) return schedule.at(-1) ?? 0;
  const prev = whole === 0 ? 0 : schedule[whole - 1]!;
  const next = schedule[whole]!;
  return frac === 0 ? prev : prev + (next - prev) * frac;
}

export { progressAt };
