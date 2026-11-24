import { gameConfig } from '../../config/gameConfig';
import { computeStats } from '../typing/metrics';
import { applyKeystroke, createTypingState, isFinished, type TypingOptions } from '../typing/typingEngine';
import type { Keystroke, TypingState } from '../typing/types';

export type RacePhase = 'countdown' | 'racing' | 'finished' | 'timeout';

export interface RaceSessionOptions {
  readonly countdownSeconds: number;
  readonly timeLimitMs: number;
  readonly typing: TypingOptions;
}

const defaultOptions: RaceSessionOptions = {
  countdownSeconds: gameConfig.countdownSeconds,
  timeLimitMs: gameConfig.raceTimeLimitMs,
  typing: { maxErrorBuffer: gameConfig.maxErrorBuffer },
};

export interface RaceSession {
  readonly phase: RacePhase;
  /** Waktu jam (ms, mis. performance.now) saat balapan mulai = akhir hitung mundur. */
  readonly startAtMs: number;
  readonly typing: TypingState;
  readonly options: RaceSessionOptions;
}

export interface RaceResult {
  readonly passageId: string;
  readonly status: 'finished' | 'timeout';
  readonly wpm: number;
  readonly accuracy: number;
  readonly netWpm: number;
  readonly durationMs: number;
  readonly correctChars: number;
  readonly totalChars: number;
  readonly log: readonly Keystroke[];
}

/** Membuat sesi; hitung mundur dimulai pada `nowMs`. */
export function createRaceSession(
  text: string,
  nowMs: number,
  options: RaceSessionOptions = defaultOptions,
): RaceSession {
  return {
    phase: 'countdown',
    startAtMs: nowMs + options.countdownSeconds * 1000,
    typing: createTypingState(text),
    options,
  };
}

/** Waktu balapan (ms sejak mulai), dibulatkan agar log ringkas dan identik saat diputar ulang. */
export function raceTimeMs(session: RaceSession, nowMs: number): number {
  return Math.round(nowMs - session.startAtMs);
}

/** Angka hitung mundur yang tampil (3, 2, 1), atau 0 bila sudah mulai. */
export function countdownValue(session: RaceSession, nowMs: number): number {
  if (session.phase !== 'countdown') return 0;
  return Math.max(0, Math.ceil((session.startAtMs - nowMs) / 1000));
}

/** Memajukan fase berdasarkan waktu: countdown -> racing -> timeout. */
export function tickRace(session: RaceSession, nowMs: number): RaceSession {
  let s = session;
  if (s.phase === 'countdown' && nowMs >= s.startAtMs) {
    s = { ...s, phase: 'racing' };
  }
  if (s.phase === 'racing' && nowMs - s.startAtMs >= s.options.timeLimitMs) {
    s = { ...s, phase: 'timeout' };
  }
  return s;
}

/** Input hanya diproses saat fase racing; saat hitung mundur diabaikan dan tidak dicatat (TYP-4). */
export function handleRaceKey(session: RaceSession, key: string, nowMs: number): RaceSession {
  const s = tickRace(session, nowMs);
  if (s.phase !== 'racing') return s;

  const typing = applyKeystroke(s.typing, { key, t: raceTimeMs(s, nowMs) }, s.options.typing);
  return {
    ...s,
    typing,
    phase: isFinished(typing) ? 'finished' : s.phase,
  };
}

export function isRaceOver(session: RaceSession): boolean {
  return session.phase === 'finished' || session.phase === 'timeout';
}

export function buildRaceResult(session: RaceSession, passageId: string): RaceResult {
  const finished = session.phase === 'finished';
  const durationMs = finished ? (session.typing.finishedAtMs ?? 0) : session.options.timeLimitMs;
  const stats = computeStats(session.typing, durationMs);
  return {
    passageId,
    status: finished ? 'finished' : 'timeout',
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    netWpm: stats.netWpm,
    durationMs,
    correctChars: stats.correctChars,
    totalChars: session.typing.text.length,
    log: session.typing.log,
  };
}
